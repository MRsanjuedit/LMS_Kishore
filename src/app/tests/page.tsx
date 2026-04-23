'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, TextField,
  FormControl, InputLabel, Select, MenuItem, Button, Skeleton,
  InputAdornment,
} from '@mui/material';
import { Search, Timer, Quiz, FilterList } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCachedOrFetch, getSWRData } from '@/lib/dataCache';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';

interface TestItem {
  id: string;
  title: string;
  duration: number;
  questionCount: number;
  difficulty?: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const TESTS_PAGE_SIZE = 24;
const TESTS_CACHE_TTL = 3 * 60 * 1000;

export default function TestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const testsFetcher = async (): Promise<{ tests: TestItem[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {
        try {
          const testsSnap = await getDocs(
            query(
              collection(db, 'tests'),
              where('status', '==', 'published'),
              orderBy('createdAt', 'desc'),
              limit(TESTS_PAGE_SIZE)
            )
          );
          const testList: TestItem[] = [];
          testsSnap.forEach(doc => testList.push({ id: doc.id, ...doc.data() } as TestItem));
          const docs = testsSnap.docs;
          return {
            tests: testList,
            cursor: docs.length > 0 ? docs[docs.length - 1] : null,
            hasMore: docs.length === TESTS_PAGE_SIZE,
          };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes('currently building')) {
            console.warn('Firestore index still building — using fallback query until ready.');
          } else {
            console.error('Error loading published tests (falling back):', err);
          }
          const fallbackSnap = await getDocs(query(collection(db, 'tests'), orderBy('createdAt', 'desc'), limit(TESTS_PAGE_SIZE)));
          const publishedOnly: TestItem[] = [];
          fallbackSnap.forEach((docSnap) => {
            const data = docSnap.data() as TestItem & { status?: string };
            if ((data.status || 'published') === 'published') {
              const { id: _ignoredId, ...rest } = data as TestItem & { id?: string; status?: string };
              publishedOnly.push({ id: docSnap.id, ...rest });
            }
          });
          return {
            tests: publishedOnly,
            cursor: fallbackSnap.docs.length > 0 ? fallbackSnap.docs[fallbackSnap.docs.length - 1] : null,
            hasMore: fallbackSnap.docs.length === TESTS_PAGE_SIZE,
          };
        }
      };

      const applyTests = (payload: { tests: TestItem[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }) => {
        setTests(payload.tests);
        setCursor(payload.cursor);
        setHasMore(payload.hasMore);
      };

      const cachedTests = getSWRData('tests_page_latest', TESTS_CACHE_TTL, testsFetcher, applyTests);

      if (cachedTests !== null) applyTests(cachedTests);

      if (cachedTests !== null) {
        setLoading(false);
        return;
      }

      try {
        const testsData = await (cachedTests === null
            ? getCachedOrFetch('tests_page_latest', TESTS_CACHE_TTL, testsFetcher)
            : Promise.resolve(cachedTests));

        applyTests(testsData);
      } catch (fallbackErr) {
        console.error('Error loading tests:', fallbackErr);
      }
      setLoading(false);
    };
    load();
  }, []);

  const loadMoreTests = async () => {
    if (!hasMore || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextQ = query(
        collection(db, 'tests'),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(TESTS_PAGE_SIZE)
      );
      const nextSnap = await getDocs(nextQ);
      const nextList: TestItem[] = [];
      nextSnap.forEach(doc => nextList.push({ id: doc.id, ...doc.data() } as TestItem));
      setTests(prev => [...prev, ...nextList]);
      const docs = nextSnap.docs;
      if (docs.length > 0) {
        setCursor(docs[docs.length - 1]);
      }
      setHasMore(docs.length === TESTS_PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more published tests (fallback):', err);
      try {
        const fallbackSnap = await getDocs(
          query(collection(db, 'tests'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(TESTS_PAGE_SIZE))
        );
        const publishedOnly: TestItem[] = [];
        fallbackSnap.forEach((docSnap) => {
          const data = docSnap.data() as TestItem & { status?: string };
          if ((data.status || 'published') === 'published') {
            const { id: _ignoredId, ...rest } = data as TestItem & { id?: string; status?: string };
            publishedOnly.push({ id: docSnap.id, ...rest });
          }
        });
        setTests(prev => [...prev, ...publishedOnly]);
        const docs = fallbackSnap.docs;
        if (docs.length > 0) {
          setCursor(docs[docs.length - 1]);
        }
        setHasMore(docs.length === TESTS_PAGE_SIZE);
      } catch (fallbackErr) {
        console.error('Error loading more tests:', fallbackErr);
      }
    }
    setLoadingMore(false);
  };

  const filtered = tests.filter(t => {
    return t.title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Practice Tests</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Browse, filter, and start tests tailored to your learning goals.
            </Typography>
          </Box>

          {/* Filters */}
          <Card sx={{ mb: 3, p: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                placeholder="Search tests..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="small"
                sx={{ minWidth: { xs: '100%', sm: 250 }, flex: { sm: 1 } }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
                }}
              />
            </Box>
          </Card>

          {/* Tests Grid */}
          {loading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                  <Skeleton variant="rounded" height={180} />
                </Grid>
              ))}
            </Grid>
          ) : filtered.length === 0 ? (
            <Card><CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Quiz sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">No tests found</Typography>
              <Typography color="text.secondary">Try adjusting your search or filters</Typography>
            </CardContent></Card>
          ) : (
            <m.div variants={container} initial="hidden" animate="show">
              <Grid container spacing={2.5}>
                {filtered.map((t) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                    <m.div variants={item}>
                      <Card sx={{ height: '100%', transition: '0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 } }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          <Typography variant="h6" sx={{ mb: 1 }}>{t.title}</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>

                            {t.difficulty && (
                              <Chip label={t.difficulty} size="small"
                                color={t.difficulty === 'Easy' ? 'success' : t.difficulty === 'Hard' ? 'error' : 'warning'} />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 2, color: 'text.secondary', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Timer sx={{ fontSize: 16 }} /> {t.duration} min
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Quiz sx={{ fontSize: 16 }} /> {t.questionCount || '?'} Qs
                            </Box>
                          </Box>
                          <Box sx={{ mt: 'auto' }}>
                            <Button fullWidth variant="contained" onClick={() => router.push(`/tests/${t.id}`)}
                              sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                              Start Test
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </m.div>
                  </Grid>
                ))}
              </Grid>
              {hasMore && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <Button onClick={loadMoreTests} disabled={loadingMore} variant="outlined">
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </Button>
                </Box>
              )}
            </m.div>
          )}
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
