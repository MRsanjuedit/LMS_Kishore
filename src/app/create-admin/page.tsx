'use client';

import { Box, Card, CardContent, Typography, Button } from '@mui/material';
import { AdminPanelSettings } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function CreateAdminPage() {
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
      <Card sx={{ width: { xs: 360, sm: 520 }, mx: 2, borderRadius: 4 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <AdminPanelSettings sx={{ fontSize: 48, color: '#F59E0B', mb: 1 }} />
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Instructor Setup Moved
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Instructor accounts are now created only by admins from Admin Panel → User Management.
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
