'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

interface Props {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && profile && allowedRoles && !allowedRoles.includes(profile.role)) {
      router.push('/unauthorized');
    }
  }, [user, profile, loading, router, allowedRoles]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return null;
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) return null;

  return <>{children}</>;
}
