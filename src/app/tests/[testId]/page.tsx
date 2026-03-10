'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Button, Chip, Grid,
  List, ListItem, ListItemIcon, ListItemText, Divider, Skeleton,
} from '@mui/material';
import { Timer, Quiz, PlayArrow, CheckCircle, Info } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { doc, getDoc, collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface TestDetail {
  id: string;
  title: string;
  topicName?: string;
  categoryName?: string;
  duration: number;
  questionCount: number;
  description?: string;
}

export default function TestDetailPage() {
  const { testId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionCount, setQuestionCount] = useState(0);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<{ score: number; total: number; accuracy: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!testId || !user) return;
      try {
        const testDoc = await getDoc(doc(db, 'tests', testId as string));
        if (testDoc.exists()) {
          const data = testDoc.data();
          setTest({ id: testDoc.id, ...data } as TestDetail);

          const qSnap = await getCountFromServer(
            query(collection(db, 'questions'), where('testId', '==', testId))
          );
          setQuestionCount(qSnap.data().count);

          // Check if already attempted
          const subSnap = await getDocs(
            query(collection(db, 'submissions'), where('testId', '==', testId), where('userId', '==', user.uid))
          );
          if (!subSnap.empty) {
            setAlreadyAttempted(true);
            const subData = subSnap.docs[0].data();
            setExistingSubmission({ score: subData.score, total: subData.total, accuracy: subData.accuracy });
          }
        }
      } catch (err) {
        console.error('Error loading test:', err);
      }
      setLoading(false);
    };
    load();
  }, [testId, user]);

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <DashboardLayout>
          <Box sx={{ maxWidth: 700, mx: 'auto' }}>
            <Skeleton height={60} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={300} />
          </Box>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!test) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <DashboardLayout>
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography variant="h5" color="text.secondary">Test not found</Typography>
          </Box>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Typography variant="h4" sx={{ mb: 1 }}>{test.title}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
              {test.categoryName && <Chip label={test.categoryName} color="primary" />}
              {test.topicName && <Chip label={test.topicName} variant="outlined" />}
            </Box>

            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Test Information</Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Timer color="primary" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Duration</Typography>
                        <Typography fontWeight={600}>{test.duration} minutes</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Quiz color="primary" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Questions</Typography>
                        <Typography fontWeight={600}>{questionCount}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
                {test.description && (
                  <Typography color="text.secondary" sx={{ mt: 2 }}>{test.description}</Typography>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info color="primary" /> Instructions
                </Typography>
                <List dense>
                  {[
                    'The test will auto-submit when time expires.',
                    'You can navigate between questions using the question panel.',
                    'Mark questions for review to come back to them later.',
                    'You can skip questions and attempt them later.',
                    'Once submitted, you cannot retake the same attempt.',
                  ].map((text, i) => (
                    <ListItem key={i} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                      </ListItemIcon>
                      <ListItemText primary={text} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={alreadyAttempted ? <CheckCircle /> : <PlayArrow />}
              onClick={() => alreadyAttempted ? router.push(`/results?testId=${testId}&latest=true`) : router.push(`/tests/${testId}/attempt`)}
              sx={{
                py: 1.5,
                fontSize: '1.1rem',
                background: alreadyAttempted
                  ? 'linear-gradient(135deg, #4caf50, #66bb6a)'
                  : 'linear-gradient(135deg, #6C63FF, #8B85FF)',
              }}
            >
              {alreadyAttempted ? 'View Results' : 'Start Test'}
            </Button>

            {alreadyAttempted && existingSubmission && (
              <Card sx={{ mt: 2, bgcolor: '#e8f5e9', border: '1px solid #4caf50' }}>
                <CardContent sx={{ py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle sx={{ color: '#4caf50' }} />
                    <Typography fontWeight={600}>Already Attempted</Typography>
                  </Box>
                  <Typography fontWeight={600} color="primary">
                    Score: {existingSubmission.score}/{existingSubmission.total} ({existingSubmission.accuracy}%)
                  </Typography>
                </CardContent>
              </Card>
            )}
          </m.div>
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
