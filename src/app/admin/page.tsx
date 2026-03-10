'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Skeleton,
} from '@mui/material';
import { People, Quiz, Category, Analytics, ArrowForward } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ users: 0, tests: 0, categories: 0, submissions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersC, testsC, catsC, subsC] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'tests')),
          getCountFromServer(collection(db, 'categories')),
          getCountFromServer(collection(db, 'submissions')),
        ]);
        setStats({
          users: usersC.data().count,
          tests: testsC.data().count,
          categories: catsC.data().count,
          submissions: subsC.data().count,
        });
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.users, icon: <People />, color: '#6C63FF', path: '/admin/users' },
    { label: 'Total Tests', value: stats.tests, icon: <Quiz />, color: '#10B981', path: '/admin/analytics' },
    { label: 'Categories', value: stats.categories, icon: <Category />, color: '#F59E0B', path: '/admin/categories' },
    { label: 'Submissions', value: stats.submissions, icon: <Analytics />, color: '#FF6584', path: '/admin/analytics' },
  ];

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <DashboardLayout>
        <Box>
          <Typography variant="h4" sx={{ mb: 3 }}>Admin Dashboard</Typography>

          <m.div variants={container} initial="hidden" animate="show">
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {statCards.map((s, i) => (
                <Grid size={{ xs: 6, md: 3 }} key={i}>
                  <m.div variants={item}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        background: `linear-gradient(135deg, ${s.color}15, ${s.color}08)`,
                        border: `1px solid ${s.color}20`,
                        transition: '0.2s',
                        '&:hover': { transform: 'translateY(-3px)' },
                      }}
                      onClick={() => router.push(s.path)}
                    >
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${s.color}20`, color: s.color }}>
                          {s.icon}
                        </Box>
                        <Box>
                          <Typography variant="h4" fontWeight={700}>
                            {loading ? <Skeleton width={40} /> : s.value}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">{s.label}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </m.div>
                </Grid>
              ))}
            </Grid>

            {/* Quick Actions */}
            <Grid container spacing={3}>
              {[
                { label: 'Manage Users', desc: 'View and manage user accounts', icon: <People />, path: '/admin/users' },
                { label: 'Manage Categories', desc: 'Add, edit, or remove categories and topics', icon: <Category />, path: '/admin/categories' },
                { label: 'Platform Analytics', desc: 'View platform-wide performance metrics', icon: <Analytics />, path: '/admin/analytics' },
              ].map((a, i) => (
                <Grid size={{ xs: 12, md: 4 }} key={i}>
                  <m.div variants={item}>
                    <Card sx={{ cursor: 'pointer', transition: '0.2s', '&:hover': { boxShadow: 6 } }}
                      onClick={() => router.push(a.path)}>
                      <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Box sx={{ color: 'primary.main', mb: 2 }}>{a.icon}</Box>
                        <Typography variant="h6">{a.label}</Typography>
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>{a.desc}</Typography>
                        <Button endIcon={<ArrowForward />}>Open</Button>
                      </CardContent>
                    </Card>
                  </m.div>
                </Grid>
              ))}
            </Grid>
          </m.div>
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
