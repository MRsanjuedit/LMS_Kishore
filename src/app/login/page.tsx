'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Link as MuiLink, Alert, InputAdornment, IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const role = await signIn(email, password);
      toast.success('Welcome back!');
      if (role === 'admin') router.push('/admin');
      else if (role === 'instructor') router.push('/instructor');
      else router.push('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError((err as Error).message || 'Sign in failed');
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
              <Typography variant="h5" fontWeight={700}>Welcome Back</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>Sign in to continue</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
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
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <Typography textAlign="center" color="text.secondary">
              Don&apos;t have an account?{' '}
              <MuiLink href="/signup" sx={{ fontWeight: 600, cursor: 'pointer' }}>Sign Up</MuiLink>
            </Typography>
            <Typography textAlign="center" color="text.secondary" variant="body2" sx={{ mt: 1 }}>
              Need instructor access?{' '}
              <MuiLink href="/register-instructor" sx={{ fontWeight: 600, cursor: 'pointer' }}>Register as Instructor</MuiLink>
            </Typography>
            <Typography textAlign="center" color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              Admin setup?{' '}
              <MuiLink href="/create-admin" sx={{ fontWeight: 600, cursor: 'pointer' }}>Create Admin</MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </m.div>
    </Box>
  );
}
