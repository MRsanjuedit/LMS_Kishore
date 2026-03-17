'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Skeleton,
} from '@mui/material';
import { People, Quiz, TrendingUp, EmojiEvents } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

export default function InstructorAnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [testPerformance, setTestPerformance] = useState<Array<{ name: string; avg: number; count: number }>>([]);
  const [stats, setStats] = useState({ totalTests: 0, totalSubmissions: 0, avgScore: 0, topScore: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Both queries are independent — run in parallel
        const [testsSnap, subsSnap] = await Promise.all([
          getDocs(query(collection(db, 'tests'), where('createdBy', '==', user.uid))),
          getDocs(
            query(
              collection(db, 'submissions'),
              where('instructorId', '==', user.uid),
              limit(2000)
            )
          ),
        ]);

        const testMap: Record<string, string> = {};
        testsSnap.forEach(d => { testMap[d.id] = d.data().title; });

        const allSubs: Array<{ testId: string; accuracy: number }> = [];
        if (subsSnap.empty && Object.keys(testMap).length > 0) {
          const idChunks = chunkArray(Object.keys(testMap), 10);
          // All fallback chunks in parallel
          const chunkSnaps = await Promise.all(
            idChunks.map(ids =>
              getDocs(query(collection(db, 'submissions'), where('testId', 'in', ids)))
            )
          );
          chunkSnaps.forEach(snap => {
            snap.forEach(docSnap => {
              const data = docSnap.data();
              allSubs.push({ testId: data.testId, accuracy: data.accuracy || 0 });
            });
          });
        }
        subsSnap.forEach(d => {
          const data = d.data();
          allSubs.push({ testId: data.testId, accuracy: data.accuracy || 0 });
        });

        // Per-test performance
        const perf: Record<string, { total: number; count: number }> = {};
        allSubs.forEach(s => {
          if (!perf[s.testId]) perf[s.testId] = { total: 0, count: 0 };
          perf[s.testId].total += s.accuracy;
          perf[s.testId].count++;
        });

        const testPerfData = Object.entries(perf).map(([tid, v]) => ({
          name: (testMap[tid] || 'Test').slice(0, 20),
          avg: Math.round(v.total / v.count),
          count: v.count,
        }));
        setTestPerformance(testPerfData);

        const totalSubs = allSubs.length;
        const avgScore = totalSubs > 0 ? Math.round(allSubs.reduce((s, x) => s + x.accuracy, 0) / totalSubs) : 0;
        const topScore = totalSubs > 0 ? Math.max(...allSubs.map(s => s.accuracy)) : 0;

        setStats({
          totalTests: Object.keys(testMap).length,
          totalSubmissions: totalSubs,
          avgScore,
          topScore,
        });
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const statCards = [
    { label: 'Total Tests', value: stats.totalTests, icon: <Quiz />, color: '#6C63FF' },
    { label: 'Total Submissions', value: stats.totalSubmissions, icon: <People />, color: '#10B981' },
    { label: 'Avg Class Score', value: `${stats.avgScore}%`, icon: <TrendingUp />, color: '#F59E0B' },
    { label: 'Top Score', value: `${stats.topScore}%`, icon: <EmojiEvents />, color: '#FF6584' },
  ];

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Typography variant="h4" sx={{ mb: 3 }}>Instructor Analytics</Typography>

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
          <Skeleton variant="rounded" height={300} />
        ) : testPerformance.length > 0 ? (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Average Score Per Test</Typography>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={testPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis domain={[0, 100]} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#6C63FF" radius={[6, 6, 0, 0]} name="Avg Score %" />
                      <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} name="Submissions" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography color="text.secondary">
                No submissions yet. Share your tests with students to see analytics.
              </Typography>
            </CardContent>
          </Card>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
