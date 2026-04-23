'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Skeleton,
} from '@mui/material';
import { People, Quiz, TrendingUp, Assessment } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

const COLORS = ['#6C63FF', '#FF6584', '#10B981', '#F59E0B', '#3B82F6'];

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<Array<{ name: string; value: number }>>([]);

  const [stats, setStats] = useState({ users: 0, tests: 0, submissions: 0, avgScore: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [usersCountSnap, testsCountSnap, submissionsCountSnap, recentSubsSnap, studentCountSnap, instructorCountSnap, adminCountSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'tests')),
          getCountFromServer(collection(db, 'submissions')),
          getDocs(query(collection(db, 'submissions'), orderBy('createdAt', 'desc'), limit(500))),
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student'))),
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'instructor'))),
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'admin'))),
        ]);

        setUserRoles([
          { name: 'student', value: studentCountSnap.data().count },
          { name: 'instructor', value: instructorCountSnap.data().count },
          { name: 'admin', value: adminCountSnap.data().count },
        ].filter(x => x.value > 0));

        // Recent score sample for dashboard average (bounded for scale)
        let totalAccuracy = 0;
        recentSubsSnap.forEach(d => {
          totalAccuracy += d.data().accuracy || 0;
        });



        setStats({
          users: usersCountSnap.data().count,
          tests: testsCountSnap.data().count,
          submissions: submissionsCountSnap.data().count,
          avgScore: recentSubsSnap.size > 0 ? Math.round(totalAccuracy / recentSubsSnap.size) : 0,
        });
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.users, icon: <People />, color: '#6C63FF' },
    { label: 'Total Tests', value: stats.tests, icon: <Quiz />, color: '#10B981' },
    { label: 'Submissions', value: stats.submissions, icon: <Assessment />, color: '#F59E0B' },
    { label: 'Avg Score', value: `${stats.avgScore}%`, icon: <TrendingUp />, color: '#FF6584' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <DashboardLayout>
        <Typography variant="h4" sx={{ mb: 3 }}>Platform Analytics</Typography>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          {statCards.map((s, i) => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card sx={{ background: `linear-gradient(135deg, ${s.color}15, ${s.color}08)`, border: `1px solid ${s.color}20` }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${s.color}20`, color: s.color }}>{s.icon}</Box>
                    <Box>
                      <Typography variant="h5" fontWeight={700}>{loading ? <Skeleton width={40} /> : s.value}</Typography>
                      <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </m.div>
            </Grid>
          ))}
        </Grid>

        {loading ? (
          <Skeleton variant="rounded" height={350} />
        ) : (
          <Grid container spacing={3}>

            <Grid size={{ xs: 12 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>User Distribution</Typography>
                  {userRoles.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={userRoles} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {userRoles.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography color="text.secondary" textAlign="center" py={4}>No data yet</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
