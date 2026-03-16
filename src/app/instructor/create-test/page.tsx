'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Grid, Stepper,
  Step, StepLabel, IconButton, Chip, Divider, Alert,
  RadioGroup, FormControlLabel, Radio, Autocomplete,
} from '@mui/material';
import { Add, Delete, Save, ArrowBack, ArrowForward } from '@mui/icons-material';
import { motion as m } from 'framer-motion';
import {
  collection, addDoc, getDocs, serverTimestamp, writeBatch, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCachedOrFetch } from '@/lib/dataCache';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

const CATEGORY_CACHE_TTL = 10 * 60 * 1000;
const TOPIC_CACHE_TTL = 10 * 60 * 1000;

interface QuestionInput {
  questionText: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'paragraph';
  options: string[];
  correctAnswer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  explanation: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface TopicItem {
  id: string;
  categoryId: string;
  name: string;
}

const emptyQuestion: QuestionInput = {
  questionText: '',
  type: 'mcq',
  options: ['', '', '', ''],
  correctAnswer: '',
  difficulty: 'Medium',
  explanation: '',
};

const steps = ['Test Details', 'Add Questions', 'Review & Submit'];

export default function CreateTestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Test details
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [topicId, setTopicId] = useState('');
  const [topicName, setTopicName] = useState('');
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState('');

  // Questions
  const [questions, setQuestions] = useState<QuestionInput[]>([{ ...emptyQuestion }]);

  useEffect(() => {
    const load = async () => {
      const [cats, tops] = await Promise.all([
        getCachedOrFetch('categories_all', CATEGORY_CACHE_TTL, async () => {
          const catsSnap = await getDocs(collection(db, 'categories'));
          const categoryList: CategoryItem[] = [];
          catsSnap.forEach(d => categoryList.push({ id: d.id, ...d.data() } as CategoryItem));
          return categoryList;
        }),
        getCachedOrFetch('topics_all', TOPIC_CACHE_TTL, async () => {
          const topicsSnap = await getDocs(collection(db, 'topics'));
          const topicList: TopicItem[] = [];
          topicsSnap.forEach(d => topicList.push({ id: d.id, ...d.data() } as TopicItem));
          return topicList;
        }),
      ]);
      setCategories(cats);
      setTopics(tops);
    };
    load();
  }, []);

  const filteredTopics = topics.filter(t => t.categoryId === categoryId);

  const updateQuestion = (index: number, field: keyof QuestionInput, value: string | string[]) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[qIndex].options[optIndex] = value;
      return updated;
    });
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, { ...emptyQuestion, options: ['', '', '', ''] }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || (!categoryId && !categoryName) || !duration) {
      toast.error('Please fill in all test details');
      return;
    }
    if (questions.some(q => !q.questionText || !q.correctAnswer)) {
      toast.error('All questions must have text and a correct answer');
      return;
    }

    setSaving(true);
    try {
      const catName = categoryName || categories.find(c => c.id === categoryId)?.name || '';
      const topName = topicName || topics.find(t => t.id === topicId)?.name || '';

      const testRef = await addDoc(collection(db, 'tests'), {
        title,
        categoryId,
        categoryName: catName,
        topicId,
        topicName: topName,
        duration,
        description,
        questionCount: questions.length,
        createdBy: user?.uid,
        createdAt: serverTimestamp(),
      });

      const batch = writeBatch(db);
      questions.forEach(q => {
        const qRef = doc(collection(db, 'questions'));
        batch.set(qRef, {
          testId: testRef.id,
          questionText: q.questionText,
          type: q.type,
          options: q.type === 'mcq' ? q.options.filter(o => o.trim()) : q.type === 'true_false' ? ['True', 'False'] : [],
          correctAnswer: q.correctAnswer,
          difficulty: q.difficulty,
          explanation: q.explanation,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();

      toast.success('Test created successfully!');
      router.push('/instructor/tests');
    } catch (err) {
      console.error('Error creating test:', err);
      toast.error('Failed to create test');
    }
    setSaving(false);
  };

  return (
    <ProtectedRoute allowedRoles={['instructor']}>
      <DashboardLayout>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Typography variant="h4" sx={{ mb: 3 }}>Create Test</Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map(label => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          <m.div key={activeStep} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            {/* Step 1: Test Details */}
            {activeStep === 0 && (
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Test Details</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth label="Test Title" value={title} onChange={e => setTitle(e.target.value)} required />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Autocomplete
                        freeSolo
                        options={categories.map(c => c.name)}
                        value={categoryName}
                        onInputChange={(_, val) => {
                          setCategoryName(val);
                          const match = categories.find(c => c.name === val);
                          setCategoryId(match?.id || '');
                          setTopicName('');
                          setTopicId('');
                        }}
                        renderInput={(params) => <TextField {...params} label="Category" placeholder="Type or select a category" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Autocomplete
                        freeSolo
                        options={categoryId ? filteredTopics.map(t => t.name) : topics.map(t => t.name)}
                        value={topicName}
                        onInputChange={(_, val) => {
                          setTopicName(val);
                          const match = topics.find(t => t.name === val);
                          setTopicId(match?.id || '');
                        }}
                        renderInput={(params) => <TextField {...params} label="Topic" placeholder="Type or select a topic" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth type="number" label="Duration (minutes)" value={duration}
                        onChange={e => setDuration(Number(e.target.value))} inputProps={{ min: 1 }} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth multiline rows={3} label="Description (optional)" value={description}
                        onChange={e => setDescription(e.target.value)} />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Questions */}
            {activeStep === 1 && (
              <Box>
                {questions.map((q, qi) => (
                  <Card key={qi} sx={{ mb: 2 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Question {qi + 1}</Typography>
                        <IconButton color="error" onClick={() => removeQuestion(qi)} disabled={questions.length <= 1}>
                          <Delete />
                        </IconButton>
                      </Box>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12 }}>
                          <TextField fullWidth multiline rows={2} label="Question Text" value={q.questionText}
                            onChange={e => updateQuestion(qi, 'questionText', e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select value={q.type} label="Type"
                              onChange={e => updateQuestion(qi, 'type', e.target.value)}>
                              <MenuItem value="mcq">MCQ</MenuItem>
                              <MenuItem value="true_false">True/False</MenuItem>
                              <MenuItem value="short_answer">Short Answer</MenuItem>
                              <MenuItem value="paragraph">Paragraph</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <FormControl fullWidth>
                            <InputLabel>Difficulty</InputLabel>
                            <Select value={q.difficulty} label="Difficulty"
                              onChange={e => updateQuestion(qi, 'difficulty', e.target.value)}>
                              <MenuItem value="Easy">Easy</MenuItem>
                              <MenuItem value="Medium">Medium</MenuItem>
                              <MenuItem value="Hard">Hard</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        {q.type === 'mcq' && (
                          <>
                            {q.options.map((opt, oi) => (
                              <Grid size={{ xs: 12, sm: 6 }} key={oi}>
                                <TextField fullWidth label={`Option ${String.fromCharCode(65 + oi)}`} value={opt}
                                  onChange={e => updateOption(qi, oi, e.target.value)} />
                              </Grid>
                            ))}
                            <Grid size={{ xs: 12 }}>
                              <FormControl fullWidth>
                                <InputLabel>Correct Answer</InputLabel>
                                <Select value={q.correctAnswer} label="Correct Answer"
                                  onChange={e => updateQuestion(qi, 'correctAnswer', e.target.value)}>
                                  {q.options.filter(o => o.trim()).map((opt, oi) => (
                                    <MenuItem key={oi} value={opt}>{String.fromCharCode(65 + oi)}. {opt}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                          </>
                        )}

                        {q.type === 'true_false' && (
                          <Grid size={{ xs: 12 }}>
                            <RadioGroup row value={q.correctAnswer}
                              onChange={e => updateQuestion(qi, 'correctAnswer', e.target.value)}>
                              <FormControlLabel value="True" control={<Radio />} label="True" />
                              <FormControlLabel value="False" control={<Radio />} label="False" />
                            </RadioGroup>
                          </Grid>
                        )}

                        {(q.type === 'short_answer' || q.type === 'paragraph') && (
                          <Grid size={{ xs: 12 }}>
                            <TextField fullWidth label="Correct Answer" value={q.correctAnswer}
                              onChange={e => updateQuestion(qi, 'correctAnswer', e.target.value)} />
                          </Grid>
                        )}
                        <Grid size={{ xs: 12 }}>
                          <TextField fullWidth multiline rows={2} label="Explanation (optional)" value={q.explanation}
                            onChange={e => updateQuestion(qi, 'explanation', e.target.value)} />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}

                <Button fullWidth variant="outlined" startIcon={<Add />} onClick={addQuestion}
                  sx={{ py: 1.5, borderStyle: 'dashed' }}>
                  Add Question
                </Button>
              </Box>
            )}

            {/* Step 3: Review */}
            {activeStep === 2 && (
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Review Test</Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 6 }}><Typography color="text.secondary">Title:</Typography><Typography fontWeight={600}>{title}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography color="text.secondary">Duration:</Typography><Typography fontWeight={600}>{duration} min</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography color="text.secondary">Category:</Typography><Typography fontWeight={600}>{categoryName || '-'}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography color="text.secondary">Questions:</Typography><Typography fontWeight={600}>{questions.length}</Typography></Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  {questions.map((q, i) => (
                    <Box key={i} sx={{ mb: 1.5 }}>
                      <Typography fontWeight={600}>Q{i + 1}. {q.questionText}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip label={q.type} size="small" />
                        <Chip label={q.difficulty} size="small" color={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Hard' ? 'error' : 'warning'} />
                        <Chip label={`Answer: ${q.correctAnswer}`} size="small" variant="outlined" />
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}
          </m.div>

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button startIcon={<ArrowBack />} disabled={activeStep === 0}
              onClick={() => setActiveStep(prev => prev - 1)}>
              Back
            </Button>
            {activeStep < 2 ? (
              <Button variant="contained" endIcon={<ArrowForward />}
                onClick={() => setActiveStep(prev => prev + 1)}>
                Next
              </Button>
            ) : (
              <Button variant="contained" startIcon={<Save />} onClick={handleSubmit} disabled={saving}
                sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                {saving ? 'Creating...' : 'Create Test'}
              </Button>
            )}
          </Box>
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
