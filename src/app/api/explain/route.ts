import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: NextRequest) {
  try {
    const { questionText, correctAnswer, options } = await req.json();

    if (!questionText || !correctAnswer) {
      return NextResponse.json({ error: 'Missing question or answer' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
    }

    const groq = new Groq({ apiKey });

    const prompt = `You are an educational tutor. Explain the following question and its correct answer clearly and concisely. Keep the explanation under 200 words.

Question: ${questionText}
${options ? `Options: ${options.join(', ')}` : ''}
Correct Answer: ${correctAnswer}

Provide a clear, step-by-step explanation of why this is the correct answer. If there are common mistakes students make, briefly mention them.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 512,
    });

    const explanation = completion.choices[0]?.message?.content || 'Unable to generate explanation.';
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error('AI explain error:', err);
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
