'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Skeleton, TextField, InputAdornment, Select,
  MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Search, People } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

  useEffect(() => {
    const load = async () => {
      try {
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
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

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
