'use client';

import { Box, Typography, Button } from '@mui/material';
import { Block } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { profile } = useAuth();

  const getHomePath = () => {
    if (profile?.role === 'admin') return '/admin';
    if (profile?.role === 'instructor') return '/instructor';
    return '/dashboard';
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Block sx={{ fontSize: 80, color: 'error.main' }} />
      <Typography variant="h4" fontWeight={700}>Access Denied</Typography>
      <Typography color="text.secondary">You don&apos;t have permission to access this page.</Typography>
      <Button variant="contained" onClick={() => router.push(getHomePath())}>Go to Dashboard</Button>
    </Box>
  );
}
