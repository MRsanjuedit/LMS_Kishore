'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Link as MuiLink, Alert, InputAdornment, IconButton,
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, Person, School } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [collegesList, setCollegesList] = useState<string[]>([]);
  const { signUp } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const snap = await getDocs(collection(db, 'colleges'));
        const list: string[] = [];
        snap.forEach(doc => {
          if (doc.data().name) list.push(doc.data().name);
        });
        setCollegesList(list.length > 0 ? list : ['Other']);
      } catch (err) {
        console.error('Failed to fetch colleges', err);
        setCollegesList(['Other']);
      }
    };
    fetchColleges();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!college) {
      setError('Please select your college');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name, college);
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
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>College</InputLabel>
                <Select
                  value={college}
                  label="College"
                  onChange={e => setCollege(e.target.value as string)}
                  startAdornment={<InputAdornment position="start" sx={{ pl: 1 }}><School color="action" /></InputAdornment>}
                >
                  {collegesList.map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
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
              Contact an admin to create your instructor account.
            </Typography>
          </CardContent>
        </Card>
      </m.div>
    </Box>
  );
}
