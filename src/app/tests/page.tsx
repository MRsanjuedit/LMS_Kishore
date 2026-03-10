'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, TextField,
  FormControl, InputLabel, Select, MenuItem, Button, Skeleton,
  InputAdornment,
} from '@mui/material';
import { Search, Timer, Quiz, FilterList } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';

interface TestItem {
  id: string;
  title: string;
  topicId: string;
  topicName?: string;
  categoryName?: string;
  categoryId?: string;
  duration: number;
  questionCount: number;
  difficulty?: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function TestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const [testsSnap, catsSnap] = await Promise.all([
          getDocs(collection(db, 'tests')),
          getDocs(collection(db, 'categories')),
        ]);
        const testList: TestItem[] = [];
        testsSnap.forEach(doc => testList.push({ id: doc.id, ...doc.data() } as TestItem));
        setTests(testList);

        const catList: CategoryItem[] = [];
        catsSnap.forEach(doc => catList.push({ id: doc.id, ...doc.data() } as CategoryItem));
        setCategories(catList);
      } catch (err) {
        console.error('Error loading tests:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = tests.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.topicName || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || t.categoryId === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <DashboardLayout>
        <Box>
          <Typography variant="h4" sx={{ mb: 3 }}>Practice Tests</Typography>

          {/* Filters */}
          <Card sx={{ mb: 3, p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                placeholder="Search tests..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="small"
                sx={{ minWidth: 250 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
                }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Category</InputLabel>
                <Select value={filterCat} label="Category" onChange={e => setFilterCat(e.target.value)}
                  startAdornment={<FilterList sx={{ mr: 0.5 }} />}>
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
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
              <Grid container spacing={2}>
                {filtered.map((t) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                    <m.div variants={item}>
                      <Card sx={{ height: '100%', transition: '0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 } }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          <Typography variant="h6" sx={{ mb: 1 }}>{t.title}</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            {t.categoryName && <Chip label={t.categoryName} size="small" color="primary" variant="outlined" />}
                            {t.topicName && <Chip label={t.topicName} size="small" variant="outlined" />}
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
            </m.div>
          )}
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
