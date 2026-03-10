'use client';

import { Box, Typography, Button } from '@mui/material';
import { Block } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function UnauthorizedPage() {
  const router = useRouter();
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Block sx={{ fontSize: 80, color: 'error.main' }} />
      <Typography variant="h4" fontWeight={700}>Access Denied</Typography>
      <Typography color="text.secondary">You don&apos;t have permission to access this page.</Typography>
      <Button variant="contained" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
    </Box>
  );
}
