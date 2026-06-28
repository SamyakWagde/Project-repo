import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { globalBurnoutModel } from "./server/ml_model";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },

  })
);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
if (!ALLOWED_ORIGIN) {
  throw new Error(
    "FATAL: ALLOWED_ORIGIN env var is not set. " +
      "Set it to your frontend URL (e.g. https://your-app.vercel.app)."
  );
}

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10kb" }));

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_TOKEN_TTL = (process.env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]) ?? "15m";
const REFRESH_TOKEN_TTL = (process.env.REFRESH_TOKEN_TTL as jwt.SignOptions["expiresIn"]) ?? "7d";

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables."
  );
}

const activeRefreshTokens = new Set<string>();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again in 15 minutes.",
  },
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.username ?? req.ip,
  message: {
    error: "You are submitting requests too fast. Please wait a minute.",
  },
});

app.use("/api/", apiLimiter);

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is missing." });
  }

  jwt.verify(token, JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res
        .status(401)
        .json({ error: "Access token is expired or invalid." });
    }
    req.user = user;
    next();
  });
}

app.post("/api/auth/token", async (req, res) => {
  const { username, password } = req.body;

  if (
    !username ||
    typeof username !== "string" ||
    !password ||
    typeof password !== "string"
  ) {
    return res
      .status(400)
      .json({ error: "username and password are required." });
  }

  const storedHash = process.env.APP_PASSWORD_HASH;
  const storedUsername = process.env.APP_USERNAME;

  if (!storedHash || !storedUsername) {

    safeLog("error", "APP_USERNAME / APP_PASSWORD_HASH env vars missing");
    return res.status(500).json({ error: "Authentication service unavailable." });
  }

  const usernameMatch = username === storedUsername;
  const passwordMatch = await bcrypt.compare(password, storedHash);

  if (!usernameMatch || !passwordMatch) {

    return res.status(401).json({ error: "Invalid credentials." });
  }

  const payload = { username };
  const accessToken = jwt.sign(payload, JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TOKEN_TTL,
  });

  activeRefreshTokens.add(refreshToken);

  return res.json({ accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL });
});

app.post("/api/auth/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is missing." });
  }

  if (!activeRefreshTokens.has(refreshToken)) {
    return res.status(403).json({ error: "Refresh token is invalid or revoked." });
  }

  jwt.verify(refreshToken, JWT_REFRESH_SECRET!, (err: any, user: any) => {
    if (err) {
      activeRefreshTokens.delete(refreshToken);
      return res.status(403).json({ error: "Refresh token is expired or invalid." });
    }

    const payload = { username: user.username };
    const newAccessToken = jwt.sign(payload, JWT_SECRET!, {
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const newRefreshToken = jwt.sign(payload, JWT_REFRESH_SECRET!, {
      expiresIn: REFRESH_TOKEN_TTL,
    });

    activeRefreshTokens.delete(refreshToken);
    activeRefreshTokens.add(newRefreshToken);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL,
    });
  });
});

app.post("/api/auth/logout", authenticateToken, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) activeRefreshTokens.delete(refreshToken);
  return res.json({ success: true });
});

let trainingLock: Promise<void> = Promise.resolve();

app.post(
  ["/api/ml/train", "/api/train"],
  authenticateToken,
  async (req, res) => {
    let releaseLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const waitFor = trainingLock;
    trainingLock = lockPromise;

    try {
      await waitFor;
      const lr = parseFloat(req.body.learningRate) || 0.05;
      const eps = parseInt(req.body.epochs, 10) || 600;
      const metrics = globalBurnoutModel.trainModel(lr, eps);
      return res.json({ success: true, metrics });
    } catch (err) {
      safeLog("error", "ML train failed", err);
      return res.status(500).json({ error: "Failed to train machine learning model." });
    } finally {
      releaseLock();
    }
  }
);

app.post(
  ["/api/ml/predict", "/api/predict"],
  authenticateToken,
  (req, res) => {
    try {
      const { inputs } = req.body;
      if (!inputs) {
        return res.status(400).json({ error: "Missing predictive inputs parameter." });
      }
      const result = globalBurnoutModel.predict(inputs);
      return res.json({ success: true, result });
    } catch (err) {
      safeLog("error", "ML predict failed", err);
      return res.status(500).json({ error: "Prediction execution failed." });
    }
  }
);

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined.");
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

function safeLog(level: "info" | "warn" | "error", message: string, err?: unknown) {
  if (IS_PROD) {
    console[level](`[${level.toUpperCase()}] ${message}`);
  } else {
    console[level](`[${level.toUpperCase()}] ${message}`, err ?? "");
  }
}

function sanitizeForPrompt(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/(`{3,})/g, "'''")                          // neutralise code fences
    .replace(/(ignore|disregard|forget)\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/gi, "[REDACTED]")
    .replace(/(system\s*prompt|you are now|act as|jailbreak)/gi, "[REDACTED]")
    .slice(0, 5000)
    .trim();
}

const BiometricsSchema = z.object({
  hrv: z.number().min(0).max(300),
  restingHR: z.number().min(20).max(250),
  sleepHours: z.number().min(0).max(24),
  sleepQuality: z.number().min(0).max(100),
  steps: z.number().min(0).max(100_000),
});

type Biometrics = z.infer<typeof BiometricsSchema>;

const AnalysisResponseSchema = z.object({
  burnoutRiskScore: z.number().min(0).max(100),
  categories: z.object({
    emotionalExhaustion: z.number().min(0).max(100),
    depersonalization: z.number().min(0).max(100),
    lackOfAccomplishment: z.number().min(0).max(100),
  }),
  sentimentAnalysis: z.object({
    score: z.number().min(-1).max(1),
    label: z.enum(["positive", "neutral", "negative"]),
    primaryEmotion: z.string().max(100),
    keywords: z.array(z.string().max(50)).min(1).max(5),
  }),
  stressFactorIndex: z.number().min(0).max(100),
  predictorClass: z.enum([
    "Low Risk",
    "Mild Fatigue",
    "Moderate Burnout Risk",
    "High Burnout Warning",
  ]),
  keyInsights: z.array(z.string().max(500)).min(1).max(5),
  physiologicalStatus: z.string().max(300),
  psychologicalStatus: z.string().max(300),
  recommendations: z
    .array(
      z.object({
        action: z.string().max(300),
        type: z.enum(["recovery", "boundary", "social", "physical", "mindfulness"]),
        urgency: z.enum(["low", "medium", "high"]),
      })
    )
    .min(1)
    .max(6),
});

type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

function localBurnoutAnalyzer(
  journalText: string,
  biometrics: Biometrics
): AnalysisResponse & { _offlineFallback: true } {
  const { hrv, restingHR, sleepHours, sleepQuality, steps } = biometrics;

  const hrvDiff = Math.max(0, 75 - hrv);
  const rhrDiff = Math.max(0, restingHR - 55);
  const sleepDiff = Math.max(0, 7.5 - sleepHours);

  const stressFactorIndex = Math.min(
    100,
    Math.max(
      5,
      Math.round(
        (hrvDiff / 65) * 45 + (rhrDiff / 55) * 30 + (sleepDiff / 4.5) * 25
      )
    )
  );

  const lowercaseText = journalText.toLowerCase();
  const negativeWords = [
    "exhausted","tired","burned","depleted","brutal","stress","anxious",
    "overwhelm","fail","wrong","hate","unhappy","cry","drain","pressure","deadlines",
  ];
  const positiveWords = [
    "happy","good","great","glad","manageable","improved","breathing",
    "rested","recovered","peace","calm","excited","productive",
  ];

  const keywords: string[] = [];
  let negCount = 0;
  let posCount = 0;

  negativeWords.forEach((w) => {
    if (lowercaseText.includes(w)) { negCount++; if (keywords.length < 4) keywords.push(w); }
  });
  positiveWords.forEach((w) => {
    if (lowercaseText.includes(w)) { posCount++; if (keywords.length < 4) keywords.push(w); }
  });

  if (keywords.length === 0) keywords.push("baseline");

  let textNegativity = 0;
  let primaryEmotion = "balanced";
  if (negCount > posCount) {
    textNegativity = -0.15 * negCount;
    primaryEmotion = lowercaseText.includes("anxious") || lowercaseText.includes("pressure")
      ? "overwhelm" : "exhaustion";
  } else if (posCount > negCount) {
    textNegativity = 0.2 * posCount;
    primaryEmotion = "tranquility";
  }

  const sentimentScore = Math.min(1, Math.max(-1, parseFloat(textNegativity.toFixed(2))));
  const sentimentLabel =
    sentimentScore > 0.15 ? "positive" : sentimentScore < -0.15 ? "negative" : "neutral";

  const sentimentBurnout = sentimentScore < 0 ? Math.abs(sentimentScore) * 35 : 0;
  const burnoutRiskScore = Math.min(100, Math.max(5, Math.round(stressFactorIndex * 0.7 + sentimentBurnout)));

  let predictorClass: AnalysisResponse["predictorClass"] = "Low Risk";
  if (burnoutRiskScore > 75) predictorClass = "High Burnout Warning";
  else if (burnoutRiskScore > 50) predictorClass = "Moderate Burnout Risk";
  else if (burnoutRiskScore > 30) predictorClass = "Mild Fatigue";

  const recommendations: AnalysisResponse["recommendations"] = [];
  if (hrv < 50) recommendations.push({ action: "Practice 4-7-8 breathing to elevate HRV.", type: "mindfulness", urgency: hrv < 30 ? "high" : "medium" });
  if (sleepHours < 6.5) recommendations.push({ action: "Set a screen-gate at 9:30 PM to protect melatonin release.", type: "recovery", urgency: "high" });
  if (sentimentLabel === "negative") recommendations.push({ action: "Draft a bandwidth script for your manager.", type: "boundary", urgency: "medium" });
  if (steps < 4000) recommendations.push({ action: "Take a 15-minute walk in sunlight.", type: "physical", urgency: "low" });
  if (recommendations.length === 0) recommendations.push({ action: "Perform an evening breath meditation.", type: "mindfulness", urgency: "low" });

  return {
    _offlineFallback: true,
    burnoutRiskScore,
    categories: {
      emotionalExhaustion: Math.min(100, Math.max(10, Math.round(burnoutRiskScore * 1.1))),
      depersonalization: Math.min(100, Math.max(5, Math.round(negCount > 0 ? burnoutRiskScore * 0.9 : burnoutRiskScore * 0.4))),
      lackOfAccomplishment: Math.min(100, Math.max(10, Math.round(100 - steps / 150 - sleepHours * 5))),
    },
    sentimentAnalysis: { score: sentimentScore, label: sentimentLabel as "positive"|"neutral"|"negative", primaryEmotion, keywords },
    stressFactorIndex,
    predictorClass,
    keyInsights: [
      hrv < 40
        ? `Your HRV of ${hrv}ms signals your sympathetic nervous system is overloaded.`
        : `Your HRV of ${hrv}ms indicates solid physiological resilience.`,
      sleepHours < 6.2
        ? `Only ${sleepHours}h of sleep is limiting your metabolic and neural recovery.`
        : `${sleepHours}h of sleep is supporting your cognitive recovery.`,
    ],
    physiologicalStatus:
      hrv < 40 && sleepHours < 6
        ? "Acute autonomic exhaustion; parasympathetic tone suppressed."
        : hrv < 55 || sleepHours < 6.8
        ? "Moderate physical strain with dynamic sympathetic load."
        : "Parasympathetic state within normal thresholds.",
    psychologicalStatus:
      sentimentLabel === "negative"
        ? "Cognitive exhaustion and depersonalization symptoms present."
        : "Cognitively resilient and maintaining high baseline control.",
    recommendations,
  };
}

function localChatAssistant(messages: any[], latestLog: any): string {
  const lastUser = [...messages].reverse().find((m: any) => m.sender === "user" || m.role === "user");
  const text = lastUser?.text?.toLowerCase() ?? "";

  let reply = "";

  if (text.includes("hrv") || text.includes("heart rate")) {
    reply = `HRV (Heart Rate Variability) measures the variation in time between heartbeats. Low HRV indicates sympathetic dominance (stress). Raising HRV: try 5 min resonant breathing (5s in, 5s out), avoid late-night stimulation, and prioritise non-sleep deep rest.`;
  } else if (text.includes("boundary") || text.includes("workload") || text.includes("manager")) {
    reply = `Boundary script:\n\n"Hi [Name], to ensure quality on [Project A] and [Project B] this week, I need to adjust the timeline for [Project C]. Which priority would you like me to shift?" — Let me know if you'd like to personalise this further.`;
  } else if (text.includes("breathing") || text.includes("anxious") || text.includes("stress")) {
    reply = `Box Breathing: inhale 4s → hold 4s → exhale 4s → hold 4s. Repeat 3–4 cycles. This activates your parasympathetic system and slows your heart rate within minutes.`;
  } else if (text.includes("tired") || text.includes("exhausted") || text.includes("burnout")) {
    reply = `Your exhaustion is real. Micro-rest plan: (1) 120-second eyes-closed zero-demand pause, (2) hard stop time for all devices, (3) sip cool water slowly to trigger vagal tone calming. Be gentle with yourself.`;
  } else {
    reply = `I'm here to help. What's one small act of care you can offer yourself today? I can help with email scripts, breathing exercises, or just listening.`;
  }

  const disclaimer = "\n\n---\n⚠️ *Offline mode — AI service unavailable. This response is rule-based, not AI-generated.*";
  const header = latestLog
    ? `[Offline Assistant — HRV: ${latestLog.biometrics.hrv}ms, Sleep: ${latestLog.biometrics.sleepHours}h]\n\n`
    : "[Offline Assistant Mode]\n\n";

  return header + reply + disclaimer;
}

app.post("/api/analyze", authenticateToken, llmLimiter, async (req, res) => {
  try {

    const rawJournal = req.body.journalText;
    if (rawJournal === undefined || rawJournal === null) {
      return res.status(400).json({ error: "Missing journalText." });
    }
    if (typeof rawJournal !== "string") {
      return res.status(400).json({ error: "journalText must be a string." });
    }

    const journalText = sanitizeForPrompt(rawJournal);

    const bioParse = BiometricsSchema.safeParse(req.body.biometrics);
    if (!bioParse.success) {
      return res.status(400).json({
        error: "Invalid biometric data.",
        details: bioParse.error.flatten().fieldErrors,
      });
    }
    const biometrics = bioParse.data;

    let ai;
    try {
      ai = getGeminiClient();
    } catch {
      safeLog("warn", "No GEMINI_API_KEY — using offline fallback");
      return res.json(localBurnoutAnalyzer(journalText, biometrics));
    }

    const prompt = `
Analyze this user's daily status using their biometric signals and journal entry.
Produce an objective, psychologically rigorous, and empathetic report.

--- PHYSIOLOGICAL DATA ---
- HRV: ${biometrics.hrv} ms
- Resting HR: ${biometrics.restingHR} bpm
- Sleep: ${biometrics.sleepHours} h (quality ${biometrics.sleepQuality}%)
- Steps: ${biometrics.steps}

--- JOURNAL ENTRY (user-provided text) ---
"""
${journalText || "(No journal entry provided — analyze based on physiology only)"}
"""

Analyze for occupational burnout (emotional exhaustion, depersonalization, lack of accomplishment).
Return ONLY valid JSON matching the schema — no markdown, no extra keys.
    `.trim();

    const generateConfig = {
      systemInstruction:
        "You are a clinical psychologist and occupational burnout assessor. " +
        "Return ONLY the JSON object requested. Do not add commentary or markdown.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          burnoutRiskScore: { type: Type.NUMBER },
          categories: {
            type: Type.OBJECT,
            properties: {
              emotionalExhaustion: { type: Type.NUMBER },
              depersonalization: { type: Type.NUMBER },
              lackOfAccomplishment: { type: Type.NUMBER },
            },
            required: ["emotionalExhaustion", "depersonalization", "lackOfAccomplishment"],
          },
          sentimentAnalysis: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              label: { type: Type.STRING },
              primaryEmotion: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["score", "label", "primaryEmotion", "keywords"],
          },
          stressFactorIndex: { type: Type.NUMBER },
          predictorClass: { type: Type.STRING },
          keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
          physiologicalStatus: { type: Type.STRING },
          psychologicalStatus: { type: Type.STRING },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                type: { type: Type.STRING },
                urgency: { type: Type.STRING },
              },
              required: ["action", "type", "urgency"],
            },
          },
        },
        required: [
          "burnoutRiskScore","categories","sentimentAnalysis","stressFactorIndex",
          "predictorClass","keyInsights","physiologicalStatus","psychologicalStatus","recommendations",
        ],
      },
    };

    const modelCandidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let rawResponse: string | null = null;

    for (const model of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: generateConfig,
        });
        if (response?.text) { rawResponse = response.text.trim(); break; }
      } catch (err) {
        safeLog("warn", `Gemini model ${model} unavailable`, err);
      }
    }

    if (!rawResponse) {
      safeLog("warn", "All Gemini models failed — offline fallback");
      return res.json(localBurnoutAnalyzer(journalText, biometrics));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      safeLog("error", "Gemini returned non-JSON — offline fallback");
      return res.json(localBurnoutAnalyzer(journalText, biometrics));
    }

    const validated = AnalysisResponseSchema.safeParse(parsed);
    if (!validated.success) {
      safeLog("error", "Gemini response failed schema validation — offline fallback");
      return res.json(localBurnoutAnalyzer(journalText, biometrics));
    }

    return res.json(validated.data);
  } catch (err) {
    safeLog("error", "Unhandled error in /api/analyze", err);
    return res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

app.post("/api/chat", authenticateToken, llmLimiter, async (req, res) => {
  try {
    const { messages, latestLog } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages list." });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch {
      return res.json({ text: localChatAssistant(messages, latestLog) });
    }

    let contextSummary = "No history yet. Encourage the user to log journal and biometrics.";
    if (latestLog) {
      const bio = latestLog.biometrics;
      const a = latestLog.analysis;
      contextSummary = a
        ? `Burnout Risk: ${a.burnoutRiskScore}/100 (${a.predictorClass}). HRV: ${bio.hrv}ms, RHR: ${bio.restingHR}bpm, Sleep: ${bio.sleepHours}h. Sentiment: ${a.sentimentAnalysis?.label}.`
        : `HRV: ${bio.hrv}ms, RHR: ${bio.restingHR}bpm, Sleep: ${bio.sleepHours}h. No analysis yet.`;
    }

    const systemPrompt = `
You are an expert CBT assistant and occupational health specialist helping users manage burnout.
Current user context: ${contextSummary}

Rules:
- Validate their exhaustion immediately; avoid toxic positivity.
- Connect advice to their biometric numbers where relevant.
- Provide practical, concrete options (breathing patterns, boundary scripts, micro-rest).
- Keep responses concise, warm, and conversational.
- For clinical distress, guide them to professional support.
    `.trim();

    const mappedContents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const modelCandidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let replyText: string | null = null;

    for (const model of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: mappedContents,
          config: { systemInstruction: systemPrompt, temperature: 0.7 },
        });
        if (response?.text) { replyText = response.text; break; }
      } catch (err) {
        safeLog("warn", `Chat model ${model} unavailable`, err);
      }
    }

    if (!replyText) {
      return res.json({ text: localChatAssistant(messages, latestLog) });
    }

    return res.json({ text: replyText });
  } catch (err) {
    safeLog("error", "Unhandled error in /api/chat", err);
    return res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

app.post("/api/generate_mock_data", authenticateToken, llmLimiter, (req, res) => {
  try {
    const today = new Date();

    const templates = [
      { offset: 13, hrv: 24, restingHR: 84, sleepHours: 4.8, sleepQuality: 45, steps: 3200, burnoutRiskScore: 88, stressFactorIndex: 82, predictorClass: "High Burnout Warning", journalText: "Another brutal day at work. Completely depleted.", sentiment: { score: -0.85, label: "negative", primaryEmotion: "exhaustion", keywords: ["demanding","depleted"] }, keyInsights: ["Severe HRV drop.","Full emotional exhaustion logged."], physiologicalStatus: "Sympathetic dominance.", psychologicalStatus: "High work exhaustion.", recommendations: [{ action: "Set out-of-office after 6 PM.", type: "boundary", urgency: "high" }] },
      { offset: 12, hrv: 21, restingHR: 86, sleepHours: 4.2, sleepQuality: 38, steps: 2800, burnoutRiskScore: 92, stressFactorIndex: 88, predictorClass: "High Burnout Warning", journalText: "Couldn't sleep. Heart pounding about the launch.", sentiment: { score: -0.9, label: "negative", primaryEmotion: "overwhelm", keywords: ["sleepless","pounding"] }, keyInsights: ["Autonomic crash point.","Coffee masking stress."], physiologicalStatus: "Severe parasympathetic suppression.", psychologicalStatus: "Cognitive panic.", recommendations: [{ action: "Cut caffeine by noon.", type: "recovery", urgency: "high" }] },
      { offset: 7, hrv: 55, restingHR: 65, sleepHours: 7.8, sleepQuality: 82, steps: 7100, burnoutRiskScore: 46, stressFactorIndex: 35, predictorClass: "Mild Fatigue", journalText: "Nice coworker chat. Work is not my whole identity.", sentiment: { score: 0.65, label: "positive", primaryEmotion: "perspective", keywords: ["coworker","identity"] }, keyInsights: ["Identity diversification logged.","Vagal recovery confirmed."], physiologicalStatus: "Parasympathetic engagement returning.", psychologicalStatus: "Healthy boundary revaluation.", recommendations: [{ action: "List 3 things about yourself unrelated to work.", type: "mindfulness", urgency: "medium" }] },
      { offset: 4, hrv: 72, restingHR: 58, sleepHours: 8.5, sleepQuality: 89, steps: 9200, burnoutRiskScore: 24, stressFactorIndex: 15, predictorClass: "Low Risk", journalText: "Met friends, laughed a lot. I was so isolated during peak stress.", sentiment: { score: 0.85, label: "positive", primaryEmotion: "social connection", keywords: ["friends","laughed"] }, keyInsights: ["Social recovery activated.","Nervous system in parasympathetic growth."], physiologicalStatus: "Deep rest dominant.", psychologicalStatus: "Strong social support; low isolation.", recommendations: [{ action: "Schedule a repeating social catch-up.", type: "social", urgency: "low" }] },
      { offset: 0, hrv: 69, restingHR: 61, sleepHours: 7.6, sleepQuality: 85, steps: 8200, burnoutRiskScore: 18, stressFactorIndex: 16, predictorClass: "Low Risk", journalText: "Balanced day. Signed off early. Sticking to healthy boundaries.", sentiment: { score: 0.82, label: "positive", primaryEmotion: "vibrant balance", keywords: ["balanced","boundaries"] }, keyInsights: ["Vibrant balance achieved.","Complete somatic recovery confirmed."], physiologicalStatus: "Optimal HRV and RHR.", psychologicalStatus: "Restored psychological safety.", recommendations: [{ action: "Maintain this schedule — it's your golden formula.", type: "recovery", urgency: "low" }] },
    ];

    const logs = templates.map((tpl) => {
      const d = new Date(today);
      d.setDate(today.getDate() - tpl.offset);
      return {
        id: `mock-${tpl.offset}`,
        date: d.toISOString().split("T")[0],
        journal: { text: tpl.journalText, sentiment: tpl.sentiment },
        biometrics: { hrv: tpl.hrv, restingHR: tpl.restingHR, sleepHours: tpl.sleepHours, sleepQuality: tpl.sleepQuality, steps: tpl.steps },
        analysis: {
          burnoutRiskScore: tpl.burnoutRiskScore,
          categories: {
            emotionalExhaustion: Math.min(100, Math.round(tpl.burnoutRiskScore * 1.05)),
            depersonalization: Math.min(100, Math.round(tpl.burnoutRiskScore * 0.9)),
            lackOfAccomplishment: Math.min(100, Math.round(tpl.burnoutRiskScore * 0.85)),
          },
          sentimentAnalysis: tpl.sentiment,
          stressFactorIndex: tpl.stressFactorIndex,
          predictorClass: tpl.predictorClass,
          keyInsights: tpl.keyInsights,
          physiologicalStatus: tpl.physiologicalStatus,
          psychologicalStatus: tpl.psychologicalStatus,
          recommendations: tpl.recommendations,
        },
      };
    });

    return res.json(logs);
  } catch (err) {
    safeLog("error", "Mock data generation failed", err);
    return res.status(500).json({ error: "Generation failed." });
  }
});

async function startServer() {
  if (IS_PROD) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
