'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Button, Radio, RadioGroup,
  FormControlLabel, TextField, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, LinearProgress, Paper, Grid, Tooltip,
} from '@mui/material';
import {
  Timer, Flag, NavigateNext, NavigateBefore, Send, Bookmark,
  BookmarkBorder, Warning,
} from '@mui/icons-material';
import { motion as m, AnimatePresence } from 'framer-motion';
import {
  doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  questionText: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'paragraph';
  options?: string[];
  correctAnswer: string;
  difficulty: string;
  explanation?: string;
}

interface TestData {
  title: string;
  duration: number;
  status?: 'draft' | 'published';
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TestAttemptPage() {
  const { testId } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [test, setTest] = useState<TestData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitDialog, setSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Load test and questions
  useEffect(() => {
    const load = async () => {
      if (!testId || !user) return;
      try {
        // Check if already attempted
        const subSnap = await getDocs(
          query(collection(db, 'submissions'), where('testId', '==', testId), where('userId', '==', user.uid))
        );
        if (!subSnap.empty) {
          toast.error('You have already attempted this test');
          router.push(`/results?testId=${testId}&latest=true`);
          return;
        }

        const testDoc = await getDoc(doc(db, 'tests', testId as string));
        if (!testDoc.exists()) {
          toast.error('Test not found');
          router.push('/tests');
          return;
        }
        const testData = testDoc.data() as TestData;
        if ((testData.status || 'published') !== 'published') {
          toast.error('This test is not published yet');
          router.push('/tests');
          return;
        }
        setTest(testData);
        setTimeLeft(testData.duration * 60);

        const qSnap = await getDocs(
          query(collection(db, 'questions'), where('testId', '==', testId))
        );
        const qList: Question[] = [];
        qSnap.forEach(d => qList.push({ id: d.id, ...d.data() } as Question));

        // Randomize question order
        const shuffled = shuffleArray(qList).map(q => ({
          ...q,
          options: q.options ? shuffleArray(q.options) : q.options,
        }));
        setQuestions(shuffled);
        startTimeRef.current = Date.now();
      } catch (err) {
        console.error('Error loading test:', err);
        toast.error('Failed to load test');
      }
      setLoading(false);
    };
    load();
  }, [testId, router, user]);

  // Timer
  useEffect(() => {
    if (loading || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (qId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const toggleMark = (qId: string) => {
    setMarked(prev => {
      const n = new Set(prev);
      if (n.has(qId)) n.delete(qId); else n.add(qId);
      return n;
    });
  };

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 60000);
      let score = 0;
      const total = questions.length;

      questions.forEach(q => {
        if (answers[q.id]?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()) {
          score++;
        }
      });

      const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

      await addDoc(collection(db, 'submissions'), {
        userId: user?.uid,
        testId,
        testTitle: test?.title || '',
        answers,
        score,
        total,
        accuracy,
        timeTaken,
        createdAt: serverTimestamp(),
      });

      if (autoSubmit) toast('Time expired! Test auto-submitted.', { icon: '⏰' });
      else toast.success('Test submitted successfully!');

      router.push(`/results?testId=${testId}&latest=true`);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to submit test');
      setSubmitting(false);
    }
  }, [submitting, questions, answers, user, testId, test, router]);

  const currentQuestion = questions[currentQ];
  const answered = Object.keys(answers).length;
  const totalQ = questions.length;
  const progress = totalQ > 0 ? (answered / totalQ) * 100 : 0;

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Typography>Loading test...</Typography>
        </Box>
      </ProtectedRoute>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h5">No questions found for this test</Typography>
          <Button variant="contained" onClick={() => router.push('/tests')}>Back to Tests</Button>
        </Box>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#F5F7FA' }}>
        {/* Top Bar */}
        <Paper
          sx={{
            position: 'sticky', top: 0, zIndex: 10,
            px: 3, py: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: 0, boxShadow: 2,
          }}
        >
          <Typography variant="h6" fontWeight={700}>{test.title}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<Timer />}
              label={formatTime(timeLeft)}
              color={timeLeft < 60 ? 'error' : timeLeft < 300 ? 'warning' : 'default'}
              sx={{ fontWeight: 700, fontSize: 16, px: 1 }}
            />
            <Button
              variant="contained"
              color="error"
              startIcon={<Send />}
              onClick={() => setSubmitDialog(true)}
              disabled={submitting}
            >
              Submit
            </Button>
          </Box>
        </Paper>

        {/* Progress */}
        <LinearProgress variant="determinate" value={progress} sx={{ height: 4 }} />

        <Box sx={{ display: 'flex', maxWidth: 1200, mx: 'auto', gap: 3, p: 3, flexDirection: { xs: 'column-reverse', md: 'row' } }}>
          {/* Question Panel */}
          <Paper sx={{ width: { xs: '100%', md: 280 }, p: 2, height: 'fit-content' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Questions ({answered}/{totalQ} answered)
            </Typography>
            <Grid container spacing={1}>
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.id];
                const isMarked = marked.has(q.id);
                const isCurrent = i === currentQ;
                return (
                  <Grid size={{ xs: 2.4 }} key={q.id}>
                    <Tooltip title={isMarked ? 'Marked for review' : isAnswered ? 'Answered' : 'Not answered'}>
                      <Button
                        fullWidth
                        size="small"
                        onClick={() => setCurrentQ(i)}
                        sx={{
                          minWidth: 0, p: 0.5, fontSize: 13, fontWeight: 600,
                          border: isCurrent ? '2px solid' : '1px solid',
                          borderColor: isCurrent ? 'primary.main' : isMarked ? 'warning.main' : isAnswered ? 'success.main' : 'divider',
                          bgcolor: isAnswered ? 'success.main' : isMarked ? 'warning.light' : 'transparent',
                          color: isAnswered ? '#fff' : 'text.primary',
                          '&:hover': { bgcolor: isAnswered ? 'success.dark' : 'action.hover' },
                        }}
                      >
                        {i + 1}
                      </Button>
                    </Tooltip>
                  </Grid>
                );
              })}
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label="Answered" sx={{ bgcolor: 'success.main', color: '#fff' }} />
              <Chip size="small" label="Review" color="warning" />
              <Chip size="small" label="Unanswered" variant="outlined" />
            </Box>
          </Paper>

          {/* Question Content */}
          <Box sx={{ flex: 1 }}>
            <AnimatePresence mode="wait">
              <m.div
                key={currentQ}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
              >
                <Card sx={{ mb: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Question {currentQ + 1} of {totalQ}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          label={currentQuestion.difficulty}
                          size="small"
                          color={
                            currentQuestion.difficulty === 'Easy' ? 'success' :
                            currentQuestion.difficulty === 'Hard' ? 'error' : 'warning'
                          }
                        />
                        <IconButton size="small" onClick={() => toggleMark(currentQuestion.id)}>
                          {marked.has(currentQuestion.id) ? (
                            <Bookmark color="warning" />
                          ) : (
                            <BookmarkBorder />
                          )}
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="h6" sx={{ mb: 3, lineHeight: 1.6 }}>
                      {currentQuestion.questionText}
                    </Typography>

                    {/* MCQ / True-False */}
                    {(currentQuestion.type === 'mcq' || currentQuestion.type === 'true_false') && currentQuestion.options && (
                      <RadioGroup
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                      >
                        {currentQuestion.options.map((opt, i) => (
                          <m.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <FormControlLabel
                              value={opt}
                              control={<Radio />}
                              label={opt}
                              sx={{
                                border: '1px solid',
                                borderColor: answers[currentQuestion.id] === opt ? 'primary.main' : 'divider',
                                borderRadius: 2,
                                mx: 0, mb: 1, px: 2, py: 0.5,
                                width: '100%',
                                bgcolor: answers[currentQuestion.id] === opt ? 'primary.main' : 'transparent',
                                color: answers[currentQuestion.id] === opt ? '#fff' : 'inherit',
                                transition: '0.2s',
                                '&:hover': { borderColor: 'primary.main' },
                                '& .MuiRadio-root': {
                                  color: answers[currentQuestion.id] === opt ? '#fff' : undefined,
                                },
                              }}
                            />
                          </m.div>
                        ))}
                      </RadioGroup>
                    )}

                    {/* Short Answer */}
                    {currentQuestion.type === 'short_answer' && (
                      <TextField
                        fullWidth
                        label="Your Answer"
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                        variant="outlined"
                      />
                    )}

                    {/* Paragraph */}
                    {currentQuestion.type === 'paragraph' && (
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Your Answer"
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                        variant="outlined"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Navigation */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    startIcon={<NavigateBefore />}
                    onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                    disabled={currentQ === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={marked.has(currentQuestion.id) ? <Bookmark /> : <BookmarkBorder />}
                    onClick={() => toggleMark(currentQuestion.id)}
                    color="warning"
                  >
                    {marked.has(currentQuestion.id) ? 'Unmark' : 'Mark for Review'}
                  </Button>
                  {currentQ < totalQ - 1 ? (
                    <Button
                      endIcon={<NavigateNext />}
                      variant="contained"
                      onClick={() => setCurrentQ(prev => Math.min(totalQ - 1, prev + 1))}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      endIcon={<Send />}
                      variant="contained"
                      color="success"
                      onClick={() => setSubmitDialog(true)}
                    >
                      Finish
                    </Button>
                  )}
                </Box>
              </m.div>
            </AnimatePresence>
          </Box>
        </Box>

        {/* Submit Confirmation Dialog */}
        <Dialog open={submitDialog} onClose={() => setSubmitDialog(false)}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" /> Submit Test?
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              You have answered <strong>{answered}</strong> out of <strong>{totalQ}</strong> questions.
            </Typography>
            {totalQ - answered > 0 && (
              <Typography color="error">
                {totalQ - answered} question(s) are unanswered. They will be marked as incorrect.
              </Typography>
            )}
            {marked.size > 0 && (
              <Typography color="warning.main" sx={{ mt: 1 }}>
                {marked.size} question(s) are marked for review.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSubmitDialog(false)}>Continue Test</Button>
            <Button variant="contained" color="error" onClick={() => handleSubmit(false)} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Test'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
}
