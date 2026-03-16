'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { Security } from '@mui/icons-material';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async () => {
    if (!user || !user.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Fill all password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Password update failed:', error);
      toast.error('Could not update password. Check your current password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Settings</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Update your account security preferences.
            </Typography>
          </Box>

          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card>
                <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Security color="primary" />
                    <Typography variant="h6" fontWeight={700}>Security</Typography>
                  </Box>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    Use a strong password with at least 8 characters.
                  </Alert>

                  <TextField
                    fullWidth
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    sx={{ mb: 1.5 }}
                    disabled={changingPassword}
                  />
                  <TextField
                    fullWidth
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    sx={{ mb: 1.5 }}
                    disabled={changingPassword}
                  />
                  <TextField
                    fullWidth
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={changingPassword}
                  />

                  <Divider sx={{ my: 2 }} />

                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    fullWidth
                    sx={{ maxWidth: { sm: 220 } }}
                  >
                    {changingPassword ? 'Updating...' : 'Change Password'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
                    Account Security Tips
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Chip label="Use 8+ character passwords" size="small" sx={{ width: 'fit-content' }} />
                    <Chip label="Avoid reusing old passwords" size="small" sx={{ width: 'fit-content' }} />
                    <Chip label="Update password periodically" size="small" sx={{ width: 'fit-content' }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.6 }}>
                    For better account safety, use a unique password and change it whenever you suspect unauthorized access.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
