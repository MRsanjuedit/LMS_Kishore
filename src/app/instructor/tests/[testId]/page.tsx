'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Skeleton,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function InstructorTestDetailPage() {
  const { testId } = useParams();
  const router = useRouter();
  const [test, setTest] = useState<Record<string, unknown> | null>(null);
  const [submissions, setSubmissions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!testId) return;
      try {
        const testDoc = await getDoc(doc(db, 'tests', testId as string));
        if (testDoc.exists()) setTest({ id: testDoc.id, ...testDoc.data() });

        const sSnap = await getDocs(query(collection(db, 'submissions'), where('testId', '==', testId)));
        const ss: Array<Record<string, unknown>> = [];
        sSnap.forEach(d => ss.push({ id: d.id, ...d.data() }));
        setSubmissions(ss);
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, [testId]);

  const avgScore = submissions.length > 0
    ? Math.round(submissions.reduce((s, x) => s + (x.accuracy as number || 0), 0) / submissions.length)
    : 0;

  if (loading) return (
    <ProtectedRoute allowedRoles={['instructor']}><DashboardLayout><Skeleton height={400} /></DashboardLayout></ProtectedRoute>
  );

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Box>
          <Button startIcon={<ArrowBack />} onClick={() => router.push('/instructor/tests')} sx={{ mb: 2 }}>Back</Button>
          <Typography variant="h4" sx={{ mb: 3 }}>{(test?.title as string) || 'Test'}</Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            {[
              { label: 'Questions', value: Number(test?.questionCount || 0), color: '#6C63FF' },
              { label: 'Submissions', value: submissions.length, color: '#10B981' },
              { label: 'Avg Score', value: `${avgScore}%`, color: '#F59E0B' },
            ].map((s, i) => (
              <Grid size={{ xs: 4 }} key={i}>
                <Card sx={{ background: `linear-gradient(135deg, ${s.color}15, ${s.color}08)` }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
                    <Typography color="text.secondary">{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Submissions */}
          <Box sx={{ mt: 1 }}>
              <Typography variant="h5" sx={{ mb: 2 }}>Student Reports</Typography>
              {submissions.length === 0 ? (
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">No student attempts yet for this test.</Typography>
                  </CardContent>
                </Card>
              ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Score</TableCell>
                      <TableCell>Accuracy</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {submissions.map(s => (
                      <TableRow key={s.id as string}>
                        <TableCell>{(s.userId as string)?.slice(0, 8)}...</TableCell>
                        <TableCell>{s.score as number}/{s.total as number}</TableCell>
                        <TableCell><Chip label={`${s.accuracy}%`} size="small" color={(s.accuracy as number) >= 80 ? 'success' : (s.accuracy as number) >= 50 ? 'warning' : 'error'} /></TableCell>
                        <TableCell>{s.timeTaken as number} min</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              )}
            </Box>
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
