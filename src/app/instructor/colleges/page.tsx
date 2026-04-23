'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Grid, IconButton, Chip, Skeleton, Dialog, DialogTitle,
  DialogContent, DialogActions, InputAdornment, Divider, Alert,
} from '@mui/material';
import {
  Add, Delete, School, Search, Close, CheckCircle,
} from '@mui/icons-material';
import { motion as m, AnimatePresence } from 'framer-motion';
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

interface College {
  id: string;
  name: string;
  createdAt: Date | null;
  createdBy: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function InstructorCollegesPage() {
  const { user } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<College | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchColleges = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'colleges'), orderBy('name')));
      const list: College[] = [];
      snap.forEach(d => {
        list.push({
          id: d.id,
          name: d.data().name,
          createdAt: d.data().createdAt?.toDate() ?? null,
          createdBy: d.data().createdBy ?? '',
        });
      });
      setColleges(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load colleges');
    }
    setLoading(false);
  };

  useEffect(() => { fetchColleges(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) { toast.error('College name cannot be empty'); return; }
    if (colleges.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A college with this name already exists');
      return;
    }
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'colleges'), {
        name,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      });
      setColleges(prev => [...prev, { id: docRef.id, name, createdAt: new Date(), createdBy: user?.uid ?? '' }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setAdding(false);
      toast.success(`"${name}" added successfully`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add college');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'colleges', deleteTarget.id));
      setColleges(prev => prev.filter(c => c.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.name}" removed`);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete college');
    }
    setDeleting(false);
  };

  const filtered = colleges.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={['instructor', 'admin']}>
      <DashboardLayout>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ background: 'linear-gradient(135deg, #6C63FF, #FF6584)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Colleges
            </Typography>
            <Typography color="text.secondary" variant="body2" mt={0.5}>
              Manage the colleges available for test targeting and student signup
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAdding(true)}
            sx={{
              background: 'linear-gradient(135deg, #6C63FF, #8B85FF)',
              borderRadius: 2,
              px: 3,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: '0 4px 15px rgba(108,99,255,0.3)',
              '&:hover': { boxShadow: '0 6px 20px rgba(108,99,255,0.45)', transform: 'translateY(-1px)' },
              transition: 'all 0.2s',
            }}
          >
            Add College
          </Button>
        </Box>

        {/* Stats bar */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Colleges', value: colleges.length, color: '#6C63FF' },
            { label: 'Search Results', value: filtered.length, color: '#10B981' },
          ].map((s, i) => (
            <Grid size={{ xs: 6, sm: 3 }} key={i}>
              <Card sx={{ background: `linear-gradient(135deg, ${s.color}12, ${s.color}06)`, border: `1px solid ${s.color}25`, borderRadius: 3 }}>
                <CardContent sx={{ py: 2, px: 2.5 }}>
                  <Typography variant="h5" fontWeight={800} color={s.color}>
                    {loading ? <Skeleton width={40} /> : s.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {s.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search colleges…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><Search sx={{ color: 'text.disabled' }} /></InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><Close fontSize="small" /></IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {/* College Grid */}
        {loading ? (
          <Grid container spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rounded" height={100} sx={{ borderRadius: 3 }} />
              </Grid>
            ))}
          </Grid>
        ) : filtered.length === 0 ? (
          <Card sx={{ borderRadius: 4, border: '2px dashed', borderColor: 'divider' }}>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <School sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" fontWeight={600}>
                {search ? 'No colleges match your search' : 'No colleges yet'}
              </Typography>
              <Typography color="text.disabled" variant="body2" mt={1}>
                {search ? 'Try a different search term' : 'Click "Add College" to create your first one'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <m.div variants={container} initial="hidden" animate="show">
            <Grid container spacing={2}>
              <AnimatePresence>
                {filtered.map(college => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={college.id}>
                    <m.div variants={item} layout exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}>
                      <Card
                        sx={{
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          transition: '0.2s',
                          '&:hover': { boxShadow: '0 8px 30px rgba(108,99,255,0.12)', borderColor: '#6C63FF40', transform: 'translateY(-2px)' },
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                              <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: '#6C63FF15', color: '#6C63FF', flexShrink: 0 }}>
                                <School fontSize="small" />
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography fontWeight={700} fontSize={15} noWrap title={college.name}>
                                  {college.name}
                                </Typography>
                                {college.createdAt && (
                                  <Typography variant="caption" color="text.disabled">
                                    Added {college.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteTarget(college)}
                              sx={{ flexShrink: 0, '&:hover': { bgcolor: '#EF444415' } }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    </m.div>
                  </Grid>
                ))}
              </AnimatePresence>
            </Grid>
          </m.div>
        )}

        {/* Add College Dialog */}
        <Dialog
          open={adding}
          onClose={() => { setAdding(false); setNewName(''); }}
          PaperProps={{ sx: { borderRadius: 4, minWidth: 400, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Add New College</DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              This college will appear in the student signup dropdown and test targeting.
            </Alert>
            <TextField
              autoFocus
              fullWidth
              label="College Name"
              placeholder="e.g. IIT Bombay"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><School fontSize="small" sx={{ color: 'text.disabled' }} /></InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => { setAdding(false); setNewName(''); }} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              startIcon={saving ? undefined : <CheckCircle />}
              sx={{
                background: 'linear-gradient(135deg, #6C63FF, #8B85FF)',
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                px: 3,
              }}
            >
              {saving ? 'Adding…' : 'Add College'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          PaperProps={{ sx: { borderRadius: 4, minWidth: 380, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Remove College</DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Typography>
              Are you sure you want to remove <strong>"{deleteTarget?.name}"</strong>?
            </Typography>
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              Existing tests targeting this college will still retain it in their records. Only new test targeting will be affected.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => setDeleteTarget(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
              disabled={deleting}
              startIcon={<Delete />}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 3 }}
            >
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          </DialogActions>
        </Dialog>

      </DashboardLayout>
    </ProtectedRoute>
  );
}
