'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Grid, Stepper,
  Step, StepLabel, IconButton, Chip, Divider, Alert,
  RadioGroup, FormControlLabel, Radio, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tabs, Tab, Accordion, AccordionSummary, AccordionDetails,
  Paper, Checkbox, FormGroup
} from '@mui/material';
import { Add, Delete, Save, ArrowBack, ArrowForward, Visibility, ContentPaste, ExpandMore, CheckCircle } from '@mui/icons-material';
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



interface QuestionInput {
  questionText: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'paragraph';
  options: string[];
  correctAnswer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  explanation: string;
}

type TestStatus = 'draft' | 'published';

const emptyQuestion: QuestionInput = {
  questionText: '',
  type: 'mcq',
  options: ['', '', '', ''],
  correctAnswer: '',
  difficulty: 'Medium',
  explanation: '',
};

const steps = ['Test Details', 'Add Questions', 'Select Target Colleges', 'Set Schedule', 'Config Preview', 'Publish Test'];

// ---------------------------------------------------------------------------
// MDX-style format guide (shown as placeholder / example)
// ---------------------------------------------------------------------------
const MDX_FORMAT_GUIDE = `---
title: My Test Title
duration: 30
description: Optional description here
---

## What is 2 + 2?
- [ ] 1
- [ ] 3
- [x] 4
- [ ] 5
difficulty: Easy
explanation: Two plus two equals four.

## Is the sky blue?
type: true_false
answer: True
difficulty: Easy

## What is the chemical formula for water?
type: short_answer
answer: H2O
difficulty: Medium
explanation: Water is dihydrogen monoxide.`;

// ---------------------------------------------------------------------------
// MDX Parser — converts pasted text into test state
// ---------------------------------------------------------------------------
function parseMDX(text: string): {
  title: string;
  duration: number; description: string; questions: QuestionInput[];
} | { error: string } {
  try {
    // --- frontmatter ---
    const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let title = '', duration = 30, description = '';
    if (fmMatch) {
      const fm = fmMatch[1];
      title       = fm.match(/title:\s*(.+)/)?.[1]?.trim() ?? '';
      duration    = parseInt(fm.match(/duration:\s*(\d+)/)?.[1] ?? '30', 10);
      description = fm.match(/description:\s*(.+)/)?.[1]?.trim() ?? '';
    }

    // --- body: split on ## headers ---
    const body = fmMatch ? text.slice(fmMatch[0].length).trim() : text.trim();
    const blocks = body.split(/\n(?=##\s)/m).map(b => b.trim()).filter(b => b.startsWith('## '));

    if (blocks.length === 0) {
      return { error: 'No questions found. Each question must start with "## " (double hash + space).' };
    }

    const questions: QuestionInput[] = [];

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const questionText = lines[0].replace(/^##\s+/, '').trim();
      if (!questionText) continue;

      const typeRaw  = lines.find(l => /^type:\s*/i.test(l))?.replace(/^type:\s*/i, '').trim();
      const diffRaw  = lines.find(l => /^difficulty:\s*/i.test(l))?.replace(/^difficulty:\s*/i, '').trim();
      const explRaw  = lines.find(l => /^explanation:\s*/i.test(l))?.replace(/^explanation:\s*/i, '').trim() ?? '';
      const answerRaw = lines.find(l => /^answer:\s*/i.test(l))?.replace(/^answer:\s*/i, '').trim() ?? '';

      const difficulty: QuestionInput['difficulty'] =
        diffRaw === 'Easy' || diffRaw === 'Hard' ? diffRaw : 'Medium';

      const optionLines = lines.filter(l => /^-\s*\[.\]/.test(l));
      const allOptions  = optionLines.map(l => l.replace(/^-\s*\[.\]\s*/, '').trim());
      const correctFromCheckbox = optionLines
        .find(l => /^-\s*\[x\]/i.test(l))
        ?.replace(/^-\s*\[x\]\s*/i, '').trim() ?? '';

      if (typeRaw === 'true_false') {
        const ca = answerRaw === 'True' || answerRaw === 'False' ? answerRaw : 'True';
        questions.push({ questionText, type: 'true_false', options: ['True', 'False'], correctAnswer: ca, difficulty, explanation: explRaw });
      } else if (typeRaw === 'short_answer') {
        questions.push({ questionText, type: 'short_answer', options: [], correctAnswer: answerRaw, difficulty, explanation: explRaw });
      } else if (typeRaw === 'paragraph') {
        questions.push({ questionText, type: 'paragraph', options: [], correctAnswer: answerRaw, difficulty, explanation: explRaw });
      } else {
        // MCQ (default)
        if (allOptions.length < 2) {
          return { error: `"${questionText.slice(0, 50)}" needs at least 2 options marked with - [ ] or - [x].` };
        }
        const correctAnswer = correctFromCheckbox || answerRaw;
        if (!correctAnswer) {
          return { error: `"${questionText.slice(0, 50)}" has no correct answer. Mark one option with - [x].` };
        }
        const padded = [...allOptions, '', '', '', ''].slice(0, Math.max(4, allOptions.length));
        questions.push({ questionText, type: 'mcq', options: padded, correctAnswer, difficulty, explanation: explRaw });
      }
    }

    if (questions.length === 0) return { error: 'No valid questions parsed.' };
    return { title, duration, description, questions };
  } catch {
    return { error: 'Failed to parse. Please check the syntax and try again.' };
  }
}

export default function CreateTestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Quick-Paste mode
  const [inputMode, setInputMode] = useState<'manual' | 'paste'>('manual');
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState('');

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);

  // Test details
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState('');
  const [targetColleges, setTargetColleges] = useState<string[]>([]);
  const [newCollegeValue, setNewCollegeValue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [collegesList, setCollegesList] = useState<string[]>([]);

  // Questions
  const [questions, setQuestions] = useState<QuestionInput[]>([{ ...emptyQuestion }]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cols] = await Promise.all([
          getCachedOrFetch('colleges_all', 10 * 60 * 1000, async () => {
            const snap = await getDocs(collection(db, 'colleges'));
            const list: string[] = [];
            snap.forEach(d => { if (d.data().name) list.push(d.data().name); });
            return list;
          }),
        ]);
        setCollegesList(cols.length > 0 ? cols : ['Other']);
      } catch (err) {
        console.error('Error loading config from Firebase (check permissions):', err);
        setCollegesList(['Other']);
      }
    };
    load();
  }, []);


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

  const handleParseAndLoad = () => {
    setParseError('');
    if (!pasteText.trim()) {
      setParseError('Please paste your test content first.');
      return;
    }
    const result = parseMDX(pasteText);
    if ('error' in result) {
      setParseError(result.error);
      return;
    }
    setTitle(result.title);
    setDuration(result.duration);
    setDescription(result.description);
    setQuestions(result.questions);
    toast.success(`Loaded ${result.questions.length} question${result.questions.length !== 1 ? 's' : ''} successfully!`);
    setInputMode('manual');
    setActiveStep(1);
  };

  const validateForPublish = (): boolean => {
    if (!title.trim() || !duration || duration < 1) {
      toast.error('Please complete test details before publishing');
      return false;
    }

    if (questions.length === 0) {
      toast.error('Please add at least one question');
      return false;
    }

    for (const q of questions) {
      if (!q.questionText.trim()) {
        toast.error('Every question must have question text');
        return false;
      }

      if (q.type === 'mcq') {
        const validOptions = q.options.map(opt => opt.trim()).filter(Boolean);
        if (validOptions.length < 2) {
          toast.error('Each MCQ must have at least 2 options');
          return false;
        }
        if (!q.correctAnswer.trim() || !validOptions.includes(q.correctAnswer.trim())) {
          toast.error('Each MCQ must have a valid correct answer from options');
          return false;
        }
      } else if (q.type === 'true_false') {
        if (q.correctAnswer !== 'True' && q.correctAnswer !== 'False') {
          toast.error('True/False questions must have True or False as answer');
          return false;
        }
      } else if (!q.correctAnswer.trim()) {
        toast.error('Short/Paragraph questions must have a correct answer');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (submitStatus: TestStatus) => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (submitStatus === 'published' && !validateForPublish()) {
      return;
    }

    setSaving(true);
    try {
      const testRef = await addDoc(collection(db, 'tests'), {
        title,
        duration,
        description,
        targetColleges,
        startTime: startTime || null,
        endTime: endTime || null,
        questionCount: questions.length,
        status: submitStatus,
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

      toast.success(submitStatus === 'draft' ? 'Draft saved successfully!' : 'Test published successfully!');
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

          {/* ── Header + mode toggle ── */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h4">Create Test</Typography>
            <Tabs
              value={inputMode}
              onChange={(_, v) => { setInputMode(v); setParseError(''); }}
              sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}
            >
              <Tab value="manual" label="Manual Entry" />
              <Tab
                value="paste"
                label="Quick Paste"
                icon={<ContentPaste fontSize="small" />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* ══════════════════════════════════════════════
              QUICK PASTE MODE — notepad-style MDX editor
          ══════════════════════════════════════════════ */}
          {inputMode === 'paste' && (
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Card sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>Paste Your Test (MDX Format)</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Write or paste your test below using the simple MDX format. Click <strong>Parse &amp; Load</strong> to import all questions at once.
                  </Typography>

                  <TextField
                    fullWidth
                    multiline
                    rows={20}
                    value={pasteText}
                    onChange={e => { setPasteText(e.target.value); setParseError(''); }}
                    placeholder={MDX_FORMAT_GUIDE}
                    inputProps={{
                      style: {
                        fontFamily: '"Fira Code", "Cascadia Code", "Courier New", monospace',
                        fontSize: '13px',
                        lineHeight: '1.7',
                      },
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': { bgcolor: '#1a1b26' },
                      '& textarea': { color: '#c0caf5' },
                      '& textarea::placeholder': { color: '#565f89', opacity: 1 },
                    }}
                  />

                  {parseError && <Alert severity="error" sx={{ mb: 2 }}>{parseError}</Alert>}

                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      onClick={handleParseAndLoad}
                      sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
                    >
                      Parse &amp; Load
                    </Button>
                    <Button variant="outlined" onClick={() => setPasteText(MDX_FORMAT_GUIDE)}>
                      Load Example
                    </Button>
                    {pasteText && (
                      <Button color="error" onClick={() => { setPasteText(''); setParseError(''); }}>
                        Clear
                      </Button>
                    )}
                  </Box>

                  {/* Format guide accordion */}
                  <Accordion sx={{ mt: 3 }} disableGutters elevation={0} variant="outlined">
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="body2" fontWeight={600}>Format Reference</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 2 }}>
                      <Box sx={{ display: 'grid', gap: 2 }}>

                        <Alert severity="info" icon={false}>
                          <Typography variant="body2" fontWeight={700} gutterBottom>Frontmatter (optional — place at the very top)</Typography>
                          <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, m: 0, whiteSpace: 'pre-wrap' }}>
{`---
title: My Test Title
duration: 30
description: A short description
---`}
                          </Box>
                        </Alert>

                        <Alert severity="success" icon={false}>
                          <Typography variant="body2" fontWeight={700} gutterBottom>MCQ Question (default type)</Typography>
                          <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, m: 0, whiteSpace: 'pre-wrap' }}>
{`## What is 2 + 2?
- [ ] 1
- [ ] 3
- [x] 4    ← correct answer (use [x])
- [ ] 5
difficulty: Easy
explanation: Two plus two is four.`}
                          </Box>
                        </Alert>

                        <Alert severity="warning" icon={false}>
                          <Typography variant="body2" fontWeight={700} gutterBottom>True / False Question</Typography>
                          <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, m: 0, whiteSpace: 'pre-wrap' }}>
{`## Is the Earth flat?
type: true_false
answer: False
difficulty: Easy`}
                          </Box>
                        </Alert>

                        <Alert severity="warning" icon={false}>
                          <Typography variant="body2" fontWeight={700} gutterBottom>Short Answer</Typography>
                          <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, m: 0, whiteSpace: 'pre-wrap' }}>
{`## What is the chemical formula for water?
type: short_answer
answer: H2O
difficulty: Medium`}
                          </Box>
                        </Alert>

                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            </m.div>
          )}

          {/* ══════════════════════════════════════════════
              MANUAL MODE — stepper wizard
          ══════════════════════════════════════════════ */}
          {inputMode === 'manual' && (
            <>
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

                {/* Step 3: Target Colleges */}
                {activeStep === 2 && (
                  <Card>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ mb: 2 }}>Target Colleges</Typography>
                      <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Select the colleges that should have access to this test. You can publish globally by selecting 'All' or add a new college.
                      </Typography>
                      
                      <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                        <FormControlLabel
                          control={<Checkbox checked={targetColleges.includes('All')} onChange={e => {
                            if (e.target.checked) setTargetColleges(['All']);
                            else setTargetColleges([]);
                          }} />}
                          label="All Colleges (Global)"
                        />
                        {collegesList.map(c => (
                          <FormControlLabel
                            key={c}
                            control={<Checkbox checked={targetColleges.includes(c)} onChange={e => {
                              if (e.target.checked) setTargetColleges(prev => prev.includes('All') ? [c] : [...prev, c]);
                              else setTargetColleges(prev => prev.filter(p => p !== c));
                            }} />}
                            label={c}
                          />
                        ))}
                      </FormGroup>

                      <Divider sx={{ my: 3 }} />
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Add New College</Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField 
                          size="small" 
                          placeholder="College Name" 
                          value={newCollegeValue} 
                          onChange={(e) => setNewCollegeValue(e.target.value)}
                        />
                        <Button 
                          variant="outlined" 
                          onClick={async () => {
                            if (!newCollegeValue.trim()) return;
                            try {
                              const name = newCollegeValue.trim();
                              await addDoc(collection(db, 'colleges'), { name, createdAt: serverTimestamp(), createdBy: user?.uid });
                              setCollegesList(p => [...p, name]);
                              setTargetColleges(p => p.includes('All') ? [name] : [...p, name]);
                              setNewCollegeValue('');
                              toast.success('College added');
                            } catch (error) {
                              toast.error('Failed to add college');
                            }
                          }}
                        >
                          Add
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* Step 4: Schedule */}
                {activeStep === 3 && (
                  <Card>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ mb: 2 }}>Schedule (IST)</Typography>
                      <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Set the available time window for this test. Leave blank if it should be immediately and permanently available.
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="datetime-local"
                            label="Start Time"
                            InputLabelProps={{ shrink: true }}
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="datetime-local"
                            label="End Time"
                            InputLabelProps={{ shrink: true }}
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}

                {/* Step 5: Config Preview */}
                {activeStep === 4 && (
                  <Card>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ mb: 2 }}>Configuration Preview</Typography>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 6 }}><Typography color="text.secondary">Title:</Typography><Typography fontWeight={600}>{title || '-'}</Typography></Grid>
                        <Grid size={{ xs: 6 }}><Typography color="text.secondary">Duration:</Typography><Typography fontWeight={600}>{duration} min</Typography></Grid>
                        <Grid size={{ xs: 6 }}><Typography color="text.secondary">Questions:</Typography><Typography fontWeight={600}>{questions.length}</Typography></Grid>
                        <Grid size={{ xs: 12 }}>
                          <Typography color="text.secondary">Target Colleges:</Typography>
                          <Typography fontWeight={600}>
                            {targetColleges.length === 0 ? 'None selected!' : targetColleges.join(', ')}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Typography color="text.secondary">Schedule:</Typography>
                          <Typography fontWeight={600}>
                            {startTime ? new Date(startTime).toLocaleString() : 'Now'} — {endTime ? new Date(endTime).toLocaleString() : 'Forever'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}

                {/* Step 6: Review Format & Submit */}
                {activeStep === 5 && (
                  <Card>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Test Format Preview</Typography>
                        <Button variant="outlined" startIcon={<Visibility />} onClick={() => setPreviewOpen(true)}>
                          Fullscreen Preview
                        </Button>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Box sx={{ p: 2, bgcolor: '#f4f6f8', borderRadius: 2 }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>{title || 'Untitled Test'}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {questions.length} questions • {duration} min
                        </Typography>
                        
                        {questions.slice(0, 2).map((q, i) => (
                          <Box key={i} sx={{ mb: 2, p: 2, bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                            <Typography fontWeight={600} sx={{ mb: 1 }}>{i + 1}. {q.questionText}</Typography>
                            {q.type === 'mcq' && (
                              <FormGroup>
                                {q.options.map((opt, oi) => (
                                  <FormControlLabel key={oi} control={<Radio disabled />} label={opt} />
                                ))}
                              </FormGroup>
                            )}
                            {q.type === 'true_false' && (
                              <FormGroup>
                                <FormControlLabel control={<Radio disabled />} label="True" />
                                <FormControlLabel control={<Radio disabled />} label="False" />
                              </FormGroup>
                            )}
                            {(q.type === 'short_answer' || q.type === 'paragraph') && (
                              <TextField fullWidth disabled placeholder="Student will enter answer here" />
                            )}
                          </Box>
                        ))}
                        {questions.length > 2 && (
                          <Typography textAlign="center" color="text.secondary" variant="body2">
                            ... and {questions.length - 2} more questions
                          </Typography>
                        )}
                      </Box>
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
                {activeStep < 5 ? (
                  <Button variant="contained" endIcon={<ArrowForward />}
                    onClick={() => setActiveStep(prev => prev + 1)}>
                    Next
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" startIcon={<Save />} onClick={() => handleSubmit('draft')} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Draft'}
                    </Button>
                    <Button variant="contained" startIcon={<Save />} onClick={() => handleSubmit('published')} disabled={saving}
                      sx={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
                      {saving ? 'Publishing...' : 'Publish Test'}
                    </Button>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* ══════════════════════════════════════════════
            PREVIEW DIALOG — student view of the test
        ══════════════════════════════════════════════ */}
        <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth scroll="paper">
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h6">{title || 'Untitled Test'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {duration} min &bull; {questions.length} question{questions.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Chip label="Student View" color="primary" size="small" sx={{ mt: 0.5 }} />
            </Box>
          </DialogTitle>

          <DialogContent dividers>
            {description && <Alert severity="info" sx={{ mb: 3 }}>{description}</Alert>}

            {questions.map((q, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 3, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Typography fontWeight={700} sx={{ flex: 1, pr: 1 }}>Q{i + 1}. {q.questionText}</Typography>
                  <Chip label={q.difficulty} size="small"
                    color={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Hard' ? 'error' : 'warning'} />
                </Box>

                {/* MCQ options */}
                {q.type === 'mcq' && (
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {q.options.filter(o => o.trim()).map((opt, oi) => {
                      const isCorrect = opt === q.correctAnswer;
                      return (
                        <Box key={oi} sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
                          borderRadius: 1, border: '1px solid',
                          borderColor: isCorrect ? 'success.main' : 'divider',
                          bgcolor: isCorrect ? 'success.50' : 'transparent',
                        }}>
                          <Box sx={{
                            width: 22, height: 22, borderRadius: '50%', border: '2px solid',
                            borderColor: isCorrect ? 'success.main' : 'text.secondary',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            {isCorrect && <CheckCircle sx={{ fontSize: 16 }} color="success" />}
                          </Box>
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            <strong>{String.fromCharCode(65 + oi)}.</strong> {opt}
                          </Typography>
                          {isCorrect && <Chip label="Correct" size="small" color="success" />}
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {/* True/False */}
                {q.type === 'true_false' && (
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {['True', 'False'].map(opt => (
                      <Box key={opt} sx={{
                        flex: 1, p: 2, borderRadius: 1, border: '1px solid', textAlign: 'center',
                        borderColor: opt === q.correctAnswer ? 'success.main' : 'divider',
                        bgcolor: opt === q.correctAnswer ? 'success.50' : 'transparent',
                      }}>
                        <Typography fontWeight={opt === q.correctAnswer ? 700 : 400}>
                          {opt} {opt === q.correctAnswer ? '✓' : ''}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Short / Paragraph */}
                {(q.type === 'short_answer' || q.type === 'paragraph') && (
                  <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Expected Answer:</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{q.correctAnswer || '—'}</Typography>
                  </Box>
                )}

                {q.explanation && (
                  <Alert severity="info" icon={false} sx={{ mt: 1.5, py: 0.5 }}>
                    <Typography variant="caption" fontWeight={700}>Explanation: </Typography>
                    <Typography variant="caption">{q.explanation}</Typography>
                  </Alert>
                )}
              </Paper>
            ))}
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

      </DashboardLayout>
    </ProtectedRoute>
  );
}

