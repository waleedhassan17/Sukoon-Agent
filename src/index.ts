// src/index.ts
// Sukoon AI Agent - standalone Express server.
// Deployable to Render, Railway, Cloud Run, Fly.io, any Node host.

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import * as admin from "firebase-admin";

import { runAgent } from "./agent";
import { checkRateLimit } from "./rateLimit";

// ---------------------------------------------------------------------------
// Firebase Admin initialization
// ---------------------------------------------------------------------------
// Service account credentials come from an env var (single-line JSON string)
// stored as a secret in Render/Railway/etc.
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT env var");
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountJson);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY env var");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(cors({ origin: true })); // allow requests from your mobile app

// Health check (for Render, Cloud Run uptime checks)
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "sukoon-agent" });
});

// ---------------------------------------------------------------------------
// Auth middleware: verifies Firebase ID token from Authorization header
// ---------------------------------------------------------------------------
interface AuthedRequest extends Request {
  uid?: string;
}

async function verifyFirebaseToken(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "unauthenticated",
      message: "Missing Authorization header",
    });
  }

  const token = header.substring(7);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    return next();
  } catch (err: any) {
    return res.status(401).json({
      error: "unauthenticated",
      message: "Invalid or expired token",
    });
  }
}

// ---------------------------------------------------------------------------
// Main agent endpoint
// ---------------------------------------------------------------------------
app.post("/agent", verifyFirebaseToken, async (req: AuthedRequest, res) => {
  const userId = req.uid!;
  const { message, sessionId } = req.body || {};

  // Validate
  if (typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "Message is required.",
    });
  }
  if (message.length > 2000) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "Message too long (max 2000 chars).",
    });
  }
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "sessionId is required.",
    });
  }

  // Rate limit
  try {
    await checkRateLimit(userId);
  } catch (err: any) {
    console.warn(`Rate limit hit for ${userId}: ${err.message}`);
    return res.status(429).json({
      error: "resource-exhausted",
      message: err.message,
    });
  }

  // Run the agent
  try {
    const result = await runAgent(
      userId,
      sessionId,
      message.trim(),
      GEMINI_API_KEY!
    );
    console.log(`Agent reply for ${userId}: ${result.commands.length} commands`);
    return res.json(result);
  } catch (err: any) {
    console.error(`Agent error for ${userId}:`, err);
    return res.status(500).json({
      error: "internal",
      message: "Sorry, something went wrong. Please try again.",
    });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Sukoon agent listening on port ${PORT}`);
});
