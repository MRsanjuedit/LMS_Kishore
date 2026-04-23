'use client';

import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Edit, Save } from '@mui/icons-material';
import { doc, getDoc, serverTimestamp, updateDoc, collection, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/lib/firebase';

interface UserSettings {
  emailNotifications?: boolean;
  testReminders?: boolean;
  weeklySummary?: boolean;
}

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [settings, setSettings] = useState<UserSettings>({});
  const [collegesList, setCollegesList] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as {
            name?: string;
            bio?: string;
            phone?: string;
            college?: string;
            settings?: UserSettings;
          };
          setName(data.name || profile?.name || user.displayName || '');
          setBio(data.bio || '');
          setPhone(data.phone || '');
          setCollege(data.college || profile?.college || '');
          setSettings(data.settings || {});
        } else {
          setName(profile?.name || user.displayName || '');
          setCollege(profile?.college || '');
        }

        // Fetch colleges
        const cSnap = await getDocs(collection(db, 'colleges'));
        const list: string[] = [];
        cSnap.forEach(d => { if (d.data().name) list.push(d.data().name); });
        setCollegesList(list.length > 0 ? list : ['Other']);
      } catch (error) {
        console.error('Failed to load profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.name, user]);

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const trimmedName = name.trim();
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        name: trimmedName,
        bio: bio.trim(),
        phone: phone.trim(),
        college,
        settings,
        updatedAt: serverTimestamp(),
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmedName });
      }

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Profile</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Manage your personal details and keep your account information updated.
            </Typography>
          </Box>

          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ textAlign: 'center', p: { xs: 2.5, sm: 3 } }}>
                  {loading ? (
                    <Skeleton variant="circular" width={88} height={88} sx={{ mx: 'auto', mb: 2 }} />
                  ) : (
                    <Avatar
                      sx={{
                        width: 88,
                        height: 88,
                        mx: 'auto',
                        mb: 2,
                        bgcolor: 'primary.main',
                        fontSize: 34,
                        fontWeight: 700,
                      }}
                    >
                      {(name || profile?.name || user?.displayName || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                  )}

                  <Typography variant="h6" fontWeight={700}>
                    {loading ? <Skeleton width={180} sx={{ mx: 'auto' }} /> : (name || 'User')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                    {loading ? <Skeleton width={220} sx={{ mx: 'auto' }} /> : (profile?.email || user?.email)}
                  </Typography>
                  <Chip
                    size="small"
                    label={profile?.role || 'student'}
                    color={profile?.role === 'admin' ? 'warning' : profile?.role === 'instructor' ? 'success' : 'primary'}
                    sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                  />

                  <Box sx={{ mt: 2, color: 'text.secondary', fontSize: 13, lineHeight: 1.5 }}>
                    Manage your account details and keep your profile up to date.
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <Card>
                <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Edit color="primary" />
                    <Typography variant="h6" fontWeight={700}>Personal Information</Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading || saving}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Email"
                        value={profile?.email || user?.email || ''}
                        disabled
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={loading || saving}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>College</InputLabel>
                        <Select
                          value={college}
                          label="College"
                          onChange={(e) => setCollege(e.target.value as string)}
                          disabled={loading || saving}
                        >
                          {collegesList.map(c => (
                            <MenuItem key={c} value={c}>{c}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={4}
                        label="Bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        disabled={loading || saving}
                        placeholder="Tell us about yourself"
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 2.5, display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSave}
                      disabled={loading || saving}
                      fullWidth={true}
                      sx={{ maxWidth: { sm: 180 } }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
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