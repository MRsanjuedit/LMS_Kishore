'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Skeleton,
  FormControl, InputLabel, Select, MenuItem, Divider,
  Chip, Alert,
} from '@mui/material';
import { People, Quiz, TrendingUp, EmojiEvents, School, ArrowForward } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface CollegeOption { id: string; name: string; }
interface TestOption { id: string; title: string; targetColleges: string[]; }

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function InstructorAnalyticsPage() {
  const { user } = useAuth();

  // Step 1 — colleges
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [loadingColleges, setLoadingColleges] = useState(true);

  // Step 2 — tests filtered by college
  const [allTests, setAllTests] = useState<TestOption[]>([]);
  const [filteredTests, setFilteredTests] = useState<TestOption[]>([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [loadingTests, setLoadingTests] = useState(false);

  // Analytics results
  const [loading, setLoading] = useState(false);
  const [testPerformance, setTestPerformance] = useState<Array<{ name: string; avg: number; count: number }>>([]);
  const [stats, setStats] = useState({ totalTests: 0, totalSubmissions: 0, avgScore: 0, topScore: 0 });

  // Load colleges
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'colleges')));
        const list: CollegeOption[] = [];
        snap.forEach(d => { if (d.data().name) list.push({ id: d.id, name: d.data().name }); });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setColleges(list);
      } catch (err) { console.error(err); }
      setLoadingColleges(false);
    };
    load();
  }, []);

  // Load all instructor tests once
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingTests(true);
      try {
        const snap = await getDocs(query(collection(db, 'tests'), where('createdBy', '==', user.uid)));
        const list: TestOption[] = [];
        snap.forEach(d => list.push({ id: d.id, title: d.data().title || 'Untitled', targetColleges: d.data().targetColleges || [] }));
        setAllTests(list);
      } catch (err) { console.error(err); }
      setLoadingTests(false);
    };
    load();
  }, [user]);

  // Filter tests when college changes
  useEffect(() => {
    if (!selectedCollege) { setFilteredTests([]); setSelectedTest(''); return; }
    const filtered = allTests.filter(t =>
      t.targetColleges.includes(selectedCollege) || t.targetColleges.includes('All')
    );
    setFilteredTests(filtered);
    setSelectedTest('');
    setTestPerformance([]);
    setStats({ totalTests: 0, totalSubmissions: 0, avgScore: 0, topScore: 0 });
  }, [selectedCollege, allTests]);

  // Load analytics when test changes
  useEffect(() => {
    if (!selectedTest || !user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [testsSnap, subsSnap] = await Promise.all([
          getDocs(query(collection(db, 'tests'), where('createdBy', '==', user.uid))),
          getDocs(query(collection(db, 'submissions'), where('testId', '==', selectedTest), limit(2000))),
        ]);

        const testMap: Record<string, string> = {};
        testsSnap.forEach(d => { testMap[d.id] = d.data().title; });

        const allSubs: Array<{ testId: string; accuracy: number }> = [];
        subsSnap.forEach(d => { const data = d.data(); allSubs.push({ testId: data.testId, accuracy: data.accuracy || 0 }); });

        // if no subs by testId index try batch
        if (allSubs.length === 0 && Object.keys(testMap).length > 0) {
          const idChunks = chunkArray(Object.keys(testMap), 10);
          const chunkSnaps = await Promise.all(idChunks.map(ids => getDocs(query(collection(db, 'submissions'), where('testId', 'in', ids)))));
          chunkSnaps.forEach(snap => { snap.forEach(docSnap => { const d = docSnap.data(); allSubs.push({ testId: d.testId, accuracy: d.accuracy || 0 }); }); });
        }

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
        setStats({ totalTests: Object.keys(testMap).length, totalSubmissions: totalSubs, avgScore, topScore });
      } catch (err) { console.error('Error:', err); }
      setLoading(false);
    };
    load();
  }, [selectedTest, user]);

  const statCards = [
    { label: 'Total Tests', value: stats.totalTests, icon: <Quiz />, color: '#6C63FF' },
    { label: 'Total Submissions', value: stats.totalSubmissions, icon: <People />, color: '#10B981' },
    { label: 'Avg Class Score', value: `${stats.avgScore}%`, icon: <TrendingUp />, color: '#F59E0B' },
    { label: 'Top Score', value: `${stats.topScore}%`, icon: <EmojiEvents />, color: '#FF6584' },
  ];

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={800} sx={{ background: 'linear-gradient(135deg, #6C63FF, #FF6584)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Student Analytics
          </Typography>
          <Typography color="text.secondary" variant="body2" mt={0.5}>
            Select a college and then a test to view performance data
          </Typography>
        </Box>

        {/* Step 1 & 2: Selectors */}
        <m.div variants={container} initial="hidden" animate="show">
          <Grid container spacing={3} sx={{ mb: 4 }} alignItems="stretch">
            {/* College Selector */}
            <Grid size={{ xs: 12, md: 5 }}>
              <m.div variants={item}>
                <Card sx={{ borderRadius: 3, border: selectedCollege ? '2px solid #6C63FF40' : '1px solid', borderColor: selectedCollege ? '#6C63FF40' : 'divider', height: '100%' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#6C63FF15', color: '#6C63FF' }}><School fontSize="small" /></Box>
                      <Typography fontWeight={700}>Step 1 — Select College</Typography>
                    </Box>
                    <FormControl fullWidth>
                      <InputLabel>Choose College</InputLabel>
                      <Select
                        value={selectedCollege}
                        label="Choose College"
                        onChange={e => setSelectedCollege(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        {loadingColleges ? (
                          <MenuItem disabled>Loading colleges…</MenuItem>
                        ) : colleges.length === 0 ? (
                          <MenuItem disabled>No colleges found</MenuItem>
                        ) : (
                          colleges.map(c => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)
                        )}
                      </Select>
                    </FormControl>
                    {selectedCollege && (
                      <Chip label={selectedCollege} size="small" icon={<School fontSize="small" />}
                        sx={{ mt: 1.5, bgcolor: '#6C63FF15', color: '#6C63FF', fontWeight: 600 }} />
                    )}
                  </CardContent>
                </Card>
              </m.div>
            </Grid>

            {/* Arrow */}
            <Grid size={{ xs: 12, md: 'auto' }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowForward sx={{ color: selectedCollege ? '#6C63FF' : 'text.disabled', fontSize: 32, transition: '0.3s' }} />
            </Grid>

            {/* Test Selector */}
            <Grid size={{ xs: 12, md: 6 }}>
              <m.div variants={item}>
                <Card sx={{ borderRadius: 3, border: selectedTest ? '2px solid #10B98140' : '1px solid', borderColor: selectedTest ? '#10B98140' : 'divider', height: '100%', opacity: selectedCollege ? 1 : 0.5, transition: '0.3s' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#10B98115', color: '#10B981' }}><Quiz fontSize="small" /></Box>
                      <Typography fontWeight={700}>Step 2 — Select Test</Typography>
                    </Box>
                    <FormControl fullWidth disabled={!selectedCollege}>
                      <InputLabel>Choose Test</InputLabel>
                      <Select
                        value={selectedTest}
                        label="Choose Test"
                        onChange={e => setSelectedTest(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        {loadingTests ? (
                          <MenuItem disabled>Loading tests…</MenuItem>
                        ) : filteredTests.length === 0 ? (
                          <MenuItem disabled>{selectedCollege ? 'No tests for this college' : 'Select a college first'}</MenuItem>
                        ) : (
                          filteredTests.map(t => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)
                        )}
                      </Select>
                    </FormControl>
                    {selectedCollege && filteredTests.length === 0 && !loadingTests && (
                      <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2, py: 0.5 }}>
                        No tests found for {selectedCollege}. Create tests and target this college.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </m.div>
            </Grid>
          </Grid>
        </m.div>

        {/* Stats */}
        {selectedTest && (
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {statCards.map((s, i) => (
                <Grid size={{ xs: 6, md: 3 }} key={i}>
                  <Card sx={{ background: `linear-gradient(135deg, ${s.color}15, ${s.color}08)`, border: `1px solid ${s.color}20`, borderRadius: 3 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${s.color}20`, color: s.color }}>{s.icon}</Box>
                      <Box>
                        <Typography variant="h5" fontWeight={700}>{loading ? <Skeleton width={40} /> : s.value}</Typography>
                        <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {loading ? (
              <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
            ) : testPerformance.length > 0 ? (
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Average Score Per Test</Typography>
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
            ) : (
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <Typography color="text.secondary">No submissions yet for this test. Share it with students.</Typography>
                </CardContent>
              </Card>
            )}
          </m.div>
        )}

        {/* Empty state */}
        {!selectedTest && !selectedCollege && (
          <Box sx={{ textAlign: 'center', py: 10, opacity: 0.5 }}>
            <School sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">Select a college to get started</Typography>
          </Box>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
