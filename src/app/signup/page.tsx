'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Link as MuiLink, Alert, InputAdornment, IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, Person } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name);
      toast.success('Account created successfully!');
      router.push('/dashboard');
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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <m.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Card sx={{ width: { xs: 350, sm: 420 }, mx: 2 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box sx={{ width: 50, height: 50, borderRadius: 2, background: 'linear-gradient(135deg, #6C63FF, #FF6584)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>E</Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>Create Account</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>Join EduTech today</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
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
                sx={{ mb: 2, background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <Typography textAlign="center" color="text.secondary" sx={{ mb: 1 }}>
              Already have an account?{' '}
              <MuiLink href="/login" sx={{ fontWeight: 600, cursor: 'pointer' }}>Sign In</MuiLink>
            </Typography>
            <Typography textAlign="center" color="text.secondary" variant="body2">
              Are you an instructor?{' '}
              <MuiLink href="/create-admin" sx={{ fontWeight: 600, cursor: 'pointer' }}>Use instructor setup</MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </m.div>
    </Box>
  );
}
