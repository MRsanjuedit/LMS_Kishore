'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Skeleton, FormControl, InputLabel, Select,
  MenuItem, Alert, Divider, Avatar, Tooltip,
} from '@mui/material';
import { ArrowBack, Download, Public, School, FilterList, People } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface SubmissionRow {
  id: string;
  userId: string;
  studentName: string;
  college: string;
  score: number;
  total: number;
  accuracy: number;
  timeTaken: number;
  createdAt: unknown;
}

interface CollegeOption {
  id: string;
  name: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function InstructorTestDetailPage() {
  const { testId } = useParams();
  const router = useRouter();

  const [test, setTest] = useState<Record<string, unknown> | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGlobal, setIsGlobal] = useState(false);

  // College filter (only relevant for global tests)
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [selectedCollege, setSelectedCollege] = useState('');

  // ── Load test + submissions ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!testId) return;
      try {
        // 1. Test document
        const testDoc = await getDoc(doc(db, 'tests', testId as string));
        if (!testDoc.exists()) { setLoading(false); return; }
        const testData = { id: testDoc.id, ...testDoc.data() };
        setTest(testData);

        const tc: string[] = (testData.targetColleges as string[]) || [];
        const global = tc.length === 0 || tc.includes('All');
        setIsGlobal(global);

        // 2. Submissions
        const sSnap = await getDocs(query(collection(db, 'submissions'), where('testId', '==', testId)));
        const rawSubs: Array<Record<string, unknown>> = [];
        sSnap.forEach(d => rawSubs.push({ id: d.id, ...d.data() }));

        // 3. Unique user IDs
        const userIds = Array.from(new Set(rawSubs.map(s => String(s.userId || '')).filter(Boolean)));

        // 4. Batch fetch user profiles
        const usersMap: Record<string, { name: string; college: string }> = {};
        const chunkSize = 10;
        for (let i = 0; i < userIds.length; i += chunkSize) {
          const chunk = userIds.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async uid => {
              try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const d = userDoc.exists() ? userDoc.data() : null;
                usersMap[uid] = {
                  name: (d?.name as string) || uid.slice(0, 8),
                  college: (d?.college as string) || 'Unknown',
                };
              } catch {
                usersMap[uid] = { name: uid.slice(0, 8), college: 'Unknown' };
              }
            })
          );
        }

        // 5. Assemble rows
        const rows: SubmissionRow[] = rawSubs.map(s => ({
          id: String(s.id),
          userId: String(s.userId || ''),
          studentName: usersMap[String(s.userId || '')]?.name || 'Student',
          college: usersMap[String(s.userId || '')]?.college || 'Unknown',
          score: Number(s.score || 0),
          total: Number(s.total || 0),
          accuracy: Number(s.accuracy || 0),
          timeTaken: Number(s.timeTaken || 0),
          createdAt: s.createdAt,
        }));
        rows.sort((a, b) => b.accuracy - a.accuracy);
        setSubmissions(rows);

        // 6. For global tests: derive unique colleges from submissions
        if (global) {
          const uniqueColleges = Array.from(new Set(rows.map(r => r.college).filter(c => c && c !== 'Unknown')))
            .sort()
            .map((name, i) => ({ id: String(i), name }));
          setColleges(uniqueColleges);
        }
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, [testId]);

  // ── Filtered submissions ────────────────────────────────────────────────────
  const displayedSubmissions = useMemo(() => {
    if (!isGlobal || !selectedCollege) return submissions;
    return submissions.filter(s => s.college === selectedCollege);
  }, [submissions, selectedCollege, isGlobal]);

  // ── Per-college breakdown for global tests ──────────────────────────────────
  const collegeBreakdown = useMemo(() => {
    if (!isGlobal) return [];
    const map: Record<string, { count: number; totalAccuracy: number; passed: number }> = {};
    submissions.forEach(s => {
      if (!map[s.college]) map[s.college] = { count: 0, totalAccuracy: 0, passed: 0 };
      map[s.college].count++;
      map[s.college].totalAccuracy += s.accuracy;
      if (s.accuracy >= 50) map[s.college].passed++;
    });
    return Object.entries(map)
      .map(([college, data]) => ({
        college,
        count: data.count,
        avg: Math.round(data.totalAccuracy / data.count),
        passRate: Math.round((data.passed / data.count) * 100),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [submissions, isGlobal]);

  // ── Stats (based on displayed subset) ──────────────────────────────────────
  const avgScore = displayedSubmissions.length > 0
    ? Math.round(displayedSubmissions.reduce((s, x) => s + x.accuracy, 0) / displayedSubmissions.length)
    : 0;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const formatDate = (value: unknown) => {
    if (!value) return '-';
    if (value instanceof Date) return value.toLocaleString('en-IN');
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate().toLocaleString('en-IN');
    }
    return '-';
  };

  const handleDownload = () => {
    if (displayedSubmissions.length === 0) return;
    const headers = isGlobal
      ? ['Student', 'College', 'Score', 'Total', 'Accuracy (%)', 'Time (min)', 'Submitted At']
      : ['Student', 'Score', 'Total', 'Accuracy (%)', 'Time (min)', 'Submitted At'];
    const rows = displayedSubmissions.map(s =>
      isGlobal
        ? [s.studentName, s.college, s.score, s.total, s.accuracy, s.timeTaken, formatDate(s.createdAt)]
        : [s.studentName, s.score, s.total, s.accuracy, s.timeTaken, formatDate(s.createdAt)]
    );
    const tableHtml = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${String(v).replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const blob = new Blob([`\ufeff${tableHtml}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = ((test?.title as string) || 'report').replace(/[^a-z0-9 _-]/gi, '').trim().replace(/\s+/g, '-').toLowerCase();
    a.href = url;
    a.download = `${safeTitle}${selectedCollege ? `-${selectedCollege.replace(/\s+/g, '-')}` : ''}-report.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Skeleton height={60} sx={{ mb: 2 }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3].map(i => <Grid size={{ xs: 4 }} key={i}><Skeleton variant="rounded" height={100} /></Grid>)}
        </Grid>
        <Skeleton variant="rounded" height={350} />
      </DashboardLayout>
    </ProtectedRoute>
  );

  if (!test) return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/instructor/tests')} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="error">Test not found.</Alert>
      </DashboardLayout>
    </ProtectedRoute>
  );

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* ── Back + Title ── */}
          <Button startIcon={<ArrowBack />} onClick={() => router.push('/instructor/tests')} sx={{ mb: 2, textTransform: 'none', borderRadius: 2 }}>
            Back to Tests
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="h4" fontWeight={800}>
              {(test?.title as string) || 'Test'}
            </Typography>
            {isGlobal ? (
              <Chip label="Global" icon={<Public fontSize="small" />}
                sx={{ bgcolor: '#6C63FF15', color: '#6C63FF', fontWeight: 700 }} />
            ) : (
              <Chip label="College-Specific" icon={<School fontSize="small" />}
                sx={{ bgcolor: '#10B98115', color: '#10B981', fontWeight: 700 }} />
            )}
          </Box>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
            {(test?.description as string) || 'Test report and student performance data'}
          </Typography>

          {/* ── Stats ── */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Questions', value: Number(test?.questionCount || 0), color: '#6C63FF' },
              { label: selectedCollege ? `Submissions (${selectedCollege})` : 'Total Submissions', value: displayedSubmissions.length, color: '#10B981' },
              { label: selectedCollege ? `Avg Score (${selectedCollege})` : 'Avg Score', value: `${avgScore}%`, color: '#F59E0B' },
              ...(isGlobal ? [{ label: 'Colleges Attempted', value: collegeBreakdown.length, color: '#FF6584' }] : []),
            ].map((s, i) => (
              <Grid size={{ xs: 6, md: 3 }} key={i}>
                <Card sx={{ background: `linear-gradient(135deg, ${s.color}15, ${s.color}06)`, border: `1px solid ${s.color}20`, borderRadius: 3 }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                    <Typography color="text.secondary" variant="body2">{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* ── College Breakdown (global tests only) ── */}
          {isGlobal && collegeBreakdown.length > 0 && (
            <Card sx={{ mb: 3, borderRadius: 3, border: '1px solid #6C63FF20' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <People sx={{ color: '#6C63FF' }} />
                  <Typography variant="h6" fontWeight={700}>Performance by College</Typography>
                </Box>
                <m.div variants={container} initial="hidden" animate="show">
                  <Grid container spacing={1.5}>
                    {collegeBreakdown.map(cb => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cb.college}>
                        <m.div variants={item}>
                          <Box
                            onClick={() => setSelectedCollege(prev => prev === cb.college ? '' : cb.college)}
                            sx={{
                              p: 2, borderRadius: 2, cursor: 'pointer',
                              border: '1px solid',
                              borderColor: selectedCollege === cb.college ? '#6C63FF' : 'divider',
                              bgcolor: selectedCollege === cb.college ? '#6C63FF08' : 'transparent',
                              transition: '0.2s',
                              '&:hover': { borderColor: '#6C63FF60', bgcolor: '#6C63FF06' },
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Avatar sx={{ width: 28, height: 28, bgcolor: '#6C63FF20', color: '#6C63FF', fontSize: 13 }}>
                                  <School fontSize="small" />
                                </Avatar>
                                <Typography fontWeight={700} fontSize={13} noWrap sx={{ maxWidth: 130 }} title={cb.college}>
                                  {cb.college}
                                </Typography>
                              </Box>
                              {selectedCollege === cb.college && (
                                <Chip label="Active" size="small" sx={{ bgcolor: '#6C63FF', color: '#fff', fontSize: 10, height: 18 }} />
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip label={`${cb.count} student${cb.count !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                              <Chip label={`Avg ${cb.avg}%`} size="small"
                                color={cb.avg >= 80 ? 'success' : cb.avg >= 50 ? 'warning' : 'error'} />
                              <Chip label={`Pass ${cb.passRate}%`} size="small" variant="outlined" />
                            </Box>
                          </Box>
                        </m.div>
                      </Grid>
                    ))}
                  </Grid>
                </m.div>
              </CardContent>
            </Card>
          )}

          {/* ── Student Table Section ── */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={700}>Student Reports</Typography>

                {/* College filter dropdown — only for global tests */}
                {isGlobal && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FilterList sx={{ color: 'text.disabled', fontSize: 18 }} />
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Filter by College</InputLabel>
                      <Select
                        value={selectedCollege}
                        label="Filter by College"
                        onChange={e => setSelectedCollege(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value=""><em>All Colleges</em></MenuItem>
                        <Divider />
                        {colleges.map(c => (
                          <MenuItem key={c.id} value={c.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <School fontSize="small" sx={{ color: '#6C63FF', fontSize: 16 }} /> {c.name}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {selectedCollege && (
                      <Chip label={selectedCollege} size="small" onDelete={() => setSelectedCollege('')}
                        icon={<School fontSize="small" />}
                        sx={{ bgcolor: '#6C63FF15', color: '#6C63FF', fontWeight: 600 }} />
                    )}
                  </Box>
                )}
              </Box>

              <Button variant="outlined" size="small" startIcon={<Download />}
                onClick={handleDownload} disabled={displayedSubmissions.length === 0}
                sx={{ textTransform: 'none', borderRadius: 2 }}>
                Download{selectedCollege ? ` (${selectedCollege})` : ''} Excel
              </Button>
            </Box>

            {isGlobal && selectedCollege && (
              <Alert severity="info" icon={<School fontSize="small" />} sx={{ mb: 2, borderRadius: 2, py: 0.5 }}>
                Showing <strong>{displayedSubmissions.length}</strong> submission{displayedSubmissions.length !== 1 ? 's' : ''} from <strong>{selectedCollege}</strong>. Avg score: <strong>{avgScore}%</strong>
              </Alert>
            )}

            {displayedSubmissions.length === 0 ? (
              <Card sx={{ borderRadius: 3, border: '2px dashed', borderColor: 'divider' }}>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <People sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                  <Typography color="text.secondary" fontWeight={600}>
                    {selectedCollege ? `No students from "${selectedCollege}" have attempted this test yet.` : 'No student attempts yet for this test.'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <m.div variants={container} initial="hidden" animate="show">
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8f9ff' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                        {isGlobal && <TableCell sx={{ fontWeight: 700 }}>College</TableCell>}
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Score</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Accuracy</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Time</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Submitted At</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayedSubmissions.map(s => (
                        <TableRow
                          key={s.id}
                          component={m.tr}
                          variants={item}
                          hover
                          sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#6C63FF20', color: '#6C63FF' }}>
                                {s.studentName.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography fontWeight={600} fontSize={13}>{s.studentName}</Typography>
                            </Box>
                          </TableCell>
                          {isGlobal && (
                            <TableCell>
                              <Chip label={s.college} size="small" icon={<School fontSize="small" />}
                                variant="outlined" sx={{ fontSize: 11 }} />
                            </TableCell>
                          )}
                          <TableCell align="center">{s.score}/{s.total}</TableCell>
                          <TableCell align="center">
                            <Chip label={`${s.accuracy}%`} size="small"
                              color={s.accuracy >= 80 ? 'success' : s.accuracy >= 50 ? 'warning' : 'error'} />
                          </TableCell>
                          <TableCell align="center">{s.timeTaken} min</TableCell>
                          <TableCell align="center">
                            <Tooltip title={formatDate(s.createdAt)} arrow>
                              <Typography variant="caption" color="text.secondary">
                                {s.createdAt
                                  ? typeof s.createdAt === 'object' && 'toDate' in (s.createdAt as object)
                                    ? (s.createdAt as { toDate: () => Date }).toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                    : '-'
                                  : '-'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </m.div>
            )}
          </Box>
        </m.div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
