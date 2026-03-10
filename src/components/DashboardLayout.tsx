'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
  Chip,
  InputBase,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Quiz,
  Analytics,
  People,
  Category,
  Add,
  Logout,
  Person,
  Psychology,
  Search,
  Notifications,
  Settings,
  NoteAdd,
  Assignment,
  BarChart,
  AutoAwesome,
  Leaderboard,
} from '@mui/icons-material';
import { motion as m, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const DRAWER_WIDTH = 280;

const studentNav = [
  { label: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
  { label: 'Tests', path: '/tests', icon: <Quiz /> },
  { label: 'My Results', path: '/results', icon: <Analytics /> },
  { label: 'Analytics', path: '/analytics', icon: <Analytics /> },
  { label: 'AI Insights', path: '/ai-insights', icon: <Psychology /> },
];

const instructorNav = [
  { label: 'Dashboard', path: '/instructor', icon: <Dashboard />, section: 'Overview' },
  { label: 'Create Test', path: '/instructor/create-test', icon: <NoteAdd />, section: 'Management' },
  { label: 'My Tests', path: '/instructor/tests', icon: <Assignment /> },
  { label: 'Student Analytics', path: '/instructor/analytics', icon: <Leaderboard />, section: 'Analysis' },
  { label: 'AI Reports', path: '/instructor/ai-reports', icon: <AutoAwesome /> },
];

const adminNav = [
  { label: 'Dashboard', path: '/admin', icon: <Dashboard /> },
  { label: 'Users', path: '/admin/users', icon: <People /> },
  { label: 'Categories', path: '/admin/categories', icon: <Category /> },
  { label: 'Analytics', path: '/admin/analytics', icon: <Analytics /> },
];

const roleColors: Record<string, string> = {
  student: '#6C63FF',
  instructor: '#10B981',
  admin: '#F59E0B',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const navItems =
    profile?.role === 'admin'
      ? adminNav
      : profile?.role === 'instructor'
      ? instructorNav
      : studentNav;

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const roleColor = roleColors[profile?.role || 'student'];

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      {/* Logo */}
      <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6C63FF, #FF6584)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(108, 99, 255, 0.4)',
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>E</Typography>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            EduTech
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Learning Platform
          </Typography>
        </Box>
      </Box>

      {/* Profile Card */}
      <Box sx={{ mx: 2, mb: 2, p: 2, borderRadius: 3, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: roleColor, fontSize: 16, fontWeight: 700, boxShadow: `0 0 0 3px rgba(255,255,255,0.1)` }}>
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name || 'User'}
            </Typography>
            <Chip
              label={profile?.role || 'student'}
              size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, bgcolor: `${roleColor}25`, color: roleColor, border: `1px solid ${roleColor}40` }}
            />
          </Box>
        </Box>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 1.5, flex: 1 }}>
        {navItems.map((navItem, idx) => {
          const active = pathname === navItem.path;
          const section = 'section' in navItem ? String((navItem as Record<string, unknown>).section) : '';
          return (
            <Box key={navItem.path}>
              {section && (
                <Typography sx={{ px: 2, mt: idx === 0 ? 0 : 1.5, mb: 0.5, color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {section}
                </Typography>
              )}
            <ListItemButton
              key={navItem.path}
              onClick={() => {
                router.push(navItem.path);
                if (isMobile) setDrawerOpen(false);
              }}
              sx={{
                borderRadius: '12px',
                mb: 0.5,
                py: 1.2,
                px: 2,
                position: 'relative',
                backgroundColor: active ? 'rgba(108, 99, 255, 0.15)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                '&:hover': {
                  backgroundColor: active ? 'rgba(108, 99, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                },
                '&::before': active ? {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 4,
                  height: '60%',
                  borderRadius: 4,
                  background: 'linear-gradient(180deg, #6C63FF, #FF6584)',
                } : {},
                transition: 'all 0.2s ease',
              }}
            >
              <ListItemIcon sx={{ color: active ? '#6C63FF' : 'rgba(255,255,255,0.4)', minWidth: 40, transition: 'color 0.2s' }}>
                {navItem.icon}
              </ListItemIcon>
              <ListItemText
                primary={navItem.label}
                primaryTypographyProps={{ fontWeight: active ? 600 : 400, fontSize: 14 }}
              />
              {active && (
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6C63FF', boxShadow: '0 0 10px rgba(108,99,255,0.6)' }} />
              )}
            </ListItemButton>
            </Box>
          );
        })}
      </List>

      {/* Bottom Section */}
      <Box sx={{ p: 2, m: 1.5, borderRadius: 3, background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(255,101,132,0.1))', border: '1px solid rgba(108,99,255,0.15)' }}>
        <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, mb: 0.5 }}>
          {profile?.role === 'instructor' ? 'Instructor Tools' : 'Need Help?'}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 1.5 }}>
          {profile?.role === 'instructor'
            ? 'Use AI Reports to analyze test performance and identify student weak areas'
            : 'Check our AI insights for personalized recommendations'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { borderRadius: '0 20px 20px 0', overflow: 'hidden', border: 'none' } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH,
              border: 'none',
              overflow: 'hidden',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, ml: isMobile ? 0 : `${DRAWER_WIDTH}px` }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {isMobile && (
              <IconButton onClick={() => setDrawerOpen(true)} sx={{ mr: 1, color: '#333' }}>
                <MenuIcon />
              </IconButton>
            )}

            {/* Search */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, flex: 1, maxWidth: 400,
              bgcolor: 'rgba(0,0,0,0.04)', borderRadius: '12px', px: 2, py: 0.5,
              border: '1px solid transparent',
              transition: 'all 0.2s',
              '&:focus-within': { bgcolor: '#fff', borderColor: '#6C63FF30', boxShadow: '0 0 0 3px rgba(108,99,255,0.08)' },
            }}>
              <Search sx={{ color: 'text.disabled', fontSize: 20 }} />
              <InputBase placeholder="Search..." sx={{ flex: 1, fontSize: 14, '& input': { p: 0 } }} />
            </Box>

            <Box sx={{ flex: 1 }} />

            <IconButton sx={{ color: '#666' }}>
              <Badge variant="dot" color="error">
                <Notifications sx={{ fontSize: 22 }} />
              </Badge>
            </IconButton>
            <IconButton sx={{ color: '#666' }}>
              <Settings sx={{ fontSize: 22 }} />
            </IconButton>
            <Divider orientation="vertical" sx={{ height: 28, mx: 1 }} />
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: roleColor, fontSize: 14, fontWeight: 700 }}>
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
              PaperProps={{ sx: { borderRadius: 3, minWidth: 200, mt: 1, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' } }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography fontWeight={600} fontSize={14}>{profile?.name}</Typography>
                <Typography color="text.secondary" fontSize={12}>{profile?.email}</Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); }} sx={{ py: 1.5, gap: 1.5 }}>
                <Person sx={{ fontSize: 20, color: '#666' }} /> Profile
              </MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); }} sx={{ py: 1.5, gap: 1.5 }}>
                <Settings sx={{ fontSize: 20, color: '#666' }} /> Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleSignOut} sx={{ py: 1.5, gap: 1.5, color: '#EF4444' }}>
                <Logout sx={{ fontSize: 20 }} /> Sign Out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <AnimatePresence mode="wait">
          <Box
            component={m.div}
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            sx={{ flex: 1, p: { xs: 2, sm: 3, md: 4 } }}
          >
            {children}
          </Box>
        </AnimatePresence>
      </Box>
    </Box>
  );
}
