import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Read project_id from the service account JSON at build time
let projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const saPath = join(process.cwd(), "hema-satya-foods-firebase-adminsdk-fbsvc-ef66ebb2cc.json");
if (existsSync(saPath)) {
  try {
    const sa = JSON.parse(readFileSync(saPath, "utf-8"));
    projectId = sa.project_id || projectId;
  } catch { /* ignore parse errors */ }
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${projectId}.firebasestorage.app`,
  },
};

export default nextConfig;
