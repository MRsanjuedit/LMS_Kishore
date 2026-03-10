import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: NextRequest) {
  try {
    const { testTitle, questions, submissions } = await req.json();

    if (!testTitle || !questions || !submissions) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
    }

    const groq = new Groq({ apiKey });

    // Build compact per-question stats to minimize tokens
    const qStats = questions.map((q: { id: string; questionText: string; difficulty: string; type: string; correctAnswer: string }, i: number) => {
      const correct = submissions.filter((s: { answers: Record<string, string> }) =>
        s.answers?.[q.id]?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()
      ).length;
      const rate = submissions.length > 0 ? Math.round((correct / submissions.length) * 100) : 0;
      return `Q${i + 1}[${q.difficulty}]:${rate}%correct "${q.questionText.slice(0, 60)}"`;
    }).join('|');

    const scoreSummary = submissions.map((s: { score: number; total: number; accuracy: number; timeTaken: number }, i: number) =>
      `S${i + 1}:${s.score}/${s.total}(${s.accuracy}%)${s.timeTaken ? ` ${s.timeTaken}min` : ''}`
    ).join('|');

    const prompt = `Analyze test "${testTitle}" with ${questions.length} questions and ${submissions.length} submissions.

Questions: ${qStats}
Scores: ${scoreSummary}

Reply JSON only:
{"overview":"3-4 sentence summary","averageScore":<num>,"passRate":<num>,"hardestQuestions":[{"questionNumber":1,"questionText":"...","correctRate":25,"insight":"..."}],"easiestQuestions":[{"questionNumber":3,"questionText":"...","correctRate":95,"insight":"..."}],"difficultyAnalysis":{"Easy":{"count":0,"avgCorrectRate":0},"Medium":{"count":0,"avgCorrectRate":0},"Hard":{"count":0,"avgCorrectRate":0}},"recommendations":["...","...","...","..."],"studentPerformanceBands":{"excellent":{"range":"90-100%","count":0},"good":{"range":"70-89%","count":0},"average":{"range":"50-69%","count":0},"needsImprovement":{"range":"below 50%","count":0}},"keyInsights":["...","...","..."]}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1024,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ report: parsed });
    }

    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  } catch (err) {
    console.error('AI report error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
