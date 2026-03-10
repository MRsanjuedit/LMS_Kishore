'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Link as MuiLink, Alert, InputAdornment, IconButton, Stepper, Step, StepLabel,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, Person, VpnKey, School } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const INSTRUCTOR_PIN = '22pa1a5757';

export default function RegisterInstructorPage() {
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pin.trim() !== INSTRUCTOR_PIN) {
      setError('Invalid PIN. Please contact the administrator for access.');
      return;
    }
    setStep(1);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name, 'instructor');
      toast.success('Instructor account created successfully!');
      router.push('/instructor');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try signing in instead.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError((err as Error).message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 50%, #16213e 100%)',
    }}>
      <m.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Card sx={{ width: { xs: 360, sm: 440 }, mx: 2, borderRadius: 4, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{
            p: 3, textAlign: 'center',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: '#fff',
          }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 1.5,
              bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <School sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>Instructor Registration</Typography>
            <Typography sx={{ opacity: 0.8, mt: 0.5, fontSize: 14 }}>Create tests and manage your courses</Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <Stepper activeStep={step} sx={{ mb: 3 }}>
              <Step><StepLabel>Verify PIN</StepLabel></Step>
              <Step><StepLabel>Create Account</StepLabel></Step>
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

            {step === 0 ? (
              <form onSubmit={handlePinSubmit}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                  Enter the instructor access PIN provided by your administrator
                </Typography>
                <TextField
                  fullWidth label="Access PIN" value={pin}
                  onChange={e => setPin(e.target.value)}
                  required sx={{ mb: 3 }}
                  type="password"
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><VpnKey color="action" /></InputAdornment>,
                  }}
                />
                <Button fullWidth type="submit" variant="contained" size="large"
                  sx={{
                    mb: 2, borderRadius: '12px', textTransform: 'none', fontWeight: 600, py: 1.3,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
                  }}>
                  Verify PIN
                </Button>
              </form>
            ) : (
              <m.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                <form onSubmit={handleRegister}>
                  <TextField fullWidth label="Full Name" value={name} onChange={e => setName(e.target.value)}
                    required sx={{ mb: 2 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Person color="action" /></InputAdornment> }} />
                  <TextField fullWidth label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required sx={{ mb: 2 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment> }} />
                  <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)} required sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }} />
                  <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}
                    sx={{
                      mb: 2, borderRadius: '12px', textTransform: 'none', fontWeight: 600, py: 1.3,
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
                    }}>
                    {loading ? 'Creating Account...' : 'Create Instructor Account'}
                  </Button>
                </form>
              </m.div>
            )}

            <Typography textAlign="center" color="text.secondary" variant="body2">
              Want a student account?{' '}
              <MuiLink href="/signup" sx={{ fontWeight: 600, cursor: 'pointer' }}>Sign up here</MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </m.div>
    </Box>
  );
}
