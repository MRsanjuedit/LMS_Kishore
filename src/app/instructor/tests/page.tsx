'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Skeleton, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select,
  MenuItem, Divider, Alert, ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material';
import {
  Delete, Visibility, Add, Quiz, School, Public, FilterList,
} from '@mui/icons-material';
import { motion as m, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface TestItem {
  id: string;
  title: string;
  duration: number;
  questionCount: number;
  status?: 'draft' | 'published';
  createdAt?: Date;
  targetColleges: string[];
  isGlobal: boolean;
}

interface CollegeOption {
  id: string;
  name: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function InstructorTestsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // colleges
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState<string>('');

  // view mode: 'college' = college-specific, 'global' = global tests
  const [viewMode, setViewMode] = useState<'college' | 'global'>('college');

  // For global tests: extra college filter to drill into data
  const [globalCollegeFilter, setGlobalCollegeFilter] = useState<string>('');

  // tests
  const [allTests, setAllTests] = useState<TestItem[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load colleges ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'colleges'));
        const list: CollegeOption[] = [];
        snap.forEach(d => { if (d.data().name) list.push({ id: d.id, name: d.data().name }); });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setColleges(list);
      } catch (err) { console.error(err); }
      setLoadingColleges(false);
    };
    load();
  }, []);

  // ── Load all instructor tests ──────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return;
    setLoadingTests(true);
    try {
      const snap = await getDocs(query(collection(db, 'tests'), where('createdBy', '==', user.uid)));
      const list: TestItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        const tc: string[] = data.targetColleges || [];
        list.push({
          id: d.id,
          title: data.title,
          duration: data.duration,
          status: data.status || 'published',
          questionCount: data.questionCount || 0,
          createdAt: data.createdAt?.toDate(),
          targetColleges: tc,
          isGlobal: tc.length === 0 || tc.includes('All'),
        });
      });
      setAllTests(list);
    } catch (err) { console.error('Error:', err); }
    setLoadingTests(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Derived lists ──────────────────────────────────────────────────────────
  // Tests for the selected college (non-global, explicitly targeted)
  const collegeTests = selectedCollege
    ? allTests.filter(t => !t.isGlobal && t.targetColleges.includes(selectedCollege))
    : [];

  // Global tests (shared to all / no college targeting)
  const globalTests = allTests.filter(t => t.isGlobal);

  // Global tests filtered by specific college (for data drilling)
  const globalTestsFiltered = globalCollegeFilter
    ? globalTests // global tests are visible to all, filter is just a label/context
    : globalTests;

  const displayedTests = viewMode === 'college' ? collegeTests : globalTestsFiltered;

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'tests', deleteId));
      const qSnap = await getDocs(query(collection(db, 'questions'), where('testId', '==', deleteId)));
      await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
      toast.success('Test deleted');
      setDeleteId(null);
      load();
    } catch {
      toast.error('Failed to delete test');
    }
    setDeleting(false);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const statusChip = (status?: string) => (
    <Chip
      label={status === 'draft' ? 'Draft' : 'Published'}
      size="small"
      color={status === 'draft' ? 'warning' : 'success'}
      variant={status === 'draft' ? 'outlined' : 'filled'}
    />
  );

  const TestsTable = ({ tests }: { tests: TestItem[] }) => (
    tests.length === 0 ? (
      <Card sx={{ borderRadius: 3, border: '2px dashed', borderColor: 'divider' }}>
        <CardContent sx={{ textAlign: 'center', py: 7 }}>
          <Quiz sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={600}>
            {viewMode === 'college'
              ? selectedCollege
                ? `No tests targeting "${selectedCollege}" yet`
                : 'Select a college above'
              : 'No global tests yet'}
          </Typography>
          {viewMode === 'college' && selectedCollege && (
            <Button variant="contained" sx={{ mt: 2, background: 'linear-gradient(135deg, #6C63FF, #8B85FF)', textTransform: 'none' }}
              onClick={() => router.push('/instructor/create-test')}>
              Create a Test for {selectedCollege}
            </Button>
          )}
        </CardContent>
      </Card>
    ) : (
      <m.div variants={container} initial="hidden" animate="show">
        <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,0.06)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9ff' }}>
                <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                {viewMode === 'global' && (
                  <TableCell sx={{ fontWeight: 700 }}>Scope</TableCell>
                )}
                {viewMode === 'college' && (
                  <TableCell sx={{ fontWeight: 700 }}>Colleges</TableCell>
                )}
                <TableCell align="center" sx={{ fontWeight: 700 }}>Duration</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Questions</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Created</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {tests.map(t => (
                  <TableRow
                    key={t.id}
                    component={m.tr}
                    variants={item}
                    hover
                    sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}
                  >
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography fontWeight={600} noWrap title={t.title}>{t.title}</Typography>
                    </TableCell>

                    {viewMode === 'global' && (
                      <TableCell>
                        <Chip label="Global" size="small" icon={<Public fontSize="small" />}
                          sx={{ bgcolor: '#6C63FF15', color: '#6C63FF', fontWeight: 600 }} />
                      </TableCell>
                    )}
                    {viewMode === 'college' && (
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {t.targetColleges.slice(0, 2).map(c => (
                            <Chip key={c} label={c} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          ))}
                          {t.targetColleges.length > 2 && (
                            <Chip label={`+${t.targetColleges.length - 2}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                    )}

                    <TableCell align="center">{t.duration} min</TableCell>
                    <TableCell align="center">{t.questionCount}</TableCell>
                    <TableCell align="center">{statusChip(t.status)}</TableCell>
                    <TableCell align="center">{t.createdAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) || '-'}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="View Report">
                          <Button size="small" startIcon={<Visibility />}
                            onClick={() => router.push(`/instructor/tests/${t.id}`)}
                            sx={{ textTransform: 'none', fontSize: 12 }}>
                            Report
                          </Button>
                        </Tooltip>
                        <Tooltip title="Delete Test">
                          <IconButton size="small" color="error" onClick={() => setDeleteId(t.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>
      </m.div>
    )
  );

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        {/* ── Header ── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ background: 'linear-gradient(135deg, #6C63FF, #FF6584)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Tests
            </Typography>
            <Typography color="text.secondary" variant="body2" mt={0.5}>
              Manage your college-specific and global tests
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => router.push('/instructor/create-test')}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)', borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 3, boxShadow: '0 4px 15px rgba(108,99,255,0.3)', '&:hover': { transform: 'translateY(-1px)' }, transition: 'all 0.2s' }}>
            Create Test
          </Button>
        </Box>

        {/* ── Stats bar ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Tests', value: allTests.length, color: '#6C63FF' },
            { label: 'Global Tests', value: globalTests.length, color: '#10B981', icon: <Public fontSize="small" /> },
            { label: 'College-Specific', value: allTests.length - globalTests.length, color: '#F59E0B', icon: <School fontSize="small" /> },
            { label: 'Published', value: allTests.filter(t => t.status === 'published').length, color: '#22c55e' },
          ].map((s, i) => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card sx={{ background: `linear-gradient(135deg, ${s.color}12, ${s.color}06)`, border: `1px solid ${s.color}25`, borderRadius: 3 }}>
                  <CardContent sx={{ py: 2, px: 2.5 }}>
                    <Typography variant="h5" fontWeight={800} color={s.color}>
                      {loadingTests ? <Skeleton width={40} /> : s.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>{s.label}</Typography>
                  </CardContent>
                </Card>
              </m.div>
            </Grid>
          ))}
        </Grid>

        {/* ── View Mode Toggle ── */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, val) => { if (val) { setViewMode(val); setGlobalCollegeFilter(''); } }}
                size="small"
                sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 2.5, borderRadius: '10px !important', border: '1px solid', borderColor: 'divider' } }}
              >
                <ToggleButton value="college" sx={{ gap: 0.5 }}>
                  <School fontSize="small" /> College Tests
                </ToggleButton>
                <ToggleButton value="global" sx={{ gap: 0.5 }}>
                  <Public fontSize="small" /> Global Tests
                </ToggleButton>
              </ToggleButtonGroup>

              {/* College selector — when in 'college' mode */}
              {viewMode === 'college' && (
                <FormControl size="small" sx={{ minWidth: 240 }}>
                  <InputLabel>Select College</InputLabel>
                  <Select
                    value={selectedCollege}
                    label="Select College"
                    onChange={e => setSelectedCollege(e.target.value)}
                    sx={{ borderRadius: 2 }}
                  >
                    {loadingColleges ? (
                      <MenuItem disabled>Loading…</MenuItem>
                    ) : colleges.length === 0 ? (
                      <MenuItem disabled>No colleges found</MenuItem>
                    ) : (
                      colleges.map(c => (
                        <MenuItem key={c.id} value={c.name}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <School fontSize="small" sx={{ color: '#6C63FF' }} /> {c.name}
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              )}

              {/* College filter — when in 'global' mode */}
              {viewMode === 'global' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <FilterList sx={{ color: 'text.disabled', fontSize: 18 }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>Filter by College:</Typography>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>All Colleges</InputLabel>
                    <Select
                      value={globalCollegeFilter}
                      label="All Colleges"
                      onChange={e => setGlobalCollegeFilter(e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="">
                        <em>All Colleges</em>
                      </MenuItem>
                      <Divider />
                      {colleges.map(c => (
                        <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {globalCollegeFilter && (
                    <Chip
                      label={`Viewing as: ${globalCollegeFilter}`}
                      size="small"
                      onDelete={() => setGlobalCollegeFilter('')}
                      sx={{ bgcolor: '#6C63FF15', color: '#6C63FF', fontWeight: 600 }}
                    />
                  )}
                </Box>
              )}
            </Box>

            {/* Info banners */}
            {viewMode === 'college' && selectedCollege && (
              <Alert severity="info" icon={<School fontSize="small" />} sx={{ mt: 2, borderRadius: 2, py: 0.5 }}>
                Showing tests specifically targeted to <strong>{selectedCollege}</strong> — {collegeTests.length} test{collegeTests.length !== 1 ? 's' : ''} found
              </Alert>
            )}
            {viewMode === 'global' && (
              <Alert severity="success" icon={<Public fontSize="small" />} sx={{ mt: 2, borderRadius: 2, py: 0.5 }}>
                Global tests are visible to <strong>all students</strong> regardless of college.
                {globalCollegeFilter && ` Filtering context: ${globalCollegeFilter}.`}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* ── Tests Table ── */}
        {loadingTests ? (
          <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
        ) : (
          <TestsTable tests={displayedTests} />
        )}

        {/* ── Delete Dialog ── */}
        <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}
          PaperProps={{ sx: { borderRadius: 4, minWidth: 360, p: 1 } }}>
          <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Delete Test?</DialogTitle>
          <Divider />
          <DialogContent>
            <Typography>This will permanently delete the test and all its questions. This cannot be undone.</Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => setDeleteId(null)} sx={{ textTransform: 'none', borderRadius: 2 }}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700, px: 3 }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
