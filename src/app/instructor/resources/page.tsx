'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid,
  Chip, IconButton, Alert, Skeleton,
} from '@mui/material';
import { Add, Delete, OpenInNew, VideoLibrary } from '@mui/icons-material';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface ResourceItem {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'playlist';
  description?: string;
  createdBy: string;
}

const getResourceType = (url: string): 'video' | 'playlist' | null => {
  const lower = url.toLowerCase();
  if (!lower.includes('youtube.com') && !lower.includes('youtu.be')) return null;
  if (lower.includes('list=')) return 'playlist';
  return 'video';
};

export default function InstructorResourcesPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resources, setResources] = useState<ResourceItem[]>([]);

  const detectedType = useMemo(() => getResourceType(url), [url]);

  const loadResources = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'resources'),
          where('createdBy', '==', user.uid),
          orderBy('createdAt', 'desc')
        )
      );
      const list: ResourceItem[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ResourceItem));
      setResources(list);
    } catch (err) {
      console.error('Failed to load resources:', err);
      setError('Failed to load your resources.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadResources();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || !trimmedUrl) {
      setError('Title and YouTube link are required.');
      return;
    }

    const type = getResourceType(trimmedUrl);
    if (!type) {
      setError('Please enter a valid YouTube video or playlist link.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'resources'), {
        title: trimmedTitle,
        url: trimmedUrl,
        description: trimmedDescription,
        type,
        createdBy: user?.uid,
        createdByName: user?.displayName || '',
        createdAt: serverTimestamp(),
      });

      setTitle('');
      setUrl('');
      setDescription('');
      await loadResources();
    } catch (err) {
      console.error('Failed to add resource:', err);
      setError('Failed to add resource.');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'resources', id));
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete resource:', err);
      setError('Failed to delete resource.');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 980, mx: 'auto' }}>
          <Typography variant="h4" sx={{ mb: 3 }}>Free Resources</Typography>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Upload YouTube Resource</Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box component="form" onSubmit={handleAdd}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="YouTube Link"
                      placeholder="https://www.youtube.com/watch?v=... or playlist"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      helperText={detectedType ? `Detected: ${detectedType}` : 'Paste YouTube video/playlist URL'}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Description (optional)"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button type="submit" variant="contained" startIcon={<Add />} disabled={saving}
                      sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                      {saving ? 'Saving...' : 'Add Resource'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="h6" sx={{ mb: 2 }}>Your Uploaded Resources</Typography>
          {loading ? (
            <Skeleton variant="rounded" height={180} />
          ) : resources.length === 0 ? (
            <Card><CardContent><Typography color="text.secondary">No resources uploaded yet.</Typography></CardContent></Card>
          ) : (
            <Grid container spacing={2}>
              {resources.map(resource => (
                <Grid size={{ xs: 12, md: 6 }} key={resource.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1 }}>
                        <Box>
                          <Typography variant="h6">{resource.title}</Typography>
                          <Chip size="small" label={resource.type === 'playlist' ? 'Playlist' : 'Video'} sx={{ mt: 0.8 }} />
                        </Box>
                        <Box>
                          <IconButton onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}>
                            <OpenInNew />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDelete(resource.id)}>
                            <Delete />
                          </IconButton>
                        </Box>
                      </Box>
                      {resource.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {resource.description}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ mt: 1.5, color: 'primary.main', wordBreak: 'break-all' }}>
                        {resource.url}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
