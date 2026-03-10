'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button,
  CircularProgress, Chip, LinearProgress, Divider,
  FormControl, InputLabel, Select, MenuItem, Alert, Skeleton,
} from '@mui/material';
import {
  Assessment, TrendingUp, TrendingDown, People,
  CheckCircle, Warning, Psychology, EmojiEvents,
  School, Lightbulb,
} from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

interface TestOption {
  id: string;
  title: string;
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

export default function AIReportsPage() {
  const { user } = useAuth();
  const [tests, setTests] = useState<TestOption[]>([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<AIReport | null>(null);
  const [testMeta, setTestMeta] = useState<{ questionCount: number; submissionCount: number } | null>(null);

  useEffect(() => {
    const loadTests = async () => {
      if (!user) return;
      try {
        const snap = await getDocs(
          query(collection(db, 'tests'), where('createdBy', '==', user.uid))
        );
        const t: TestOption[] = [];
        snap.forEach(d => t.push({ id: d.id, title: (d.data().title as string) || 'Untitled' }));
        setTests(t);
      } catch (err) {
        console.error('Error loading tests:', err);
      }
      setLoading(false);
    };
    loadTests();
  }, [user]);

  const handleGenerate = async () => {
    if (!selectedTest) {
      toast.error('Please select a test');
      return;
    }
    setGenerating(true);
    setReport(null);
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
      const submissions: Array<Record<string, unknown>> = [];
      sSnap.forEach(d => submissions.push({ id: d.id, ...d.data() }));

      setTestMeta({ questionCount: questions.length, submissionCount: submissions.length });

      if (submissions.length === 0) {
        toast.error('No submissions yet for this test. Students need to take the test first.');
        setGenerating(false);
        return;
      }

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

          {/* Test Selector */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Select a Test to Analyze</Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 8 }}>
                  <FormControl fullWidth>
                    <InputLabel>Choose Test</InputLabel>
                    <Select
                      value={selectedTest}
                      label="Choose Test"
                      onChange={e => { setSelectedTest(e.target.value); setReport(null); }}
                    >
                      {loading ? (
                        <MenuItem disabled>Loading tests...</MenuItem>
                      ) : tests.length === 0 ? (
                        <MenuItem disabled>No tests created yet</MenuItem>
                      ) : (
                        tests.map(t => (
                          <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button
                    fullWidth variant="contained" size="large"
                    startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <Psychology />}
                    onClick={handleGenerate}
                    disabled={generating || !selectedTest}
                    sx={{ py: 1.8, background: 'linear-gradient(135deg, #6C63FF, #8B85FF)', fontWeight: 600 }}
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
