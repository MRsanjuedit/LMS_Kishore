'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip, Grid,
  CircularProgress, List, ListItem, ListItemIcon, ListItemText,
  Skeleton, Alert,
} from '@mui/material';
import { Psychology, TrendingDown, Lightbulb, Refresh } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

interface AIInsight {
  weakTopics: string[];
  recommendations: string[];
  summary: string;
  source?: 'ai' | 'local';
}

export default function AIInsightsPage() {
  const { user } = useAuth();
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [submissionsData, setSubmissionsData] = useState<Array<{ testTitle: string; score: number; total: number; accuracy: number }>>([]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'submissions'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
          )
        );
        const subs: Array<{ testTitle: string; score: number; total: number; accuracy: number }> = [];
        snap.forEach(d => {
          const data = d.data();
          subs.push({ testTitle: data.testTitle || 'Unknown', score: data.score, total: data.total, accuracy: data.accuracy });
        });
        setSubmissionsData(subs);
        setHasData(subs.length > 0);
      } catch (err) {
        console.error('Error loading submissions:', err);
      }
      setDataLoading(false);
    };
    check();
  }, [user]);

  // Load cached insights on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('ai-insights');
      if (cached) setInsight(JSON.parse(cached));
    } catch { /* ignore */ }
  }, []);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissions: submissionsData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInsight(data as AIInsight);
      sessionStorage.setItem('ai-insights', JSON.stringify(data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate insights.';
      toast.error(msg);
    }
    setLoading(false);
  };

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>AI Insights</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              AI-powered analysis of your performance with personalized recommendations.
            </Typography>
          </Box>

          {dataLoading ? (
            <Skeleton variant="rounded" height={300} />
          ) : !hasData ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <Psychology sx={{ fontSize: 80, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                  Take some tests first to get AI insights
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              {!insight && (
                <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card sx={{ textAlign: 'center', py: { xs: 3, sm: 6 } }}>
                    <CardContent sx={{ px: { xs: 2, sm: 3 } }}>
                      <Psychology sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Ready to analyze your performance
                      </Typography>
                      <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Our AI will analyze your test history and identify areas for improvement
                      </Typography>
                      <Button
                        variant="contained" size="large"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Psychology />}
                        onClick={generateInsights}
                        disabled={loading}
                        sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
                      >
                        {loading ? 'Analyzing...' : 'Generate AI Insights'}
                      </Button>
                    </CardContent>
                  </Card>
                </m.div>
              )}

              {insight && (
                <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Alert severity={insight.source === 'ai' ? 'info' : 'warning'} sx={{ mb: 3 }}>
                    {insight.source === 'ai'
                      ? 'These insights are generated by AI based on your test history.'
                      : 'These insights are generated from your test data analysis (AI quota exceeded).'}
                  </Alert>

                  <Grid container spacing={3}>
                    {/* Summary */}
                    <Grid size={{ xs: 12 }}>
                      <Card sx={{ background: 'linear-gradient(135deg, #6C63FF10, #FF658410)' }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                          <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Lightbulb color="primary" /> Performance Summary
                          </Typography>
                          <Typography>{insight.summary}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Weak Topics */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingDown color="error" /> Weak Areas
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {insight.weakTopics.map((t, i) => (
                              <Chip key={i} label={t} color="error" variant="outlined" />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Recommendations */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Lightbulb color="warning" /> Recommendations
                          </Typography>
                          <List dense>
                            {insight.recommendations.map((r, i) => (
                              <ListItem key={i} sx={{ px: 0 }}>
                                <ListItemIcon sx={{ minWidth: 28 }}>
                                  <Typography fontWeight={700} color="primary">{i + 1}.</Typography>
                                </ListItemIcon>
                                <ListItemText primary={r} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 3, textAlign: 'center' }}>
                    <Button startIcon={<Refresh />} onClick={generateInsights} disabled={loading}>
                      Regenerate Insights
                    </Button>
                  </Box>
                </m.div>
              )}
            </>
          )}
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
