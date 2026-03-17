'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  LinearProgress, Skeleton, Avatar, IconButton, alpha,
} from '@mui/material';
import {
  Quiz, TrendingUp, EmojiEvents, Timer, ArrowForward,
  PlayArrow, CalendarToday, Speed,
} from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCachedOrFetch, getSWRData } from '@/lib/dataCache';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';

const TESTS_CACHE_TTL = 5 * 60 * 1000;   // 5 min
const RESULTS_CACHE_TTL = 30 * 1000;     // 30 s (user-specific, changes often)

interface TestItem {
  id: string;
  title: string;
  topicId: string;
  topicName?: string;
  categoryName?: string;
  duration: number;
  questionCount: number;
  description?: string;
}

interface RecentResult {
  id: string;
  testTitle: string;
  score: number;
  total: number;
  accuracy: number;
  timeTaken: number;
  createdAt?: Date | string | number | null;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } } };

const toDate = (value: RecentResult['createdAt']): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const normalizeResults = (list: RecentResult[]): RecentResult[] =>
  list.map((result) => ({ ...result, createdAt: toDate(result.createdAt) }));

const formatResultDate = (value: RecentResult['createdAt']): string => {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [results, setResults] = useState<RecentResult[]>([]);
  const [stats, setStats] = useState({ totalTests: 0, avgAccuracy: 0, bestScore: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // ── fetcher helpers ────────────────────────────────────────────
    const testsFetcher = async (): Promise<TestItem[]> => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'tests'),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc'),
            limit(6)
          )
        );
        const list: TestItem[] = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as TestItem));
        return list;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (!errMsg.includes('currently building')) {
          console.error('Error loading published tests (falling back):', err);
        }
        const fallbackSnap = await getDocs(
          query(collection(db, 'tests'), orderBy('createdAt', 'desc'), limit(20))
        );
        const publishedOnly: TestItem[] = [];
        fallbackSnap.forEach((docSnap) => {
          const data = docSnap.data() as TestItem & { status?: string };
          if ((data.status || 'published') === 'published') {
            const { id: _ignoredId, ...rest } = data as TestItem & { id?: string; status?: string };
            publishedOnly.push({ id: docSnap.id, ...rest });
          }
        });
        return publishedOnly.slice(0, 6);
      }
    };

    const resultsFetcher = async (): Promise<RecentResult[]> => {
      const snap = await getDocs(
        query(
          collection(db, 'submissions'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
      );
      const list: RecentResult[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({
          id: doc.id,
          testTitle: d.testTitle || 'Test',
          score: d.score,
          total: d.total,
          accuracy: d.accuracy,
          timeTaken: d.timeTaken,
          createdAt: d.createdAt?.toDate(),
        });
      });
      return list;
    };

    const applyResults = (list: RecentResult[]) => {
      const normalized = normalizeResults(list);
      setResults(normalized);
      if (normalized.length > 0) {
        const avgAcc = normalized.reduce((sum, result) => sum + result.accuracy, 0) / normalized.length;
        const best = Math.max(...normalized.map((result) => result.accuracy));
        setStats({ totalTests: normalized.length, avgAccuracy: Math.round(avgAcc), bestScore: Math.round(best) });
      }
    };

    const RESULTS_KEY = `dashboard_results_${user.uid}`;

    // ── all state updates happen inside the async function ─────────
    const load = async () => {
      // stale-while-revalidate: serve cached data instantly
      const cachedTests = getSWRData('dashboard_tests_latest_6', TESTS_CACHE_TTL, testsFetcher, setTests);
      const cachedResults = getSWRData(RESULTS_KEY, RESULTS_CACHE_TTL, resultsFetcher, applyResults);

      if (cachedTests !== null) setTests(cachedTests);
      if (cachedResults !== null) applyResults(cachedResults);

      // If both served from cache → no spinner needed
      if (cachedTests !== null && cachedResults !== null) {
        setLoading(false);
        return;
      }

      // parallel fetch for any missing data
      try {
        await Promise.all([
          cachedTests === null
            ? getCachedOrFetch('dashboard_tests_latest_6', TESTS_CACHE_TTL, testsFetcher).then(setTests)
            : Promise.resolve(),
          cachedResults === null
            ? getCachedOrFetch(RESULTS_KEY, RESULTS_CACHE_TTL, resultsFetcher).then(applyResults)
            : Promise.resolve(),
        ]);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      }
      setLoading(false);
    };
    void load();
  }, [user]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const statCards = [
    {
      label: 'Tests Completed',
      value: stats.totalTests,
      icon: <Quiz sx={{ fontSize: 28 }} />,
      gradient: 'linear-gradient(135deg, #6C63FF, #8B85FF)',
      shadowColor: 'rgba(108, 99, 255, 0.3)',
      bgLight: '#EDE9FF',
    },
    {
      label: 'Avg Accuracy',
      value: `${stats.avgAccuracy}%`,
      icon: <Speed sx={{ fontSize: 28 }} />,
      gradient: 'linear-gradient(135deg, #10B981, #34D399)',
      shadowColor: 'rgba(16, 185, 129, 0.3)',
      bgLight: '#D1FAE5',
    },
    {
      label: 'Best Score',
      value: `${stats.bestScore}%`,
      icon: <EmojiEvents sx={{ fontSize: 28 }} />,
      gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
      shadowColor: 'rgba(245, 158, 11, 0.3)',
      bgLight: '#FEF3C7',
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          {/* Welcome Banner */}
          <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Box sx={{
              mb: 4, p: { xs: 3, md: 4 }, borderRadius: 4,
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Decorative circles */}
              <Box sx={{ position: 'absolute', right: -30, top: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(108,99,255,0.1)' }} />
              <Box sx={{ position: 'absolute', right: 60, bottom: -50, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,101,132,0.08)' }} />
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5, fontWeight: 500 }}>
                  {greeting()} 👋
                </Typography>
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, mb: 1, letterSpacing: '-0.5px' }}>
                  Welcome back, {profile?.name?.split(' ')[0] || 'Student'}!
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, maxWidth: 500 }}>
                  Continue your learning journey. You&apos;ve completed {stats.totalTests} test{stats.totalTests !== 1 ? 's' : ''} so far.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => router.push('/tests')}
                  sx={{
                    mt: 2.5, borderRadius: '12px', textTransform: 'none', fontWeight: 600, px: 3, py: 1,
                    background: 'linear-gradient(135deg, #6C63FF, #8B85FF)',
                    boxShadow: '0 4px 15px rgba(108,99,255,0.4)',
                    '&:hover': { boxShadow: '0 6px 20px rgba(108,99,255,0.5)' },
                  }}
                >
                  Take a Test
                </Button>
              </Box>
            </Box>
          </m.div>

          {/* Stats */}
          <m.div variants={container} initial="hidden" animate="show">
            <Grid container spacing={2.5} sx={{ mb: 4 }}>
              {statCards.map((s, i) => (
                <Grid size={{ xs: 6, md: 3 }} key={i}>
                  <m.div variants={item}>
                    <Card sx={{
                      borderRadius: 3, border: 'none', boxShadow: 'none',
                      background: '#fff',
                      transition: 'all 0.3s ease',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 12px 30px ${s.shadowColor}` },
                    }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{
                          width: 48, height: 48, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: s.gradient, color: '#fff', mb: 2,
                          boxShadow: `0 4px 12px ${s.shadowColor}`,
                        }}>
                          {s.icon}
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1a1a2e', lineHeight: 1, mb: 0.5 }}>
                          {loading ? <Skeleton width={60} /> : s.value}
                        </Typography>
                        <Typography sx={{ color: '#999', fontSize: 13, fontWeight: 500 }}>{s.label}</Typography>
                      </CardContent>
                    </Card>
                  </m.div>
                </Grid>
              ))}
            </Grid>
          </m.div>

          {/* Available Tests */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a2e' }}>Available Tests</Typography>
              <Typography variant="body2" sx={{ color: '#999' }}>Pick a test to practice</Typography>
            </Box>
            <Button
              endIcon={<ArrowForward />}
              onClick={() => router.push('/tests')}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, color: '#6C63FF' }}
            >
              View All
            </Button>
          </Box>
          <m.div variants={container} initial="hidden" animate="show">
            <Grid container spacing={2.5} sx={{ mb: 4 }}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                    <Card sx={{ borderRadius: 3 }}><CardContent><Skeleton height={120} /></CardContent></Card>
                  </Grid>
                ))
              ) : tests.length === 0 ? (
                <Grid size={{ xs: 12 }}>
                  <Card sx={{ borderRadius: 3, border: '2px dashed #e0e0e0', boxShadow: 'none', bgcolor: 'transparent' }}>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                      <Quiz sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                      <Typography color="text.secondary" fontWeight={500}>No tests available yet</Typography>
                      <Typography variant="body2" color="text.secondary">Check back later for new tests!</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ) : (
                tests.map((t, idx) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                    <m.div variants={item}>
                      <Card
                        sx={{
                          borderRadius: 3, cursor: 'pointer', boxShadow: 'none', border: '1px solid #f0f0f0',
                          transition: 'all 0.3s ease', position: 'relative', overflow: 'visible',
                          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 30px rgba(0,0,0,0.08)', borderColor: '#6C63FF30' },
                        }}
                        onClick={() => router.push(`/tests/${t.id}`)}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box sx={{
                              width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: `linear-gradient(135deg, ${['#6C63FF', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6'][idx % 6]}15, ${['#6C63FF', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6'][idx % 6]}08)`,
                              color: ['#6C63FF', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6'][idx % 6],
                            }}>
                              <Quiz />
                            </Box>
                            <IconButton size="small" sx={{ color: '#6C63FF' }}>
                              <ArrowForward sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                          <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 1, color: '#1a1a2e' }}>{t.title}</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            {t.categoryName && (
                              <Chip label={t.categoryName} size="small"
                                sx={{ fontSize: 11, fontWeight: 600, height: 24, bgcolor: '#6C63FF12', color: '#6C63FF', border: 'none' }} />
                            )}
                            {t.topicName && (
                              <Chip label={t.topicName} size="small"
                                sx={{ fontSize: 11, fontWeight: 600, height: 24, bgcolor: '#f5f5f5', color: '#888' }} />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 3, color: '#aaa', fontSize: 13 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Timer sx={{ fontSize: 16 }} /> {t.duration}m
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Quiz sx={{ fontSize: 16 }} /> {t.questionCount || '?'} Q
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </m.div>
                  </Grid>
                ))
              )}
            </Grid>
          </m.div>

          {/* Recent Results */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a2e' }}>Recent Results</Typography>
              <Typography variant="body2" sx={{ color: '#999' }}>Your latest test performances</Typography>
            </Box>
            {results.length > 0 && (
              <Button
                endIcon={<ArrowForward />}
                onClick={() => router.push('/results')}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, color: '#6C63FF' }}
              >
                View All
              </Button>
            )}
          </Box>
          {loading ? (
            <Skeleton height={200} sx={{ borderRadius: 3 }} />
          ) : results.length === 0 ? (
            <Card sx={{ borderRadius: 3, border: '2px dashed #e0e0e0', boxShadow: 'none', bgcolor: 'transparent' }}>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <TrendingUp sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                <Typography color="text.secondary" fontWeight={500}>No results yet</Typography>
                <Typography variant="body2" color="text.secondary">Take your first test to see your performance here!</Typography>
              </CardContent>
            </Card>
          ) : (
            <m.div variants={container} initial="hidden" animate="show">
              <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                {results.map((r, idx) => (
                  <m.div key={r.id} variants={item}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2,
                      p: 2.5, borderBottom: idx < results.length - 1 ? '1px solid #f5f5f5' : 'none',
                      transition: 'background 0.2s',
                      '&:hover': { bgcolor: '#fafafa' },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{
                          width: 44, height: 44, borderRadius: '12px', fontSize: 14, fontWeight: 700,
                          bgcolor: r.accuracy >= 80 ? alpha('#10B981', 0.1) : r.accuracy >= 50 ? alpha('#F59E0B', 0.1) : alpha('#EF4444', 0.1),
                          color: r.accuracy >= 80 ? '#10B981' : r.accuracy >= 50 ? '#F59E0B' : '#EF4444',
                        }}>
                          {r.accuracy}%
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e' }}>{r.testTitle}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                            <CalendarToday sx={{ fontSize: 12, color: '#bbb' }} />
                            <Typography variant="caption" sx={{ color: '#aaa' }}>
                              {formatResultDate(r.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontSize: 11, color: '#bbb', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Score</Typography>
                          <Typography sx={{ fontWeight: 700, color: '#1a1a2e' }}>{r.score}/{r.total}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                          <Typography sx={{ fontSize: 11, color: '#bbb', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Accuracy</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={r.accuracy}
                            sx={{
                              height: 6, borderRadius: 3, bgcolor: '#f0f0f0',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: r.accuracy >= 80
                                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                                  : r.accuracy >= 50
                                  ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                                  : 'linear-gradient(90deg, #EF4444, #F87171)',
                              },
                            }}
                          />
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontSize: 11, color: '#bbb', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Time</Typography>
                          <Typography sx={{ fontWeight: 700, color: '#1a1a2e' }}>{r.timeTaken}m</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </m.div>
                ))}
              </Card>
            </m.div>
          )}
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
