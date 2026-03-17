'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, Stepper, Step, StepLabel,
  Divider,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Email, Lock, Person,
  AdminPanelSettings, Key,
} from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const ADMIN_PIN = '22pa1a5757';

export default function CreateAdminPage() {
  const { createAdmin } = useAuth();
  const router = useRouter();

  // Step 0 = PIN, Step 1 = credentials
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== ADMIN_PIN) {
      setPinError('Incorrect PIN. Access denied.');
      return;
    }
    setPinError('');
    setStep(1);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await createAdmin(email, password, name);
      setSuccess(true);
      toast.success('Admin account created successfully!');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError((err as Error).message || 'Failed to create admin account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
    }}>
      <m.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card sx={{ width: { xs: 350, sm: 440 }, mx: 2 }}>
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: 2, mx: 'auto', mb: 2,
                background: 'linear-gradient(135deg, #6C63FF, #FF6584)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AdminPanelSettings sx={{ color: '#fff', fontSize: 30 }} />
              </Box>
              <Typography variant="h5" fontWeight={700}>Admin Setup</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                Restricted to authorized personnel only
              </Typography>
            </Box>

            <Stepper activeStep={step} sx={{ mb: 3 }}>
              <Step>
                <StepLabel>Verify PIN</StepLabel>
              </Step>
              <Step>
                <StepLabel>Create Admin</StepLabel>
              </Step>
            </Stepper>

            {/* ── Step 0: PIN ── */}
            {step === 0 && (
              <form onSubmit={handlePinSubmit}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter the admin setup PIN to continue.
                </Typography>
                {pinError && <Alert severity="error" sx={{ mb: 2 }}>{pinError}</Alert>}
                <TextField
                  fullWidth
                  label="Admin PIN"
                  type="password"
                  value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(''); }}
                  required
                  autoFocus
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"><Key color="action" /></InputAdornment>
                    ),
                  }}
                />
                <Button fullWidth type="submit" variant="contained" size="large"
                  sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                  Verify PIN
                </Button>
              </form>
            )}

            {/* ── Step 1: Create credentials ── */}
            {step === 1 && !success && (
              <form onSubmit={handleCreate}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create the admin account. All other sign-ups are assigned the <strong>student</strong> role.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <TextField
                  fullWidth label="Full Name" value={name}
                  onChange={e => setName(e.target.value)}
                  required sx={{ mb: 2 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person color="action" /></InputAdornment> }}
                />
                <TextField
                  fullWidth label="Email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  required sx={{ mb: 2 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment> }}
                />
                <TextField
                  fullWidth label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(p => !p)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  fullWidth type="submit" variant="contained" size="large"
                  disabled={loading}
                  sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)', mb: 2 }}
                >
                  {loading ? 'Creating Admin...' : 'Create Admin Account'}
                </Button>
              </form>
            )}

            {/* ── Success state ── */}
            {success && (
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{
                  width: 64, height: 64, borderRadius: '50%', mx: 'auto', mb: 2,
                  background: 'linear-gradient(135deg, #10B981, #34D399)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AdminPanelSettings sx={{ color: '#fff', fontSize: 34 }} />
                </Box>
                <Alert severity="success" sx={{ mb: 3 }}>
                  Admin account for <strong>{email}</strong> has been created successfully!
                </Alert>
                <Button
                  fullWidth variant="contained" size="large"
                  onClick={() => router.push('/login')}
                  sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
                >
                  Go to Login
                </Button>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography textAlign="center" variant="body2" color="text.secondary">
              Regular users sign up at{' '}
              <Typography
                component="span"
                variant="body2"
                sx={{ color: '#6C63FF', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => router.push('/signup')}
              >
                /signup
              </Typography>{' '}
              and are assigned <strong>student</strong> role automatically.
            </Typography>
          </CardContent>
        </Card>
      </m.div>
    </Box>
  );
}
