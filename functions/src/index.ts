import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as path from "path";

// Initialize with service account credentials
const serviceAccount = require(path.resolve(__dirname, "../../hema-satya-foods-firebase-adminsdk-fbsvc-ef66ebb2cc.json"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Initialize Gemini AI - API key stored in Firebase config
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.key || "";
  if (!apiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Gemini API key not configured"
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

// ==========================================
// TEST EVALUATION
// ==========================================
export const evaluateTest = functions.https.onCall(async (request) => {
  const { testId, answers, userId } = request.data;

  if (!testId || !answers || !userId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  // Fetch questions for the test
  const questionsSnap = await db
    .collection("questions")
    .where("testId", "==", testId)
    .get();

  let score = 0;
  const total = questionsSnap.size;

  questionsSnap.forEach((doc) => {
    const q = doc.data();
    const userAnswer = answers[doc.id];
    if (
      userAnswer &&
      userAnswer.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()
    ) {
      score++;
    }
  });

  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  // Get test title
  const testDoc = await db.collection("tests").doc(testId).get();
  const testTitle = testDoc.exists ? testDoc.data()?.title || "" : "";

  // Store submission
  const submission = {
    userId,
    testId,
    testTitle,
    answers,
    score,
    total,
    accuracy,
    timeTaken: request.data.timeTaken || 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("submissions").add(submission);

  return { score, total, accuracy };
});

// ==========================================
// AI EXPLANATION
// ==========================================
export const explainAnswer = functions.https.onCall(async (request) => {
  const { questionText, correctAnswer, options } = request.data;

  if (!questionText || !correctAnswer) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing question or answer"
    );
  }

  const model = getGeminiModel();

  const prompt = `You are an educational tutor. Explain the following question and its correct answer clearly and concisely. Keep the explanation under 200 words.

Question: ${questionText}
${options ? `Options: ${options.join(", ")}` : ""}
Correct Answer: ${correctAnswer}

Provide a clear, step-by-step explanation of why this is the correct answer. If there are common mistakes students make, briefly mention them.`;

  const result = await model.generateContent(prompt);
  const explanation = result.response.text();

  return { explanation };
});

// ==========================================
// AI WEAKNESS DETECTION
// ==========================================
export const analyzeWeakness = functions.https.onCall(async (request) => {
  const { userId } = request.data;

  if (!userId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing userId");
  }

  // Fetch user's submissions
  const subsSnap = await db
    .collection("submissions")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  if (subsSnap.empty) {
    return {
      weakTopics: [],
      recommendations: ["Take more tests to get AI insights."],
      summary: "Not enough data to analyze. Please take more tests.",
    };
  }

  const submissions: Array<{
    testTitle: string;
    score: number;
    total: number;
    accuracy: number;
  }> = [];

  subsSnap.forEach((doc) => {
    const d = doc.data();
    submissions.push({
      testTitle: d.testTitle || "Unknown",
      score: d.score,
      total: d.total,
      accuracy: d.accuracy,
    });
  });

  const model = getGeminiModel();

  const prompt = `You are an educational performance analyst. Analyze the following test performance data and provide insights.

Student Test History:
${submissions.map((s, i) => `${i + 1}. ${s.testTitle}: Score ${s.score}/${s.total} (${s.accuracy}%)`).join("\n")}

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{
  "weakTopics": ["topic1", "topic2", "topic3"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "summary": "A 2-3 sentence summary of the student's performance."
}

Provide 3-5 weak topics, 3-5 actionable recommendations, and a brief summary.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      weakTopics: ["Unable to determine"],
      recommendations: ["Continue taking tests for better analysis."],
      summary: responseText.slice(0, 300),
    };
  } catch {
    return {
      weakTopics: ["Analysis pending"],
      recommendations: ["Take more tests for accurate analysis."],
      summary: "AI analysis is being refined. Please try again later.",
    };
  }
});

// ==========================================
// AI QUESTION GENERATOR
// ==========================================
export const generateQuestions = functions.https.onCall(async (request) => {
  const { prompt: userPrompt, count = 5, difficulty = "Medium", type = "mcq" } = request.data;

  if (!userPrompt) {
    throw new functions.https.HttpsError("invalid-argument", "Missing prompt");
  }

  const model = getGeminiModel();

  const questionType =
    type === "mcq"
      ? "multiple choice questions with 4 options"
      : type === "true_false"
      ? "true/false questions"
      : "short answer questions";

  const prompt = `You are an expert question creator for competitive exams. Generate exactly ${count} ${difficulty} difficulty ${questionType} based on this topic:

"${userPrompt}"

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{
  "questions": [
    {
      "questionText": "The question text",
      "type": "${type}",
      "options": ${type === "mcq" ? '["Option A", "Option B", "Option C", "Option D"]' : type === "true_false" ? '["True", "False"]' : "[]"},
      "correctAnswer": "The correct answer (must match one of the options exactly for MCQ/TF)",
      "difficulty": "${difficulty}",
      "explanation": "Brief explanation of the answer"
    }
  ]
}

Requirements:
- Each question must be unique and well-formed.
- For MCQ, exactly 4 options with one correct answer.
- Explanations should be concise (1-2 sentences).
- Questions should be appropriate for the ${difficulty} difficulty level.
- Generate exactly ${count} questions.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { questions: parsed.questions || [] };
    }
    return { questions: [] };
  } catch {
    return { questions: [] };
  }
});
