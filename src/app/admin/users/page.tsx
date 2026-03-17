'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Skeleton, TextField, InputAdornment, Select,
  MenuItem, FormControl, InputLabel, Button, Alert,
} from '@mui/material';
import { Search, People } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface UserItem {
  uid: string;
  name: string;
  email: string;
  role: string;
  createdAt?: Date;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [newInstructorName, setNewInstructorName] = useState('');
  const [newInstructorEmail, setNewInstructorEmail] = useState('');
  const [newInstructorPassword, setNewInstructorPassword] = useState('');
  const [creatingInstructor, setCreatingInstructor] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    const snap = await getDocs(collection(db, 'users'));
    const list: UserItem[] = [];
    snap.forEach(d => {
      const data = d.data();
      list.push({
        uid: d.id,
        name: data.name,
        email: data.email,
        role: data.role,
        createdAt: data.createdAt?.toDate(),
      });
    });
    setUsers(list);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await loadUsers();
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, [loadUsers]);

  const handleCreateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMessage(null);

    if (!newInstructorName.trim() || !newInstructorEmail.trim() || !newInstructorPassword) {
      setCreateMessage({ type: 'error', text: 'Name, email and password are required.' });
      return;
    }

    if (newInstructorPassword.length < 6) {
      setCreateMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setCreatingInstructor(true);
    try {
      const createInstructorByAdmin = httpsCallable(functions, 'createInstructorByAdmin');
      await createInstructorByAdmin({
        name: newInstructorName.trim(),
        email: newInstructorEmail.trim(),
        password: newInstructorPassword,
      });

      setCreateMessage({ type: 'success', text: 'Instructor account created successfully.' });
      setNewInstructorName('');
      setNewInstructorEmail('');
      setNewInstructorPassword('');
      await loadUsers();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code.includes('already-exists')) {
        setCreateMessage({ type: 'error', text: 'An account with this email already exists.' });
      } else if (code.includes('permission-denied')) {
        setCreateMessage({ type: 'error', text: 'Only admins can create instructors.' });
      } else {
        setCreateMessage({ type: 'error', text: (err as Error).message || 'Failed to create instructor account.' });
      }
    } finally {
      setCreatingInstructor(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'instructor': return 'warning';
      default: return 'primary';
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <DashboardLayout>
        <Box>
          <Typography variant="h4" sx={{ mb: 3 }}>User Management</Typography>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Add Instructor</Typography>
              {createMessage && (
                <Alert severity={createMessage.type} sx={{ mb: 2 }}>
                  {createMessage.text}
                </Alert>
              )}
              <Box component="form" onSubmit={handleCreateInstructor} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  label="Instructor Name"
                  value={newInstructorName}
                  onChange={e => setNewInstructorName(e.target.value)}
                  size="small"
                  sx={{ minWidth: 220, flex: 1 }}
                />
                <TextField
                  label="Instructor Email"
                  type="email"
                  value={newInstructorEmail}
                  onChange={e => setNewInstructorEmail(e.target.value)}
                  size="small"
                  sx={{ minWidth: 240, flex: 1 }}
                />
                <TextField
                  label="Temporary Password"
                  type="password"
                  value={newInstructorPassword}
                  onChange={e => setNewInstructorPassword(e.target.value)}
                  size="small"
                  sx={{ minWidth: 220, flex: 1 }}
                />
                <Button type="submit" variant="contained" disabled={creatingInstructor}
                  sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                  {creatingInstructor ? 'Creating...' : 'Create Instructor'}
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3, p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="small"
                sx={{ minWidth: 250 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Role</InputLabel>
                <Select value={roleFilter} label="Role" onChange={e => setRoleFilter(e.target.value)}>
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="student">Student</MenuItem>
                  <MenuItem value="instructor">Instructor</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Card>

          {loading ? (
            <Skeleton variant="rounded" height={300} />
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <People sx={{ fontSize: 60, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>No users found</Typography>
              </CardContent>
            </Card>
          ) : (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Joined</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(u => (
                      <TableRow key={u.uid} hover>
                        <TableCell><Typography fontWeight={600}>{u.name}</Typography></TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell><Chip label={u.role} size="small" color={roleColor(u.role) as 'primary'} /></TableCell>
                        <TableCell>{u.createdAt?.toLocaleDateString() || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </m.div>
          )}
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
