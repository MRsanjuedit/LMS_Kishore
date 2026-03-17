'use client';

import { Box, Card, CardContent, Typography, Button } from '@mui/material';
import { School } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function RegisterInstructorPage() {
  const router = useRouter();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      <Card sx={{ width: { xs: 360, sm: 480 }, mx: 2, borderRadius: 4 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <School sx={{ fontSize: 48, color: '#10B981', mb: 1 }} />
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Instructor Registration Moved
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Instructor accounts are created only by admins from User Management.
            Please contact an admin to get access.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={() => router.push('/login')}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}