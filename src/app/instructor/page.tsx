'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Skeleton, Chip,
} from '@mui/material';
import { Add, Quiz, People, Analytics, ArrowForward } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';

export default function InstructorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ tests: 0, questions: 0, submissions: 0 });
  const [recentTests, setRecentTests] = useState<Array<{ id: string; title: string; questionCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const testsSnap = await getDocs(
          query(collection(db, 'tests'), where('createdBy', '==', user.uid))
        );
        const testIds: string[] = [];
        const testList: Array<{ id: string; title: string; questionCount: number }> = [];
        testsSnap.forEach(d => {
          testIds.push(d.id);
          testList.push({ id: d.id, title: d.data().title, questionCount: d.data().questionCount || 0 });
        });
        setRecentTests(testList.slice(0, 5));

        let totalQuestions = 0;
        let totalSubmissions = 0;

        for (const tid of testIds.slice(0, 10)) {
          const qSnap = await getDocs(query(collection(db, 'questions'), where('testId', '==', tid)));
          totalQuestions += qSnap.size;
          const sSnap = await getDocs(query(collection(db, 'submissions'), where('testId', '==', tid)));
          totalSubmissions += sSnap.size;
        }

        setStats({ tests: testIds.length, questions: totalQuestions, submissions: totalSubmissions });
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const statCards = [
    { label: 'My Tests', value: stats.tests, icon: <Quiz />, color: '#6C63FF' },
    { label: 'Questions', value: stats.questions, icon: <Quiz />, color: '#10B981' },
    { label: 'Submissions', value: stats.submissions, icon: <People />, color: '#F59E0B' },
  ];

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">Instructor Dashboard</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => router.push('/instructor/create-test')}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
              Create Test
            </Button>
          </Box>

          <m.div variants={container} initial="hidden" animate="show">
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {statCards.map((s, i) => (
                <Grid size={{ xs: 12, sm: 4 }} key={i}>
                  <m.div variants={item}>
                    <Card sx={{ background: `linear-gradient(135deg, ${s.color}15, ${s.color}08)`, border: `1px solid ${s.color}20` }}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${s.color}20`, color: s.color }}>{s.icon}</Box>
                        <Box>
                          <Typography variant="h5" fontWeight={700}>{loading ? <Skeleton width={40} /> : s.value}</Typography>
                          <Typography color="text.secondary" variant="body2">{s.label}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </m.div>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={3}>
              {/* Quick Actions */}
              <Grid size={{ xs: 12, md: 6 }}>
                <m.div variants={item}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2 }}>Quick Actions</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {[
                          { label: 'Create New Test', icon: <Add />, path: '/instructor/create-test' },
                          { label: 'View My Tests', icon: <Quiz />, path: '/instructor/tests' },
                          { label: 'View Analytics', icon: <Analytics />, path: '/instructor/analytics' },
                          { label: 'AI Question Generator', icon: <Quiz />, path: '/instructor/ai-generator' },
                        ].map((a, i) => (
                          <Button key={i} fullWidth variant="outlined" startIcon={a.icon}
                            endIcon={<ArrowForward />} onClick={() => router.push(a.path)}
                            sx={{ justifyContent: 'flex-start', '& .MuiButton-endIcon': { ml: 'auto' } }}>
                            {a.label}
                          </Button>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </m.div>
              </Grid>

              {/* Recent Tests */}
              <Grid size={{ xs: 12, md: 6 }}>
                <m.div variants={item}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2 }}>Recent Tests</Typography>
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={50} sx={{ mb: 1 }} />)
                      ) : recentTests.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">No tests created yet</Typography>
                          <Button variant="contained" sx={{ mt: 1 }} onClick={() => router.push('/instructor/create-test')}>
                            Create First Test
                          </Button>
                        </Box>
                      ) : (
                        recentTests.map(t => (
                          <Card key={t.id} variant="outlined" sx={{ mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            onClick={() => router.push(`/instructor/tests/${t.id}`)}>
                            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography fontWeight={600}>{t.title}</Typography>
                              <Chip label={`${t.questionCount} Qs`} size="small" />
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </m.div>
              </Grid>
            </Grid>
          </m.div>
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
