'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserRole = 'student' | 'instructor' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: Date;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserRole>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  createInstructor: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
const PROFILE_CACHE_PREFIX = 'edutech_profile_';

const isUserRole = (value: unknown): value is UserRole =>
  value === 'student' || value === 'instructor' || value === 'admin';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const buildUserProfile = (firebaseUser: User, data?: Partial<UserProfile>): UserProfile => ({
  uid: firebaseUser.uid,
  name: data?.name || firebaseUser.displayName || 'User',
  email: data?.email || firebaseUser.email || '',
  role: isUserRole(data?.role) ? data.role : 'student',
});

const getCachedProfile = (uid: string): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
};

const setCachedProfile = (profile: UserProfile) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.uid}`, JSON.stringify(profile));
  } catch {
    return;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const getServerProfileWithRetry = useCallback(async (firebaseUser: User): Promise<UserProfile | null> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        if (attempt > 0) {
          await firebaseUser.getIdToken(true);
          await sleep(250 * attempt);
        }
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          return buildUserProfile(firebaseUser, snap.data() as Partial<UserProfile>);
        }
        return null;
      } catch {
        // retry loop
      }
    }
    return null;
  }, []);

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    const cachedProfile = getCachedProfile(firebaseUser.uid);
    const fallbackProfile = buildUserProfile(firebaseUser);

    try {
      const serverProfile = await getServerProfileWithRetry(firebaseUser);
      if (serverProfile) {
        setProfile(serverProfile);
        setCachedProfile(serverProfile);
        return;
      }

      // Do NOT auto-create user documents here.
      // Account provisioning flows (signup/instructor setup) are responsible for writing
      // the role; auto-creating can race and incorrectly lock role as student.
      setProfile(cachedProfile || fallbackProfile);
    } catch (err) {
      console.error('Failed to fetch user profile, using fallback profile:', err);
      setProfile(cachedProfile || fallbackProfile);
    }
  }, [getServerProfileWithRetry]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const cachedProfile = getCachedProfile(u.uid);
        if (cachedProfile) {
          setProfile(cachedProfile);
        }
        void fetchProfile(u);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Fetch role immediately so the caller can redirect correctly.
    // In production, Firestore read can briefly fail right after auth while token claims propagate.
    const serverProfile = await getServerProfileWithRetry(cred.user);
    if (serverProfile) {
      setProfile(serverProfile);
      setCachedProfile(serverProfile);
      return serverProfile.role;
    }

    const cached = getCachedProfile(cred.user.uid);
    if (cached && isUserRole(cached.role)) {
      setProfile(cached);
      return cached.role;
    }

    return 'student';
  };

  const signUp = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const userProfile: UserProfile = {
      uid: cred.user.uid,
      name,
      email,
      role: 'student',
    };
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
    });
    setProfile(userProfile);
  };

  const createInstructor = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const instructorProfile: UserProfile = { uid: cred.user.uid, name, email, role: 'instructor' };
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...instructorProfile,
      createdAt: serverTimestamp(),
    });
    setCachedProfile(instructorProfile);
    // Sign out immediately — instructor should log in explicitly
    await firebaseSignOut(auth);
    setProfile(null);
    setUser(null);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, createInstructor, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
