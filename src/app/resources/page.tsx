'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button, Skeleton,
} from '@mui/material';
import { OpenInNew, VideoLibrary } from '@mui/icons-material';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface ResourceItem {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'playlist';
  description?: string;
  createdByName?: string;
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'resources'), orderBy('createdAt', 'desc')));
        const list: ResourceItem[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as ResourceItem));
        setResources(list);
      } catch (err) {
        console.error('Failed to load resources:', err);
      }
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
          <Typography variant="h4" sx={{ mb: 1.5 }}>Free Learning Resources</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Instructor-shared YouTube videos and playlists.
          </Typography>

          {loading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Grid size={{ xs: 12, md: 6 }} key={i}><Skeleton variant="rounded" height={170} /></Grid>
              ))}
            </Grid>
          ) : resources.length === 0 ? (
            <Card><CardContent><Typography color="text.secondary">No resources are available yet.</Typography></CardContent></Card>
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
                        <VideoLibrary color="primary" />
                      </Box>
                      {resource.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {resource.description}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Shared by: {resource.createdByName || 'Instructor'}
                      </Typography>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<OpenInNew />}
                        sx={{ mt: 1.5, background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
                        onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}
                      >
                        Open Resource
                      </Button>
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
