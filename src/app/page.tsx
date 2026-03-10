'use client';

import { useRouter } from 'next/navigation';
import { Box, Button, Typography, Container, Grid, Card, CardContent } from '@mui/material';
import { Quiz, Analytics, Psychology, Speed, TrendingUp, SchoolOutlined } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const features = [
  { icon: <Quiz sx={{ fontSize: 40 }} />, title: 'Practice Tests', desc: 'Take tests across multiple categories with real exam-like interface' },
  { icon: <Analytics sx={{ fontSize: 40 }} />, title: 'Performance Analytics', desc: 'Track your progress with detailed score history and topic-wise analysis' },
  { icon: <Psychology sx={{ fontSize: 40 }} />, title: 'AI Explanations', desc: 'Get AI-powered explanations for every question you attempt' },
  { icon: <Speed sx={{ fontSize: 40 }} />, title: 'Real Exam Experience', desc: 'Countdown timer, question navigation, and auto-submit features' },
  { icon: <TrendingUp sx={{ fontSize: 40 }} />, title: 'Weakness Detection', desc: 'AI identifies your weak areas and suggests topics to work on' },
  { icon: <SchoolOutlined sx={{ fontSize: 40 }} />, title: 'Multi-Category', desc: 'Programming, Aptitude, Reasoning, English, UPSC, and more' },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } };

export default function HomePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin') router.push('/admin');
      else if (profile.role === 'instructor') router.push('/instructor');
      else router.push('/dashboard');
    }
  }, [user, profile, router]);

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F5F7FA 0%, #E8ECFF 100%)' }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 14 }, pb: 8, textAlign: 'center' }}>
        <m.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, fontSize: { xs: '2rem', md: '3.5rem' } }}>
            Master Your Exams with{' '}
            <Box component="span" sx={{ background: 'linear-gradient(135deg, #6C63FF, #FF6584)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              EduTech
            </Box>
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            Practice tests, performance analytics, and AI-powered insights — everything you need to ace competitive exams.
          </Typography>
        </m.div>
        <m.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" size="large" onClick={() => router.push('/signup')}
              sx={{ px: 5, py: 1.5, fontSize: '1.1rem', background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
              Get Started Free
            </Button>
            <Button variant="outlined" size="large" onClick={() => router.push('/login')}
              sx={{ px: 5, py: 1.5, fontSize: '1.1rem' }}>
              Sign In
            </Button>
          </Box>
        </m.div>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 10 }}>
        <m.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <Grid container spacing={3}>
            {features.map((f, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <m.div variants={item}>
                  <Card sx={{ height: '100%', transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 40px rgba(108,99,255,0.15)' } }}>
                    <CardContent sx={{ p: 4, textAlign: 'center' }}>
                      <Box sx={{ color: 'primary.main', mb: 2 }}>{f.icon}</Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>{f.title}</Typography>
                      <Typography color="text.secondary">{f.desc}</Typography>
                    </CardContent>
                  </Card>
                </m.div>
              </Grid>
            ))}
          </Grid>
        </m.div>
      </Container>
    </Box>
  );
}
