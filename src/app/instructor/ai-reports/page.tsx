'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button,
  CircularProgress, Chip, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import {
  Assessment, TrendingUp, TrendingDown, People,
  CheckCircle, Psychology, EmojiEvents,
  School, Lightbulb,
} from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

interface CollegeOption {
  id: string;
  name: string;
}

interface TestOption {
  id: string;
  title: string;
  targetColleges: string[];
}

interface AIReport {
  overview: string;
  averageScore: number;
  passRate: number;
  hardestQuestions: Array<{
    questionNumber: number;
    questionText: string;
    correctRate: number;
    insight: string;
  }>;
  easiestQuestions: Array<{
    questionNumber: number;
    questionText: string;
    correctRate: number;
    insight: string;
  }>;
  difficultyAnalysis: Record<string, { count: number; avgCorrectRate: number }>;
  recommendations: string[];
  studentPerformanceBands: Record<string, { range: string; count: number }>;
  keyInsights: string[];
}

interface StudentRow {
  userId: string;
  name: string;
  email: string;
  attempts: number;
  averageAccuracy: number;
  bestAccuracy: number;
  latestAccuracy: number;
  latestScore: number;
  latestTotal: number;
  lastSubmittedAt?: number;
}

interface StudentReportItem {
  userId: string;
  name: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendation: string;
}

interface SubmissionRecord {
  id: string;
  userId?: string;
  score?: number;
  total?: number;
  accuracy?: number;
  createdAt?: { toMillis?: () => number; toDate?: () => Date };
}

const PASS_THRESHOLD = 50;

function chunkArray<T>(input: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    output.push(input.slice(i, i + size));
  }
  return output;
}

function buildStudentReport(row: StudentRow): StudentReportItem {
  const progressDelta = row.latestAccuracy - row.averageAccuracy;
  const trendLabel = progressDelta >= 5 ? 'improving' : progressDelta <= -5 ? 'declining' : 'steady';
  const passState = row.averageAccuracy >= PASS_THRESHOLD ? 'meeting expected performance' : 'below expected performance';

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (row.bestAccuracy >= 80) strengths.push('Shows strong high-score potential on at least one attempt');
  if (row.attempts >= 2) strengths.push('Demonstrates persistence through repeated attempts');
  if (row.latestAccuracy >= row.averageAccuracy) strengths.push('Recent attempt is aligned with or above average performance');

  if (row.averageAccuracy < 60) improvements.push('Needs stronger concept revision to improve baseline accuracy');
  if (row.latestAccuracy < row.averageAccuracy) improvements.push('Recent score dropped below average and needs quick review');
  if (row.attempts === 1) improvements.push('Only one attempt recorded; more attempts would improve confidence in trend');

  if (strengths.length === 0) strengths.push('Participated and submitted attempts for this test');
  if (improvements.length === 0) improvements.push('Can target faster completion while maintaining accuracy');

  const recommendation = row.averageAccuracy < 60
    ? 'Assign remedial practice on weak concepts and schedule a re-attempt after guided revision.'
    : row.averageAccuracy < 80
    ? 'Provide mixed-difficulty practice and focus on reducing avoidable errors.'
    : 'Provide advanced challenge questions and timed practice to maintain high performance.';

  return {
    userId: row.userId,
    name: row.name,
    summary: `${row.name} is ${passState} with an average accuracy of ${row.averageAccuracy}% across ${row.attempts} attempt${row.attempts > 1 ? 's' : ''}. Recent performance is ${trendLabel} (latest ${row.latestAccuracy}%).`,
    strengths,
    improvements,
    recommendation,
  };
}

export default function AIReportsPage() {
  const { user } = useAuth();
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [filteredTests, setFilteredTests] = useState<TestOption[]>([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<AIReport | null>(null);
  const [testMeta, setTestMeta] = useState<{ questionCount: number; submissionCount: number } | null>(null);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [studentReports, setStudentReports] = useState<StudentReportItem[]>([]);

  // Load colleges
  useEffect(() => {
    const loadColleges = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'colleges')));
        const list: CollegeOption[] = [];
        snap.forEach(d => { if (d.data().name) list.push({ id: d.id, name: d.data().name }); });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setColleges(list);
      } catch (err) { console.error('Error loading colleges:', err); }
      setLoadingColleges(false);
    };
    loadColleges();
  }, []);

  // Load instructor tests
  useEffect(() => {
    const loadTests = async () => {
      if (!user) return;
      try {
        const snap = await getDocs(
          query(collection(db, 'tests'), where('createdBy', '==', user.uid))
        );
        const t: TestOption[] = [];
        snap.forEach(d => t.push({ id: d.id, title: (d.data().title as string) || 'Untitled', targetColleges: d.data().targetColleges || [] }));
        setTests(t);
      } catch (err) {
        console.error('Error loading tests:', err);
      }
      setLoading(false);
    };
    loadTests();
  }, [user]);

  // Filter tests when college changes
  useEffect(() => {
    if (!selectedCollege) { setFilteredTests([]); setSelectedTest(''); setReport(null); return; }
    const filtered = tests.filter(t =>
      t.targetColleges.includes(selectedCollege) || t.targetColleges.includes('All')
    );
    setFilteredTests(filtered);
    setSelectedTest('');
    setReport(null);
    setStudentRows([]);
    setStudentReports([]);
  }, [selectedCollege, tests]);

  const buildPerStudentData = async (submissions: SubmissionRecord[]) => {
    const validSubs = submissions.filter((s) => !!s.userId);
    const userIds = Array.from(new Set(validSubs.map((s) => s.userId as string)));

    const usersMap: Record<string, { name: string; email: string }> = {};
    const idChunks = chunkArray(userIds, 10);
    for (const idChunk of idChunks) {
      const usersSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', idChunk)));
      usersSnap.forEach((docSnap) => {
        const data = docSnap.data() as { name?: string; email?: string };
        usersMap[docSnap.id] = {
          name: data.name || 'Student',
          email: data.email || 'N/A',
        };
      });
    }

    const grouped: Record<string, SubmissionRecord[]> = {};
    validSubs.forEach((submission) => {
      const key = submission.userId as string;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(submission);
    });

    const rows: StudentRow[] = Object.entries(grouped).map(([uid, items]) => {
      const sorted = [...items].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      const latest = sorted[0];
      const accuracies = sorted.map((s) => s.accuracy || 0);
      const bestAccuracy = accuracies.length > 0 ? Math.max(...accuracies) : 0;
      const averageAccuracy = accuracies.length > 0
        ? Math.round(accuracies.reduce((sum, val) => sum + val, 0) / accuracies.length)
        : 0;

      return {
        userId: uid,
        name: usersMap[uid]?.name || 'Student',
        email: usersMap[uid]?.email || 'N/A',
        attempts: sorted.length,
        averageAccuracy,
        bestAccuracy,
        latestAccuracy: latest?.accuracy || 0,
        latestScore: latest?.score || 0,
        latestTotal: latest?.total || 0,
        lastSubmittedAt: latest?.createdAt?.toMillis?.() || 0,
      };
    }).sort((a, b) => (b.lastSubmittedAt || 0) - (a.lastSubmittedAt || 0));

    setStudentRows(rows);
    setStudentReports(rows.map(buildStudentReport));
  };

  const handleGenerate = async () => {
    if (!selectedTest) {
      toast.error('Please select a test');
      return;
    }
    setGenerating(true);
    setReport(null);
    setStudentRows([]);
    setStudentReports([]);
    try {
      const test = tests.find(t => t.id === selectedTest);

      const qSnap = await getDocs(
        query(collection(db, 'questions'), where('testId', '==', selectedTest))
      );
      const questions: Array<Record<string, unknown>> = [];
      qSnap.forEach(d => questions.push({ id: d.id, ...d.data() }));

      const sSnap = await getDocs(
        query(collection(db, 'submissions'), where('testId', '==', selectedTest))
      );
      const submissions: SubmissionRecord[] = [];
      sSnap.forEach(d => submissions.push({ id: d.id, ...d.data() }));

      setTestMeta({ questionCount: questions.length, submissionCount: submissions.length });

      if (submissions.length === 0) {
        toast.error('No submissions yet for this test. Students need to take the test first.');
        setGenerating(false);
        return;
      }

      await buildPerStudentData(submissions);

      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testTitle: test?.title,
          questions,
          submissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.report);
      toast.success('AI Report generated!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report';
      toast.error(msg);
    }
    setGenerating(false);
  };

  const getBandColor = (band: string) => {
    const colors: Record<string, string> = {
      excellent: '#4caf50', good: '#2196f3', average: '#ff9800', needsImprovement: '#f44336',
    };
    return colors[band] || '#9e9e9e';
  };

  const getBandLabel = (band: string) => {
    const labels: Record<string, string> = {
      excellent: 'Excellent', good: 'Good', average: 'Average', needsImprovement: 'Needs Improvement',
    };
    return labels[band] || band;
  };

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Assessment sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight={700}>AI Reports</Typography>
          </Box>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Get AI-powered analysis and insights on your test performance data
          </Typography>

          {/* Two-Step Selector: College → Test */}
          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Select College &amp; Test to Analyze</Typography>
              <Grid container spacing={2} alignItems="center">
                {/* College */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <School fontSize="small" sx={{ color: '#6C63FF' }} />
                    <Typography variant="body2" fontWeight={600} color="text.secondary">Step 1 — College</Typography>
                  </Box>
                  <FormControl fullWidth>
                    <InputLabel>Choose College</InputLabel>
                    <Select
                      value={selectedCollege}
                      label="Choose College"
                      onChange={e => setSelectedCollege(e.target.value)}
                    >
                      {loadingColleges ? (
                        <MenuItem disabled>Loading…</MenuItem>
                      ) : colleges.length === 0 ? (
                        <MenuItem disabled>No colleges found</MenuItem>
                      ) : (
                        colleges.map(c => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Arrow */}
                <Grid size={{ xs: 12, sm: 'auto' }} sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                  <Assessment sx={{ color: selectedCollege ? 'primary.main' : 'text.disabled', fontSize: 28, transition: '0.3s' }} />
                </Grid>

                {/* Test */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Assessment fontSize="small" sx={{ color: '#10B981' }} />
                    <Typography variant="body2" fontWeight={600} color="text.secondary">Step 2 — Test</Typography>
                  </Box>
                  <FormControl fullWidth disabled={!selectedCollege}>
                    <InputLabel>Choose Test</InputLabel>
                    <Select
                      value={selectedTest}
                      label="Choose Test"
                      onChange={e => { setSelectedTest(e.target.value); setReport(null); }}
                    >
                      {loading ? (
                        <MenuItem disabled>Loading tests...</MenuItem>
                      ) : filteredTests.length === 0 ? (
                        <MenuItem disabled>{selectedCollege ? 'No tests for this college' : 'Select a college first'}</MenuItem>
                      ) : (
                        filteredTests.map(t => (
                          <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Generate button */}
                <Grid size={{ xs: 12, sm: 'auto' }} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    fullWidth variant="contained" size="large"
                    startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <Psychology />}
                    onClick={handleGenerate}
                    disabled={generating || !selectedTest || !selectedCollege}
                    sx={{ py: 1.8, background: 'linear-gradient(135deg, #6C63FF, #8B85FF)', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {generating ? 'Analyzing...' : 'Generate Report'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Loading State */}
          {generating && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                AI is analyzing {testMeta?.submissionCount} submissions across {testMeta?.questionCount} questions...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This may take a few seconds
              </Typography>
            </Box>
          )}

          {/* Report */}
          {report && !generating && (
            <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Overview */}
              <Card sx={{ mb: 3, border: '1px solid', borderColor: 'primary.main', borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Lightbulb sx={{ color: '#ff9800' }} />
                    <Typography variant="h6" fontWeight={700}>Executive Summary</Typography>
                  </Box>
                  <Typography sx={{ lineHeight: 1.8, color: 'text.secondary' }}>
                    {report.overview}
                  </Typography>
                </CardContent>
              </Card>

              {/* Key Stats */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Card sx={{ textAlign: 'center', borderRadius: 3 }}>
                    <CardContent>
                      <School sx={{ fontSize: 36, color: '#6C63FF', mb: 1 }} />
                      <Typography variant="h4" fontWeight={700}>{testMeta?.submissionCount}</Typography>
                      <Typography variant="body2" color="text.secondary">Students</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Card sx={{ textAlign: 'center', borderRadius: 3 }}>
                    <CardContent>
                      <Assessment sx={{ fontSize: 36, color: '#2196f3', mb: 1 }} />
                      <Typography variant="h4" fontWeight={700}>{report.averageScore}%</Typography>
                      <Typography variant="body2" color="text.secondary">Avg Score</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Card sx={{ textAlign: 'center', borderRadius: 3 }}>
                    <CardContent>
                      <CheckCircle sx={{ fontSize: 36, color: '#4caf50', mb: 1 }} />
                      <Typography variant="h4" fontWeight={700}>{report.passRate}%</Typography>
                      <Typography variant="body2" color="text.secondary">Pass Rate</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Card sx={{ textAlign: 'center', borderRadius: 3 }}>
                    <CardContent>
                      <EmojiEvents sx={{ fontSize: 36, color: '#ff9800', mb: 1 }} />
                      <Typography variant="h4" fontWeight={700}>{testMeta?.questionCount}</Typography>
                      <Typography variant="body2" color="text.secondary">Questions</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Performance Bands */}
              <Card sx={{ mb: 3, borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <People sx={{ color: '#6C63FF' }} />
                    <Typography variant="h6" fontWeight={700}>Student Performance Distribution</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {Object.entries(report.studentPerformanceBands || {}).map(([band, data]) => (
                      <Grid size={{ xs: 6, md: 3 }} key={band}>
                        <Box sx={{
                          p: 2, borderRadius: 2, textAlign: 'center',
                          bgcolor: `${getBandColor(band)}15`, border: `1px solid ${getBandColor(band)}40`,
                        }}>
                          <Typography variant="h5" fontWeight={700} sx={{ color: getBandColor(band) }}>
                            {data.count}
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>{getBandLabel(band)}</Typography>
                          <Typography variant="caption" color="text.secondary">{data.range}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>

              {/* Hardest & Easiest Questions */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ borderRadius: 3, height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TrendingDown sx={{ color: '#f44336' }} />
                        <Typography variant="h6" fontWeight={700}>Hardest Questions</Typography>
                      </Box>
                      {(report.hardestQuestions || []).map((q, i) => (
                        <Box key={i} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600}>
                              Q{q.questionNumber}. {q.questionText.length > 60 ? q.questionText.slice(0, 60) + '...' : q.questionText}
                            </Typography>
                            <Chip label={`${q.correctRate}%`} size="small" color="error" />
                          </Box>
                          <LinearProgress variant="determinate" value={q.correctRate}
                            sx={{ height: 6, borderRadius: 3, mb: 0.5, '& .MuiLinearProgress-bar': { bgcolor: '#f44336' } }} />
                          <Typography variant="caption" color="text.secondary">{q.insight}</Typography>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ borderRadius: 3, height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TrendingUp sx={{ color: '#4caf50' }} />
                        <Typography variant="h6" fontWeight={700}>Easiest Questions</Typography>
                      </Box>
                      {(report.easiestQuestions || []).map((q, i) => (
                        <Box key={i} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600}>
                              Q{q.questionNumber}. {q.questionText.length > 60 ? q.questionText.slice(0, 60) + '...' : q.questionText}
                            </Typography>
                            <Chip label={`${q.correctRate}%`} size="small" color="success" />
                          </Box>
                          <LinearProgress variant="determinate" value={q.correctRate}
                            sx={{ height: 6, borderRadius: 3, mb: 0.5, '& .MuiLinearProgress-bar': { bgcolor: '#4caf50' } }} />
                          <Typography variant="caption" color="text.secondary">{q.insight}</Typography>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Difficulty Analysis */}
              <Card sx={{ mb: 3, borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Difficulty vs Performance</Typography>
                  <Grid container spacing={2}>
                    {Object.entries(report.difficultyAnalysis || {}).map(([level, data]) => {
                      const color = level === 'Easy' ? '#4caf50' : level === 'Medium' ? '#ff9800' : '#f44336';
                      return (
                        <Grid size={{ xs: 12, md: 4 }} key={level}>
                          <Box sx={{ p: 2, borderRadius: 2, bgcolor: `${color}10`, border: `1px solid ${color}30` }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Chip label={level} size="small"
                                sx={{ bgcolor: `${color}20`, color, fontWeight: 600 }} />
                              <Typography variant="body2" color="text.secondary">
                                {data.count} question{data.count !== 1 ? 's' : ''}
                              </Typography>
                            </Box>
                            <Typography variant="h5" fontWeight={700} sx={{ color }}>
                              {data.avgCorrectRate}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Avg Correct Rate</Typography>
                            <LinearProgress variant="determinate" value={data.avgCorrectRate}
                              sx={{ mt: 1, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>

              {/* Key Insights */}
              <Card sx={{ mb: 3, borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Lightbulb sx={{ color: '#ff9800' }} />
                    <Typography variant="h6" fontWeight={700}>Key Insights</Typography>
                  </Box>
                  {(report.keyInsights || []).map((insight, i) => (
                    <Alert key={i} severity="info" sx={{ mb: 1, borderRadius: 2 }} icon={<Lightbulb />}>
                      {insight}
                    </Alert>
                  ))}
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card sx={{ mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'success.main' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CheckCircle sx={{ color: '#4caf50' }} />
                    <Typography variant="h6" fontWeight={700}>Recommendations</Typography>
                  </Box>
                  {(report.recommendations || []).map((rec, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
                      <Chip label={i + 1} size="small"
                        sx={{ bgcolor: '#4caf5020', color: '#4caf50', fontWeight: 700, minWidth: 28 }} />
                      <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{rec}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>

              {/* Student Data Table */}
              <Card sx={{ mb: 3, borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <People sx={{ color: '#6C63FF' }} />
                    <Typography variant="h6" fontWeight={700}>Per-Student Performance Table</Typography>
                  </Box>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Student</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell align="right">Attempts</TableCell>
                          <TableCell align="right">Avg %</TableCell>
                          <TableCell align="right">Best %</TableCell>
                          <TableCell align="right">Latest Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {studentRows.map((row) => (
                          <TableRow key={row.userId} hover>
                            <TableCell>{row.name}</TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>{row.email}</TableCell>
                            <TableCell align="right">{row.attempts}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${row.averageAccuracy}%`}
                                size="small"
                                color={row.averageAccuracy >= 80 ? 'success' : row.averageAccuracy >= 50 ? 'warning' : 'error'}
                              />
                            </TableCell>
                            <TableCell align="right">{row.bestAccuracy}%</TableCell>
                            <TableCell align="right">{row.latestScore}/{row.latestTotal}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Per Student Reports */}
              <Card sx={{ mb: 3, borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Psychology sx={{ color: '#6C63FF' }} />
                    <Typography variant="h6" fontWeight={700}>Student-wise Reports</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {studentReports.map((student) => (
                      <Grid key={student.userId} size={{ xs: 12 }}>
                        <Card variant="outlined" sx={{ borderRadius: 2 }}>
                          <CardContent>
                            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>{student.name}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                              {student.summary}
                            </Typography>

                            <Typography variant="subtitle2" fontWeight={700}>Strengths</Typography>
                            {student.strengths.map((strength, idx) => (
                              <Typography key={idx} variant="body2" sx={{ mt: 0.5 }}>
                                • {strength}
                              </Typography>
                            ))}

                            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1.5 }}>Improvement Areas</Typography>
                            {student.improvements.map((point, idx) => (
                              <Typography key={idx} variant="body2" sx={{ mt: 0.5 }}>
                                • {point}
                              </Typography>
                            ))}

                            <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
                              {student.recommendation}
                            </Alert>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </m.div>
          )}

          {/* Empty state */}
          {!report && !generating && (
            <Box sx={{ textAlign: 'center', py: 8, opacity: 0.6 }}>
              <Assessment sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Select a test and generate an AI-powered report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                The report includes performance analysis, question difficulty insights, and recommendations
              </Typography>
            </Box>
          )}
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
