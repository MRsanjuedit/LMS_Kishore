'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Skeleton,
} from '@mui/material';
import { ArrowBack, Download } from '@mui/icons-material';
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

        const userIds = Array.from(new Set(ss.map(s => String(s.userId || '')).filter(Boolean)));
        const nameEntries = await Promise.all(
          userIds.map(async (uid) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', uid));
              const userData = userDoc.exists() ? userDoc.data() : null;
              return [uid, (userData?.name as string) || uid.slice(0, 8)] as const;
            } catch {
              return [uid, uid.slice(0, 8)] as const;
            }
          })
        );

        const namesByUid = Object.fromEntries(nameEntries) as Record<string, string>;
        const withNames = ss.map((submission) => ({
          ...submission,
          studentName: namesByUid[String(submission.userId || '')] || 'Student',
        }));

        setSubmissions(withNames);
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

  const formatSubmittedAt = (value: unknown) => {
    if (!value) return '-';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toLocaleString();
    }
    return '-';
  };

  const handleDownloadExcel = () => {
    if (submissions.length === 0) return;

    const headers = ['Student Name', 'Student ID', 'Score', 'Total', 'Accuracy (%)', 'Time Taken (min)', 'Submitted At'];
    const rows = submissions.map((s) => [
      String((s.studentName as string) || 'Student'),
      String((s.userId as string) || ''),
      String((s.score as number) || 0),
      String((s.total as number) || 0),
      String((s.accuracy as number) || 0),
      String((s.timeTaken as number) || 0),
      formatSubmittedAt(s.createdAt),
    ]);

    const tableHtml = `
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>${r.map(v => `<td>${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;

    const blob = new Blob([`\ufeff${tableHtml}`], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = ((test?.title as string) || 'test-report').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase();
    a.href = url;
    a.download = `${safeTitle || 'test-report'}-student-report.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5">Student Reports</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Download />}
                  onClick={handleDownloadExcel}
                  disabled={submissions.length === 0}
                >
                  Download Report (Excel)
                </Button>
              </Box>
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
                      <TableCell>Submitted At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {submissions.map(s => (
                      <TableRow key={s.id as string}>
                        <TableCell>{(s.studentName as string) || 'Student'}</TableCell>
                        <TableCell>{s.score as number}/{s.total as number}</TableCell>
                        <TableCell><Chip label={`${s.accuracy}%`} size="small" color={(s.accuracy as number) >= 80 ? 'success' : (s.accuracy as number) >= 50 ? 'warning' : 'error'} /></TableCell>
                        <TableCell>{s.timeTaken as number} min</TableCell>
                        <TableCell>{formatSubmittedAt(s.createdAt)}</TableCell>
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
