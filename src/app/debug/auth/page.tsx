'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, Chip, Button, Alert } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

type FirestoreRole = UserRole | 'missing' | 'error' | 'loading';

const getRedirectTarget = (role?: UserRole | null) => {
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/instructor';
  return '/dashboard';
};

export default function AuthDebugPage() {
  const { user, profile } = useAuth();
  const [firestoreRole, setFirestoreRole] = useState<FirestoreRole>('loading');
  const [rawUserDoc, setRawUserDoc] = useState<Record<string, unknown> | null>(null);
  const [tokenClaims, setTokenClaims] = useState<Record<string, unknown> | null>(null);

  const envInfo = useMemo(
    () => ({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '(empty)',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '(empty)',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '(empty)',
      debugAuth: process.env.NEXT_PUBLIC_DEBUG_AUTH || 'false',
    }),
    []
  );

  const refresh = async () => {
    if (!auth.currentUser) {
      setFirestoreRole('error');
      setRawUserDoc(null);
      setTokenClaims(null);
      return;
    }

    setFirestoreRole('loading');

    try {
      const token = await auth.currentUser.getIdTokenResult(true);
      setTokenClaims(token.claims || null);
    } catch {
      setTokenClaims({ error: 'Failed to decode token claims' });
    }

    try {
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!snap.exists()) {
        setFirestoreRole('missing');
        setRawUserDoc(null);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      setRawUserDoc(data);
      const role = data.role;
      if (role === 'student' || role === 'instructor' || role === 'admin') {
        setFirestoreRole(role);
      } else {
        setFirestoreRole('error');
      }
    } catch {
      setFirestoreRole('error');
      setRawUserDoc({ error: 'Failed to read Firestore user doc' });
    }
  };

  useEffect(() => {
    void refresh();
  }, [user?.uid]);

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 980, mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" fontWeight={700}>Auth Debug</Typography>
            <Button variant="outlined" startIcon={<Refresh />} onClick={refresh}>Refresh</Button>
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            Use this page to confirm Vercel production is using the expected Firebase project and role source.
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>Runtime</Typography>
                  <Typography variant="body2"><strong>Current UID:</strong> {user?.uid || '(none)'}</Typography>
                  <Typography variant="body2"><strong>Email:</strong> {user?.email || '(none)'}</Typography>
                  <Typography variant="body2"><strong>AuthContext Role:</strong> {profile?.role || '(none)'}</Typography>
                  <Typography variant="body2"><strong>Redirect Target:</strong> {getRedirectTarget(profile?.role)}</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>Firestore Role</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    users/{user?.uid || '...'} role:&nbsp;
                    <Chip
                      size="small"
                      label={firestoreRole}
                      color={firestoreRole === 'admin' ? 'warning' : firestoreRole === 'instructor' ? 'success' : firestoreRole === 'student' ? 'primary' : 'default'}
                    />
                  </Typography>
                  <Typography variant="body2"><strong>Computed Redirect (Firestore):</strong> {getRedirectTarget(firestoreRole === 'missing' || firestoreRole === 'error' || firestoreRole === 'loading' ? 'student' : firestoreRole)}</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>Firebase Env (Client)</Typography>
                  <Typography variant="body2"><strong>projectId:</strong> {envInfo.projectId}</Typography>
                  <Typography variant="body2"><strong>authDomain:</strong> {envInfo.authDomain}</Typography>
                  <Typography variant="body2"><strong>storageBucket:</strong> {envInfo.storageBucket}</Typography>
                  <Typography variant="body2"><strong>NEXT_PUBLIC_DEBUG_AUTH:</strong> {envInfo.debugAuth}</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>Token Claims</Typography>
                  <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12, overflowX: 'auto' }}>
                    {JSON.stringify(tokenClaims, null, 2)}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>Raw Firestore User Document</Typography>
                  <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12, overflowX: 'auto' }}>
                    {JSON.stringify(rawUserDoc, null, 2)}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
