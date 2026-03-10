'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Skeleton, IconButton, Collapse,
} from '@mui/material';
import {
  CheckCircle, Cancel, EmojiEvents, Timer, Psychology,
  ExpandMore, ExpandLess, ArrowBack,
} from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  collection, query, where, getDocs, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

interface SubmissionData {
  id: string;
  testId: string;
  testTitle: string;
  score: number;
  total: number;
  accuracy: number;
  timeTaken: number;
  answers: Record<string, string>;
  createdAt: Date;
}

interface QuestionData {
  id: string;
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  type: string;
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  const testId = searchParams.get('testId');
  const latest = searchParams.get('latest');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        let q;
        if (testId) {
          q = query(
            collection(db, 'submissions'),
            where('userId', '==', user.uid),
            where('testId', '==', testId),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = query(
            collection(db, 'submissions'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
        }

        const snap = await getDocs(q);
        const subs: SubmissionData[] = [];
        snap.forEach(d => {
          const data = d.data();
          subs.push({
            id: d.id,
            testId: data.testId,
            testTitle: data.testTitle,
            score: data.score,
            total: data.total,
            accuracy: data.accuracy,
            timeTaken: data.timeTaken,
            answers: data.answers || {},
            createdAt: data.createdAt?.toDate(),
          });
        });
        setSubmissions(subs);

        // Load questions for the latest/selected test
        if (subs.length > 0 && testId) {
          const qSnap = await getDocs(
            query(collection(db, 'questions'), where('testId', '==', testId))
          );
          const qList: QuestionData[] = [];
          qSnap.forEach(d => qList.push({ id: d.id, ...d.data() } as QuestionData));
          setQuestions(qList);
        }
      } catch (err) {
        console.error('Error loading results:', err);
      }
      setLoading(false);
    };
    load();
  }, [user, testId, latest]);

  const handleAiExplain = async (question: QuestionData) => {
    if (aiExplanation[question.id]) return;
    setAiLoading(prev => ({ ...prev, [question.id]: true }));
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: question.questionText,
          correctAnswer: question.correctAnswer,
          options: question.options,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiExplanation(prev => ({ ...prev, [question.id]: data.explanation }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI explanation unavailable.';
      toast.error(msg);
    }
    setAiLoading(prev => ({ ...prev, [question.id]: false }));
  };

  const latestSub = submissions[0];

  if (loading) {
    return (
      <Box>
        <Skeleton height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/dashboard')}>
          Back
        </Button>
        <Typography variant="h4">
          {testId ? 'Test Results' : 'My Results'}
        </Typography>
      </Box>

      {/* Latest result summary */}
      {latestSub && latest && (
        <m.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #6C63FF10, #FF658410)', border: '1px solid #6C63FF30' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <m.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}>
                  <EmojiEvents sx={{ fontSize: 60, color: latestSub.accuracy >= 80 ? '#F59E0B' : '#6C63FF' }} />
                </m.div>
                <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
                  {latestSub.accuracy >= 80 ? 'Excellent!' : latestSub.accuracy >= 50 ? 'Good Job!' : 'Keep Practicing!'}
                </Typography>
                <Typography color="text.secondary">{latestSub.testTitle}</Typography>
              </Box>

              <Grid container spacing={3} justifyContent="center">
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} color="primary">
                      {latestSub.score}/{latestSub.total}
                    </Typography>
                    <Typography color="text.secondary">Score</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} color={latestSub.accuracy >= 80 ? 'success.main' : latestSub.accuracy >= 50 ? 'warning.main' : 'error.main'}>
                      {latestSub.accuracy}%
                    </Typography>
                    <Typography color="text.secondary">Accuracy</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700}>
                      {latestSub.timeTaken}
                    </Typography>
                    <Typography color="text.secondary">Minutes</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </m.div>
      )}

      {/* Question Review */}
      {questions.length > 0 && latestSub && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Question Review</Typography>
          {questions.map((q, i) => {
            const userAnswer = latestSub.answers[q.id] || '';
            const isCorrect = userAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            const isExpanded = expanded === q.id;
            return (
              <m.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card sx={{ mb: 1.5, border: '1px solid', borderColor: isCorrect ? 'success.main' : userAnswer ? 'error.main' : 'divider' }}>
                  <CardContent sx={{ pb: '8px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      {isCorrect ? (
                        <CheckCircle color="success" sx={{ mt: 0.3 }} />
                      ) : (
                        <Cancel color="error" sx={{ mt: 0.3 }} />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600}>Q{i + 1}. {q.questionText}</Typography>
                        <Box sx={{ mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <Typography variant="body2">
                            Your answer: <Chip label={userAnswer || 'Skipped'} size="small"
                              color={isCorrect ? 'success' : 'error'} />
                          </Typography>
                          {!isCorrect && (
                            <Typography variant="body2">
                              Correct: <Chip label={q.correctAnswer} size="small" color="success" />
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <IconButton size="small" onClick={() => setExpanded(isExpanded ? null : q.id)}>
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>
                    <Collapse in={isExpanded}>
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                        {q.explanation && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Explanation:</strong> {q.explanation}
                          </Typography>
                        )}
                        <Button
                          size="small"
                          startIcon={<Psychology />}
                          onClick={() => handleAiExplain(q)}
                          disabled={aiLoading[q.id]}
                          variant="outlined"
                        >
                          {aiLoading[q.id] ? 'Getting AI Explanation...' : aiExplanation[q.id] ? 'AI Explained' : 'Explain with AI'}
                        </Button>
                        {aiExplanation[q.id] && (
                          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#E8ECFF', borderRadius: 1 }}>
                            <Typography variant="body2">{aiExplanation[q.id]}</Typography>
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              </m.div>
            );
          })}
        </Box>
      )}

      {/* All results history */}
      {!latest && submissions.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Test</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Accuracy</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissions.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.testTitle}</TableCell>
                  <TableCell>{s.score}/{s.total}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={s.accuracy}
                        sx={{ width: 80, height: 6, borderRadius: 3,
                          '& .MuiLinearProgress-bar': {
                            bgcolor: s.accuracy >= 80 ? 'success.main' : s.accuracy >= 50 ? 'warning.main' : 'error.main',
                          }
                        }}
                      />
                      {s.accuracy}%
                    </Box>
                  </TableCell>
                  <TableCell>{s.timeTaken} min</TableCell>
                  <TableCell>{s.createdAt?.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => router.push(`/results?testId=${s.testId}&latest=true`)}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {submissions.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">No results found</Typography>
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/tests')}>
              Take a Test
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default function ResultsPage() {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      <DashboardLayout>
        <Suspense fallback={<Skeleton height={400} />}>
          <ResultsContent />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
