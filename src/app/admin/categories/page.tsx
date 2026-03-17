'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Skeleton, MenuItem,
} from '@mui/material';
import { Add, Delete, Edit, Category as CategoryIcon } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

interface CategoryItem {
  id: string;
  name: string;
}

interface TopicItem {
  id: string;
  categoryId: string;
  name: string;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catDialog, setCatDialog] = useState(false);
  const [topicDialog, setTopicDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);

  const load = async () => {
    try {
      const [catsSnap, topicsSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'topics')),
      ]);
      const cats: CategoryItem[] = [];
      catsSnap.forEach(d => cats.push({ id: d.id, ...d.data() } as CategoryItem));
      setCategories(cats);

      const tops: TopicItem[] = [];
      topicsSnap.forEach(d => tops.push({ id: d.id, ...d.data() } as TopicItem));
      setTopics(tops);
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
    });
  }, []);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      if (editingCat) {
        await updateDoc(doc(db, 'categories', editingCat.id), { name: newCatName.trim() });
        toast.success('Category updated');
      } else {
        await addDoc(collection(db, 'categories'), {
          name: newCatName.trim(),
          createdAt: serverTimestamp(),
        });
        toast.success('Category added');
      }
      setCatDialog(false);
      setNewCatName('');
      setEditingCat(null);
      load();
    } catch {
      toast.error('Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
      toast.success('Category deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleAddTopic = async () => {
    if (!newTopicName.trim() || !selectedCatId) return;
    try {
      await addDoc(collection(db, 'topics'), {
        name: newTopicName.trim(),
        categoryId: selectedCatId,
        createdAt: serverTimestamp(),
      });
      toast.success('Topic added');
      setTopicDialog(false);
      setNewTopicName('');
      load();
    } catch {
      toast.error('Failed to add topic');
    }
  };

  const handleDeleteTopic = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'topics', id));
      toast.success('Topic deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <DashboardLayout>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">Categories & Topics</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => setCatDialog(true)}
                sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                Add Category
              </Button>
              <Button variant="outlined" startIcon={<Add />} onClick={() => setTopicDialog(true)}>
                Add Topic
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Skeleton variant="rounded" height={300} />
          ) : (
            <Grid container spacing={3}>
              {categories.map(cat => {
                const catTopics = topics.filter(t => t.categoryId === cat.id);
                return (
                  <Grid size={{ xs: 12, md: 6 }} key={cat.id}>
                    <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CategoryIcon color="primary" />
                              <Typography variant="h6">{cat.name}</Typography>
                            </Box>
                            <Box>
                              <IconButton size="small" onClick={() => { setEditingCat(cat); setNewCatName(cat.name); setCatDialog(true); }}>
                                <Edit />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDeleteCategory(cat.id)}>
                                <Delete />
                              </IconButton>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {catTopics.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">No topics yet</Typography>
                            ) : (
                              catTopics.map(t => (
                                <Chip
                                  key={t.id}
                                  label={t.name}
                                  onDelete={() => handleDeleteTopic(t.id)}
                                  variant="outlined"
                                />
                              ))
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </m.div>
                  </Grid>
                );
              })}

              {categories.length === 0 && (
                <Grid size={{ xs: 12 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                      <CategoryIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
                      <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                        No categories yet
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </Box>

        {/* Add/Edit Category Dialog */}
        <Dialog open={catDialog} onClose={() => { setCatDialog(false); setEditingCat(null); setNewCatName(''); }}>
          <DialogTitle>{editingCat ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Category Name"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              sx={{ mt: 1 }}
              placeholder="e.g., Programming, Aptitude, UPSC"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setCatDialog(false); setEditingCat(null); }}>Cancel</Button>
            <Button variant="contained" onClick={handleAddCategory}>{editingCat ? 'Update' : 'Add'}</Button>
          </DialogActions>
        </Dialog>

        {/* Add Topic Dialog */}
        <Dialog open={topicDialog} onClose={() => setTopicDialog(false)}>
          <DialogTitle>Add Topic</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 300 }}>
              <TextField
                select
                fullWidth
                label="Category"
                value={selectedCatId}
                onChange={e => setSelectedCatId(e.target.value)}
              >
                {categories.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Topic Name"
                value={newTopicName}
                onChange={e => setNewTopicName(e.target.value)}
                placeholder="e.g., Percentages, Python, Grammar"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTopicDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddTopic}>Add</Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
