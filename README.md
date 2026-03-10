# EduTech — Online Test & Analytics Platform

A modern practice test and performance analytics platform built with Next.js, Firebase, Material UI, Framer Motion, Recharts, and Google Gemini AI.

## Features

- **3 Roles**: Student, Instructor, Admin
- **Full Test Engine**: Timer, question navigation, mark-for-review, auto-submit, randomized options
- **Question Types**: MCQ, True/False, Short Answer, Paragraph
- **Analytics Dashboards**: Score trends, performance distribution, topic-wise analysis, weak areas
- **AI Features** (Google Gemini): Answer explanations, weakness analysis, question generation
- **Instructor Tools**: Create tests with stepper wizard, view submissions, AI question generator
- **Admin Tools**: User management, category/topic CRUD, platform analytics

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **UI**: Material UI 7, Framer Motion, Recharts
- **Backend**: Firebase (Auth, Firestore, Cloud Functions, Storage)
- **AI**: Google Gemini 2.0 Flash via Firebase Cloud Functions

## Setup

### 1. Install dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase project credentials:

```bash
cp .env.local.example .env.local
```

### 3. Set up Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password provider)
3. Enable **Cloud Firestore**
4. Copy your web app config into `.env.local`
5. Update `.firebaserc` with your project ID

### 4. Set up Gemini AI (optional)

For AI features, set the Gemini API key in Cloud Functions config:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

### 5. Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Deploy

**Frontend** — Deploy to Vercel:

```bash
npx vercel
```

**Cloud Functions** — Deploy to Firebase:

```bash
cd functions
npm run deploy
```

## Project Structure

```
src/
  app/              # Next.js App Router pages
    admin/          # Admin dashboard, user mgmt, categories, analytics
    ai-insights/    # AI weakness analysis page
    analytics/      # Student analytics dashboard
    dashboard/      # Student dashboard
    instructor/     # Instructor dashboard, test creator, AI generator
    login/          # Login page
    signup/         # Registration page
    results/        # Test results & review
    tests/          # Test listing, detail, attempt engine
    unauthorized/   # Access denied page
  components/       # Shared components (DashboardLayout, ProtectedRoute, Providers)
  contexts/         # AuthContext with Firebase Auth
  lib/              # Firebase config, MUI theme
functions/          # Firebase Cloud Functions (evaluateTest, explainAnswer, analyzeWeakness, generateQuestions)
```

## Creating the Admin User

After your first signup, manually set the user's role to `admin` in Firestore:

1. Go to Firebase Console → Firestore
2. Find the user document in the `users` collection
3. Change the `role` field from `"student"` to `"admin"`
