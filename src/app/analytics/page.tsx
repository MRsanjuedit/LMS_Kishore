'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Skeleton,
} from '@mui/material';
import { TrendingUp, TrendingDown, EmojiEvents, Quiz } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

const COLORS = ['#6C63FF', '#FF6584', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6'];

interface AnalyticsData {
  scoreHistory: { date: string; accuracy: number; score: number }[];
  topicPerformance: { topic: string; accuracy: number; count: number }[];
  difficultyBreakdown: { name: string; value: number }[];
  totalTests: number;
  avgAccuracy: number;
  bestAccuracy: number;
  improvement: number;
  weakAreas: string[];
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'submissions'),
            where('userId', '==', user.uid)
          )
        );

        const submissions: Array<{
          testId: string; testTitle: string; score: number; total: number;
          accuracy: number; timeTaken: number; createdAt: Date;
          topicName?: string; categoryName?: string;
        }> = [];

        snap.forEach(d => {
          const dd = d.data();
          submissions.push({
            testId: dd.testId,
            testTitle: dd.testTitle,
            score: dd.score,
            total: dd.total,
            accuracy: dd.accuracy,
            timeTaken: dd.timeTaken,
            createdAt: dd.createdAt?.toDate(),
            topicName: dd.topicName,
            categoryName: dd.categoryName,
          });
        });

        submissions.sort((a, b) => {
          const aTime = a.createdAt?.getTime() ?? 0;
          const bTime = b.createdAt?.getTime() ?? 0;
          return aTime - bTime;
        });

        // Score history
        const scoreHistory = submissions.map((s, i) => ({
          date: s.createdAt?.toLocaleDateString() || `Test ${i + 1}`,
          accuracy: s.accuracy,
          score: s.total > 0 ? Math.round((s.score / s.total) * 100) : 0,
        }));

        // Topic performance
        const topicMap: Record<string, { total: number; correct: number; count: number }> = {};
        submissions.forEach(s => {
          const topic = s.topicName || s.testTitle || 'Unknown';
          if (!topicMap[topic]) topicMap[topic] = { total: 0, correct: 0, count: 0 };
          topicMap[topic].total += s.total;
          topicMap[topic].correct += s.score;
          topicMap[topic].count++;
        });
        const topicPerformance = Object.entries(topicMap).map(([topic, v]) => ({
          topic: topic.length > 15 ? topic.slice(0, 15) + '...' : topic,
          accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
          count: v.count,
        }));

        // Difficulty breakdown
        let easy = 0, medium = 0, hard = 0;
        submissions.forEach(s => {
          if (s.accuracy >= 80) easy++;
          else if (s.accuracy >= 50) medium++;
          else hard++;
        });
        const difficultyBreakdown = [
          { name: 'High Score (≥80%)', value: easy },
          { name: 'Medium (50-80%)', value: medium },
          { name: 'Low (<50%)', value: hard },
        ].filter(d => d.value > 0);

        // Stats
        const totalTests = submissions.length;
        const avgAccuracy = totalTests > 0
          ? Math.round(submissions.reduce((s, x) => s + x.accuracy, 0) / totalTests) : 0;
        const bestAccuracy = totalTests > 0
          ? Math.max(...submissions.map(s => s.accuracy)) : 0;

        // Improvement (last 5 vs first 5)
        let improvement = 0;
        if (submissions.length >= 2) {
          const firstHalf = submissions.slice(0, Math.ceil(submissions.length / 2));
          const secondHalf = submissions.slice(Math.ceil(submissions.length / 2));
          const firstAvg = firstHalf.reduce((s, x) => s + x.accuracy, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((s, x) => s + x.accuracy, 0) / secondHalf.length;
          improvement = Math.round(secondAvg - firstAvg);
        }

        // Weak areas
        const weakAreas = topicPerformance
          .filter(t => t.accuracy < 60)
          .sort((a, b) => a.accuracy - b.accuracy)
          .map(t => t.topic);

        setData({
          scoreHistory, topicPerformance, difficultyBreakdown,
          totalTests, avgAccuracy, bestAccuracy, improvement, weakAreas,
        });
      } catch (err) {
        console.error('Error loading analytics:', err);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <DashboardLayout>
          <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>Analytics</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Track your learning trends, strengths, and areas to improve.
              </Typography>
            </Box>
          <Grid container spacing={3}>
            {[1,2,3,4].map(i => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                <Skeleton variant="rounded" height={120} />
              </Grid>
            ))}
            <Grid size={{ xs: 12 }}><Skeleton variant="rounded" height={300} /></Grid>
          </Grid>
          </Box>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!data || data.totalTests === 0) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <DashboardLayout>
          <Box sx={{ maxWidth: 1080, mx: 'auto', textAlign: 'center', py: 10 }}>
            <Quiz sx={{ fontSize: 80, color: 'text.disabled' }} />
            <Typography variant="h5" color="text.secondary" sx={{ mt: 2 }}>No analytics yet</Typography>
            <Typography color="text.secondary">Take some tests to see your performance analytics</Typography>
          </Box>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const stats = [
    { label: 'Tests Taken', value: data.totalTests, icon: <Quiz />, color: '#6C63FF' },
    { label: 'Avg Accuracy', value: `${data.avgAccuracy}%`, icon: <TrendingUp />, color: '#10B981' },
    { label: 'Best Score', value: `${data.bestAccuracy}%`, icon: <EmojiEvents />, color: '#F59E0B' },
    {
      label: 'Improvement', value: `${data.improvement > 0 ? '+' : ''}${data.improvement}%`,
      icon: data.improvement >= 0 ? <TrendingUp /> : <TrendingDown />,
      color: data.improvement >= 0 ? '#10B981' : '#EF4444',
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Analytics</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Track your learning trends, strengths, and areas to improve.
          </Typography>
        </Box>

        <m.div variants={container} initial="hidden" animate="show">
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {stats.map((s, i) => (
              <Grid size={{ xs: 6, md: 3 }} key={i}>
                <m.div variants={item}>
                  <Card sx={{ background: `linear-gradient(135deg, ${s.color}12, ${s.color}06)`, border: `1px solid ${s.color}25` }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${s.color}20`, color: s.color }}>{s.icon}</Box>
                      <Box>
                        <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                        <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </m.div>
              </Grid>
            ))}
          </Grid>

          {/* Score Trend */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <m.div variants={item}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Score Trend</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data.scoreHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis domain={[0, 100]} fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="accuracy" stroke="#6C63FF" strokeWidth={3} dot={{ r: 5, fill: '#6C63FF' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </m.div>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <m.div variants={item}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Performance Distribution</Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={data.difficultyBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={80} label>
                          {data.difficultyBreakdown.map((_, i) => (
                            <Cell key={i} fill={['#10B981', '#F59E0B', '#EF4444'][i]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </m.div>
            </Grid>
          </Grid>

          {/* Topic Performance */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <m.div variants={item}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Topic-wise Performance</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.topicPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="topic" fontSize={12} />
                        <YAxis domain={[0, 100]} fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="accuracy" fill="#6C63FF" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </m.div>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <m.div variants={item}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Weak Areas</Typography>
                    {data.weakAreas.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <EmojiEvents sx={{ fontSize: 40, color: '#F59E0B' }} />
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                          No major weak areas detected!
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {data.weakAreas.map((area, i) => (
                          <Chip key={i} label={area} color="error" variant="outlined" />
                        ))}
                      </Box>
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
