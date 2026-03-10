import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

interface Sub {
  testTitle: string;
  score: number;
  total: number;
  accuracy: number;
}

/** Pure algorithmic fallback — no AI call needed */
function generateLocalInsights(submissions: Sub[]) {
  const avgAccuracy = Math.round(submissions.reduce((a, s) => a + s.accuracy, 0) / submissions.length);

  // Find weak tests (below average or below 60%)
  const threshold = Math.min(avgAccuracy, 60);
  const weak = submissions.filter(s => s.accuracy < threshold);
  const weakTopics = weak.length > 0
    ? [...new Set(weak.map(s => s.testTitle))].slice(0, 5)
    : submissions.sort((a, b) => a.accuracy - b.accuracy).slice(0, 3).map(s => s.testTitle);

  const best = Math.max(...submissions.map(s => s.accuracy));
  const worst = Math.min(...submissions.map(s => s.accuracy));

  const recommendations: string[] = [];
  if (avgAccuracy < 50) recommendations.push('Focus on understanding core concepts before attempting more tests.');
  if (avgAccuracy < 70) recommendations.push('Review incorrect answers after each test to identify knowledge gaps.');
  if (weak.length > 0) recommendations.push(`Revisit topics: ${weakTopics.slice(0, 3).join(', ')}.`);
  if (best - worst > 30) recommendations.push('Your performance varies widely — aim for consistency across all topics.');
  recommendations.push('Practice regularly with timed tests to improve speed and accuracy.');
  if (submissions.length < 5) recommendations.push('Take more tests to get more accurate performance analysis.');

  const summary = `Across ${submissions.length} test(s), your average accuracy is ${avgAccuracy}%. ` +
    `Your best score is ${best}% and lowest is ${worst}%. ` +
    (avgAccuracy >= 70 ? 'Good performance overall — keep it up!' : 'There is room for improvement in several areas.');

  return { weakTopics, recommendations: recommendations.slice(0, 5), summary, source: 'local' as const };
}

export async function POST(req: NextRequest) {
  try {
    const { submissions } = await req.json();

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        weakTopics: [],
        recommendations: ['Take more tests to get AI insights.'],
        summary: 'Not enough data to analyze. Please take more tests.',
        source: 'local',
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(generateLocalInsights(submissions));
    }

    // Only send last 10 submissions, compact format
    const recent: Sub[] = submissions.slice(0, 10);
    const compact = recent.map((s: Sub) => `${s.testTitle}:${s.score}/${s.total}(${s.accuracy}%)`).join('|');

    const groq = new Groq({ apiKey });

    const prompt = `Analyze student scores: ${compact}
Reply JSON only: {"weakTopics":["..."],"recommendations":["..."],"summary":"..."}
Give 3 weak topics, 3 recommendations, 1-2 sentence summary.`;

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 512,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json({ ...JSON.parse(jsonMatch[0]), source: 'ai' });
      }
      return NextResponse.json(generateLocalInsights(submissions));
    } catch (aiErr) {
      console.error('AI insights error:', aiErr);
      return NextResponse.json(generateLocalInsights(submissions));
    }
  } catch (err) {
    console.error('Insights route error:', err);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
