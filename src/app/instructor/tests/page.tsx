'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Skeleton, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import { Delete, Visibility, Add, Quiz } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
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
  categoryName?: string;
  topicName?: string;
  duration: number;
  questionCount: number;
  status?: 'draft' | 'published';
  createdAt?: Date;
}

export default function InstructorTestsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'tests'), where('createdBy', '==', user.uid))
      );
      const list: TestItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id, title: data.title, categoryName: data.categoryName,
          topicName: data.topicName, duration: data.duration,
          status: data.status || 'published',
          questionCount: data.questionCount || 0,
          createdAt: data.createdAt?.toDate(),
        });
      });
      setTests(list);
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
    });
  }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'tests', deleteId));
      // Also delete related questions
      const qSnap = await getDocs(query(collection(db, 'questions'), where('testId', '==', deleteId)));
      const promises = qSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(promises);
      toast.success('Test deleted');
      setDeleteId(null);
      load();
    } catch {
      toast.error('Failed to delete test');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">Tests</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => router.push('/instructor/create-test')}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
              Create Test
            </Button>
          </Box>

          {loading ? (
            <Skeleton variant="rounded" height={300} />
          ) : tests.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <Quiz sx={{ fontSize: 80, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>No tests created yet</Typography>
                <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/instructor/create-test')}>
                  Create Your First Test
                </Button>
              </CardContent>
            </Card>
          ) : (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Topic</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Questions</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tests.map(t => (
                      <TableRow key={t.id} hover>
                        <TableCell><Typography fontWeight={600}>{t.title}</Typography></TableCell>
                        <TableCell>{t.categoryName && <Chip label={t.categoryName} size="small" color="primary" variant="outlined" />}</TableCell>
                        <TableCell>{t.topicName || '-'}</TableCell>
                        <TableCell>{t.duration} min</TableCell>
                        <TableCell>{t.questionCount}</TableCell>
                        <TableCell>
                          <Chip
                            label={t.status === 'draft' ? 'Draft' : 'Published'}
                            size="small"
                            color={t.status === 'draft' ? 'warning' : 'success'}
                            variant={t.status === 'draft' ? 'outlined' : 'filled'}
                          />
                        </TableCell>
                        <TableCell>{t.createdAt?.toLocaleDateString() || '-'}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            startIcon={<Visibility />}
                            onClick={() => router.push(`/instructor/tests/${t.id}`)}
                            sx={{ mr: 1 }}
                          >
                            View Report
                          </Button>
                          <IconButton size="small" onClick={() => router.push(`/instructor/tests/${t.id}`)}>
                            <Visibility />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => setDeleteId(t.id)}>
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </m.div>
          )}
        </Box>

        <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
          <DialogTitle>Delete Test?</DialogTitle>
          <DialogContent>This will permanently delete the test and all its questions.</DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
