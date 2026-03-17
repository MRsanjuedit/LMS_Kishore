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
            Instructor accounts are created only through the secure setup flow.
            Please continue to the setup page.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={() => router.push('/create-admin')}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
          >
            Go to Instructor Setup
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}