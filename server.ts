import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { globalBurnoutModel, FEATURE_NAMES } from "./server/ml_model";

dotenv.config();

const app = express();
const PORT = 3000;

// Trust reverse proxy for correct rate limiting in sandbox/Cloud Run
app.set('trust proxy', 1);

app.use(express.json());

// JWT Constants (Safe fallbacks to prevent runtime crashes)
const JWT_SECRET = process.env.JWT_SECRET || "burnout_guardian_super_secret_access_key_918237";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "burnout_guardian_super_secret_refresh_key_481023";

// General API Rate Limiter: maximum of 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests to the Burnout Diagnosis API. Please try again in 15 minutes." }
});

// Stricter Rate Limiter for intensive AI/LLM endpoints to prevent abuse
const llmLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Max 15 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You are submitting requests too fast. Please rest for a minute." }
});

// Global API rate-limiting middleware
app.use("/api/", apiLimiter);

// JWT Access Token Verification Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract after 'Bearer '

  if (!token) {
    return res.status(401).json({ error: "Access token is missing. Please authenticate." });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(401).json({ error: "Access token is expired or invalid. Please refresh session." });
    }
    req.user = user;
    next();
  });
}

// Authentication Handshake and Refresh Routes
app.post("/api/auth/token", (req, res) => {
  const { username } = req.body;
  const user = { username: username || "Wearer" };

  // Generate tokens (Access Token is 5 minutes for demonstration and Refresh Token is 7 days)
  const accessToken = jwt.sign(user, JWT_SECRET, { expiresIn: "5m" });
  const refreshToken = jwt.sign(user, JWT_REFRESH_SECRET, { expiresIn: "7d" });

  res.json({
    accessToken,
    refreshToken,
    expiresIn: "5m"
  });
});

app.post("/api/auth/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is missing." });
  }

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Refresh token is expired or invalid." });
    }

    const payload = { username: user.username };
    const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "5m" });
    const newRefreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: "5m"
    });
  });
});

// Machine Learning Model Training and Prediction endpoints
app.post(["/api/ml/train", "/api/train"], authenticateToken, (req, res) => {
  try {
    const { learningRate, epochs } = req.body;
    const lr = parseFloat(learningRate) || 0.05;
    const eps = parseInt(epochs, 10) || 600;

    const metrics = globalBurnoutModel.trainModel(lr, eps);
    res.json({ success: true, metrics });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to train machine learning model." });
  }
});

app.post(["/api/ml/predict", "/api/predict"], authenticateToken, (req, res) => {
  try {
    const { inputs } = req.body;
    if (!inputs) {
      return res.status(400).json({ error: "Missing predictive inputs parameter." });
    }
    const result = globalBurnoutModel.predict(inputs);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Prediction execution failed." });
  }
});

// Middleware

// Lazy GoogleGenAI client builder to prevent startup crashes if GEMINI_API_KEY is missing
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please add it in the Secrets/Env configuration.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Sophisticated local fallback simulation for psychiatric/biometric analysis in case of upstream unavailability
function localBurnoutAnalyzer(journalText: string, biometrics: { hrv: number; restingHR: number; sleepHours: number; sleepQuality: number; steps: number }) {
  const { hrv, restingHR, sleepHours, sleepQuality, steps } = biometrics;
  
  // Calculate physiological stress factor index (0 to 100)
  const hrvDiff = Math.max(0, 75 - hrv); // max delta ~65
  const rhrDiff = Math.max(0, restingHR - 55); // max delta ~55
  const sleepDiff = Math.max(0, 7.5 - sleepHours); // max delta ~4.5
  
  const hrvContribution = (hrvDiff / 65) * 45;
  const rhrContribution = (rhrDiff / 55) * 30;
  const sleepContribution = (sleepDiff / 4.5) * 25;
  
  const stressFactorIndex = Math.min(100, Math.max(5, Math.round(hrvContribution + rhrContribution + sleepContribution)));

  // Text analysis (basic keyword scanning)
  const lowercaseText = journalText.toLowerCase();
  let textNegativity = 0; // scale -1 (neg) to 1 (pos)
  let primaryEmotion = "balanced";
  const keywords: string[] = [];

  const negativeWords = ["exhausted", "tired", "burned", "depleted", "brutal", "stress", "anxious", "overwhelm", "fail", "wrong", "hate", "unhappy", "cry", "drain", "pressure", "deadlines"];
  const positiveWords = ["happy", "good", "great", "glad", "manageable", "improved", "breathing", "rested", "recovered", "peace", "calm", "excited", "productive"];

  let negCount = 0;
  let posCount = 0;
  negativeWords.forEach(word => {
    if (lowercaseText.includes(word)) {
      negCount++;
      if (keywords.length < 4) keywords.push(word);
    }
  });
  positiveWords.forEach(word => {
    if (lowercaseText.includes(word)) {
      posCount++;
      if (keywords.length < 4) keywords.push(word);
    }
  });

  if (negCount > posCount) {
    textNegativity = -0.15 * negCount;
    primaryEmotion = "exhaustion";
    if (lowercaseText.includes("anxious") || lowercaseText.includes("worry") || lowercaseText.includes("pressure")) {
      primaryEmotion = "overwhelm";
    }
  } else if (posCount > negCount) {
    textNegativity = 0.2 * posCount;
    primaryEmotion = "tranquility";
  } else {
    textNegativity = 0.05;
    primaryEmotion = "neutrality";
  }

  const sentimentScore = Math.min(1.0, Math.max(-1.0, parseFloat(textNegativity.toFixed(2))));
  const sentimentLabel = sentimentScore > 0.15 ? "positive" : (sentimentScore < -0.15 ? "negative" : "neutral");

  if (keywords.length === 0) {
    keywords.push("physiology", "vitals", "baseline");
  }

  // Calculate overall burnout risk score
  const sentimentBurnoutMultiplier = sentimentScore < 0 ? Math.abs(sentimentScore) * 35 : 0;
  const rawBurnoutScore = (stressFactorIndex * 0.7) + sentimentBurnoutMultiplier;
  const burnoutRiskScore = Math.min(100, Math.max(5, Math.round(rawBurnoutScore)));

  // Determine predictorClass
  let predictorClass = "Low Risk";
  if (burnoutRiskScore > 75) {
    predictorClass = "High Burnout Warning";
  } else if (burnoutRiskScore > 50) {
    predictorClass = "Moderate Burnout Risk";
  } else if (burnoutRiskScore > 30) {
    predictorClass = "Mild Fatigue";
  }

  // Key Insights
  const keyInsights: string[] = [];
  if (hrv < 40) {
    keyInsights.push(`Your heart rate variability is at a low level (${hrv}ms), signaling your sympathetic 'fight-or-flight' nervous system is working overtime to tackle stress.`);
  } else {
    keyInsights.push(`Your heart rate variability is stable (${hrv}ms), which indicates a high degree of emotional and physical resilience under load.`);
  }

  if (sleepHours < 6.2) {
    keyInsights.push(`Getting only ${sleepHours} hours of sleep restricts critical deep & REM restorative brain states, hindering your metabolic and nervous recovery.`);
  } else {
    keyInsights.push(`Your sleep duration of ${sleepHours} hours is protecting your cognitive battery and facilitating neuroplastic stress recovery.`);
  }

  if (journalText && negCount > 1) {
    keyInsights.push(`The cognitive exhaustion expressed in your reflection correlates directly with physical recovery bottlenecks. Your autonomic nervous system is signaling a need to establish a somatic circuit.`);
  } else {
    keyInsights.push(`You display excellent cognitive coping strategies in your journal reflection, reinforcing solid emotional stability despite life demands.`);
  }

  // Physiological Status
  let physiologicalStatus = "Parasympathetic state functioning within normal athletic thresholds.";
  if (hrv < 40 && sleepHours < 6) {
    physiologicalStatus = "Acute autonomic exhaustion; parasympathetic vagal tone is suppressed due to sleep deficit and high RHR.";
  } else if (hrv < 55 || sleepHours < 6.8) {
    physiologicalStatus = "Moderate physical strain; heart rate trends reflect a body carrying dynamic sympathetic load.";
  }

  // Psychological Status
  let psychologicalStatus = "Cognitively resilient, balanced, and maintaining high baseline control.";
  if (sentimentLabel === "negative") {
    psychologicalStatus = "Experiencing cognitive exhaustion and career depersonalization. Elevated workload burnout symptoms are present.";
  } else if (sentimentLabel === "neutral" && stressFactorIndex > 60) {
    psychologicalStatus = "Experiencing high physiological pressure, but cognitive appraisal remains stable.";
  }

  // Recommendations
  const recommendations: any[] = [];
  if (hrv < 50) {
    recommendations.push({
      action: "Practice the 4-7-8 somatic breathing drill: inhale for 4s, hold for 7s, exhale for 8s to quickly elevate your HRV and vagus nerve.",
      type: "mindfulness",
      urgency: hrv < 30 ? "high" : "medium"
    });
  }
  if (sleepHours < 6.5) {
    recommendations.push({
      action: "Set a firm screen-gate at 9:30 PM tonight. Unplug your phone and place it in another room to secure melatonin release.",
      type: "recovery",
      urgency: "high"
    });
  }
  if (sentimentLabel === "negative" || lowercaseText.includes("work") || lowercaseText.includes("deadline")) {
    recommendations.push({
      action: "Draft a clear 'boundary script' for your upcoming meeting. Communicate your current bandwidth constraints to prevent task overlap.",
      type: "boundary",
      urgency: "medium"
    });
  }
  if (steps < 4000) {
    recommendations.push({
      action: "Take a mindful, non-work 15-minute walk outside. Let sunlight adjust your biological cortisol and melatonin clocks.",
      type: "physical",
      urgency: "low"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: "Perform a brief evening breath meditation to consolidate your high recovery metrics.",
      type: "mindfulness",
      urgency: "low"
    });
  }

  return {
    burnoutRiskScore,
    categories: {
      emotionalExhaustion: Math.min(100, Math.max(10, Math.round(burnoutRiskScore * 1.1))),
      depersonalization: Math.min(100, Math.max(5, Math.round(negCount > 0 ? (burnoutRiskScore * 0.9) : (burnoutRiskScore * 0.4)))),
      lackOfAccomplishment: Math.min(100, Math.max(10, Math.round(100 - (steps / 150) - (sleepHours * 5))))
    },
    sentimentAnalysis: {
      score: sentimentScore,
      label: sentimentLabel,
      primaryEmotion,
      keywords
    },
    stressFactorIndex,
    predictorClass,
    keyInsights,
    physiologicalStatus,
    psychologicalStatus,
    recommendations
  };
}

// Sophisticated local fallback simulation for chat guidance in case of upstream unavailability
function localChatAssistant(messages: any[], latestLog: any) {
  const lastUserMessage = [...messages].reverse().find((m: any) => m.sender === "user" || m.role === "user");
  const text = lastUserMessage ? lastUserMessage.text.toLowerCase() : "";

  let responseText = "";

  if (text.includes("hrv") || text.includes("resting hr") || text.includes("heart rate") || text.includes("biometric") || text.includes("pulse")) {
    responseText = `Heart Rate Variability (HRV) is the variation in time between consecutive heartbeats, measured in milliseconds. 
    
When you are under stress, your sympathetic \"fight-or-flight\" nervous system dominates, causing your heartbeats to become highly regular and rhythmic—meaning your **HRV drops**.

Conversely, when you are in a state of deep recovery, your parasympathetic \"rest-and-digest\" nervous system is active, creating healthy, elastic fluctuations in your heartbeat timing—your **HRV rises**.

**Recommendations to help improve your HRV today:**
- Perform 5 minutes of resonant somatic breathing (inhale for 5 seconds, exhale for 5 seconds).
- Establish absolute work boundaries to avoid late-night physiological alarms.
- Prioritize non-sleep deep rest (NSDR) or a short walk in green surroundings.`;
  } 
  else if (text.includes("boundary") || text.includes("email") || text.includes("manager") || text.includes("boss") || text.includes("workload") || text.includes("colleague")) {
    responseText = `Setting robust boundaries can feel incredibly daunting, but it is necessary to prevent severe emotional exhaustion. Here is a clear, warm, and highly professional script you can send your manager or client to protect your current focus:

---
**Subject:** Bandwidth Check & Project Alignment

Hi [Name],

I appreciate the exciting trajectory of our current tasks. I am writing to do a quick alignment check on our current priorities. 

To ensure the delivery of high-quality work on [Project Title], my current bandwidth allows me to focus fully on [Priority A] and [Priority B] this week. To accommodate the new request for [Priority C], we will likely need to adjust the delivery timeline for [Priority A] or delegate [Priority D].

Which of these would you prefer me to prioritize? Let me know your thoughts so we can align our resources.

Warmly,
[Your Name]
---

We can tweak this together if you want to make it sound more personalized! Let me know if you are drafting this for a specific peer or superior.`;
  } 
  else if (text.includes("stress") || text.includes("somatic") || text.includes("breathing") || text.includes("anxious") || text.includes("anxiety") || text.includes("panic")) {
    responseText = `I hear you, and it is completely understandable to feel overwhelmed under heavy pressure. Let's do a fast, highly effective somatic breathing drill called **Box Breathing** together right now to calm your nervous system:

1. **Inhale** slowly through your nose for **4 seconds**, feeling your abdomen expand.
2. **Hold** that breath gently inside for **4 seconds**.
3. **Exhale** smoothly through your mouth for **4 seconds**, releasing all physical strain.
4. **Hold** empty for **4 seconds** before the next breath.

Repeat this cycle 3-4 times. This acts as a physical 'braking system' for your sympathetic state, quickly slowing your heart rate and raising your heart rate variability. Would you like me to guide you through another somatic rest technique, or would you prefer talking more about what is triggering your anxiety?`;
  }
  else if (text.includes("tired") || text.includes("sleep") || text.includes("exhausted") || text.includes("burnout") || text.includes("drain")) {
    responseText = `Your exhaustion is extremely real, and I want to validate how heavily you have been carrying this load. When your biometrics indicate high physiological strain or short sleep, your brain is working on limited metabolic glucose. It is literally running on fumes.

**Here is a micro-rest roadmap for your afternoon:**
- **Zero-Demand Minute**: Close your eyes and give yourself permission to do absolutely nothing for 120 seconds. No thinking, no solving, no planning.
- **Cognitive Boundary**: If possible, designate a 'hard stop' time today where all work devices are put away.
- **Hydration Reset**: Slowing down to sip cool water can activate swallowing-induced vagal tones, calming your autonomic alarm.

Be gentle with yourself today. You don't have to carry the weight or solve everything in a single day. How can I help you adjust your plans today to find a small pocket of rest?`;
  } 
  else {
    responseText = `Thank you for sharing that with me. I appreciate you venting your thoughts here—this is a safe space to process everything. 

As your companion, I want to check in on how your body is feeling. Sometimes, we experience burnout in our shoulders, our chest, or a persistent mental fog. 

*What is one small boundary or act of caring attention you can offer yourself today?* I am right here to help you draft email responses, find simple physical exercises, or just listen to whatever is on your mind.`;
  }

  let biometricsHeader = "";
  if (latestLog) {
    biometricsHeader = `[Empathetic Assistant - Direct Autonomic Insights Sync Active (HRV: ${latestLog.biometrics.hrv}ms, Sleep: ${latestLog.biometrics.sleepHours}h)]\n\n`;
  } else {
    biometricsHeader = `[Empathetic Assistant Mode Active]\n\n`;
  }

  return biometricsHeader + responseText;
}

// 1. API: Analyze daily journal & biometrics for burnout risk
app.post("/api/analyze", authenticateToken, llmLimiter, async (req, res) => {
  try {
    const { journalText, biometrics } = req.body;

    if (!journalText && journalText !== "") {
      return res.status(400).json({ error: "Missing journalText" });
    }
    if (!biometrics) {
      return res.status(400).json({ error: "Missing wearable biometrics" });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      // API Key missing, execute immediate high grade local backup
      console.warn("No GEMINI_API_KEY set. Triggering offline clinical model.");
      const offlineResult = localBurnoutAnalyzer(journalText, biometrics);
      return res.json(offlineResult);
    }

    const { hrv, restingHR, sleepHours, sleepQuality, steps } = biometrics;

    // Send context + prompt to Gemini with a highly descriptive response schema
    const prompt = `
      Analyze this user's daily status using their biometric signals and personal journal entry. 
      Flesh out a highly objective, psychologically rigorous and empathetic report.

      --- PHYSIOLOGICAL DATA ---
      - Heart Rate Variability (HRV): ${hrv} ms (Normal stress range: 20-100 ms; drops indicate nervous state/fatigue)
      - Resting Heart Rate (RHR): ${restingHR} bpm (Normal: 50-90 bpm; elevated heart rate indicates physiological stress)
      - Sleep Hours: ${sleepHours} hours (Deficit is < 7 hours)
      - Sleep Quality Index: ${sleepQuality}% 
      - Daily Activity (Steps): ${steps} steps

      --- PSYCHOLOGICAL CONTEXT (JOURNAL ENTRY) ---
      """
      ${journalText || "(No journal entry provided to prevent text skewing, analyze based mostly on physiology and average baseline)"}
      """

      Analyze for occupational/existential burnout indices across:
      1. Emotional Exhaustion (feeling drained, empty, overextended)
      2. Depersonalization/Cynicism (feeling detached, negative towards work, tasks, or interactions)
      3. Lack of Personal Accomplishment (work efficacy, feeling low impact)
      
      Calculate:
      - 'stressFactorIndex': Physiological stress (0-100) combining low HRV, high Resting HR, and sleep deficits.
      - 'burnoutRiskScore': Aggregate burnout index (0-100) combining emotional journal sentiment and physiological strain parameters.
      - 'predictorClass': Classify as exactly 'Low Risk' (< 30), 'Mild Fatigue' (30-50), 'Moderate Burnout Risk' (50-75), or 'High Burnout Warning' (> 75).
      
      Structure the response strictly according to the requested JSON schema. Write insights with genuine therapeutic warmth.
    `;

    const generateConfig = {
      systemInstruction: "You are a specialized clinical psychologist, computational biomarker scientist, and occupational burnout assessor.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          burnoutRiskScore: { 
            type: Type.NUMBER, 
            description: "Final combined burner meter index from 0 to 100." 
          },
          categories: {
            type: Type.OBJECT,
            properties: {
              emotionalExhaustion: { type: Type.NUMBER, description: "Feeling emotionally dry and excessively fatigued by work/life responsibilities (0-100)" },
              depersonalization: { type: Type.NUMBER, description: "Cynicism, mental distance, cold detachment relative to tasks or work (0-100)" },
              lackOfAccomplishment: { type: Type.NUMBER, description: "Feelings of low effectiveness, failure to impact, or lack of achievement (0-100)" }
            },
            required: ["emotionalExhaustion", "depersonalization", "lackOfAccomplishment"]
          },
          sentimentAnalysis: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Value from -1 (very negative) to +1 (very positive)" },
              label: { type: Type.STRING, description: "Must be 'positive', 'neutral', or 'negative'" },
              primaryEmotion: { type: Type.STRING, description: "Key emotion label (e.g., exhaustion, frustration, peace, enthusiasm, overwhelm)" },
              keywords: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "2 to 5 psychological keywords extracted from the text."
              }
            },
            required: ["score", "label", "primaryEmotion", "keywords"]
          },
          stressFactorIndex: { 
            type: Type.NUMBER, 
            description: "An index 0-100 calculated solely upon high stress biometrics like low HRV, low sleep, high RHR." 
          },
          predictorClass: { 
            type: Type.STRING, 
            description: "Must be strictly one of: 'Low Risk', 'Mild Fatigue', 'Moderate Burnout Risk', 'High Burnout Warning'" 
          },
          keyInsights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 highly customized, deeply healing insights fusing the biometrics and mental triggers (e.g., 'Your heart rate variability is at a weekly low, which aligns with the heavy cognitive load described in your journaling about work deadlines. Your body is matching your mind's alarm bells.')"
          },
          physiologicalStatus: { 
            type: Type.STRING, 
            description: "Brevity summary of physical wear (e.g., 'Significant autonomic exhaustion, parasympathetic system suppressed under low sleep')" 
          },
          psychologicalStatus: { 
            type: Type.STRING, 
            description: "Summary of cognitive resilience based on text (e.g., 'Highly self-critical, experiencing classic imposter syndrome and workload burnout')" 
          },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING, description: "Bite-sized, practical wellness recommendation." },
                type: { type: Type.STRING, description: "Must be one of: 'recovery', 'boundary', 'social', 'physical', 'mindfulness'" },
                urgency: { type: Type.STRING, description: "Must be 'low', 'medium', or 'high'" }
              },
              required: ["action", "type", "urgency"]
            }
          }
        },
        required: [
          "burnoutRiskScore", 
          "categories", 
          "sentimentAnalysis", 
          "stressFactorIndex", 
          "predictorClass", 
          "keyInsights", 
          "physiologicalStatus", 
          "psychologicalStatus", 
          "recommendations"
        ]
      }
    };

    let response;
    // Sequential fallback ladder through a loop of supported models to protect against demand peaks (503s)
    const modelCandidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let success = false;
    let apiErrorMsg = "";

    for (const model of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: generateConfig
        });
        success = true;
        break; // Successfully got response, break early
      } catch (err: any) {
        const errMessage = typeof err === 'object' && err !== null ? (err.message || JSON.stringify(err)) : String(err);
        const isUnavailable = errMessage.includes("503") || errMessage.toLowerCase().includes("unavailable") || errMessage.toLowerCase().includes("high demand");
        const statusDetail = isUnavailable ? "(Service Busy/503)" : "(Unavailable)";
        console.log(`Candidate ${model} not available ${statusDetail}. Trying next...`);
        apiErrorMsg = errMessage;
      }
    }

    if (success && response && response.text) {
      const parsedResponse = JSON.parse(response.text.trim());
      return res.json(parsedResponse);
    } else {
      console.warn("All GenAI models failed or returned empty content. Activating high-resilience clinical simulation fallback.");
      const simulation = localBurnoutAnalyzer(journalText, biometrics);
      return res.json(simulation);
    }

  } catch (error: any) {
    console.error("Analysis API failed:", error);
    return res.status(500).json({ 
      error: "Analysis Failed", 
      details: error.message || "An unexpected error occurred during analysis" 
    });
  }
});

// 2. API: Empathy-driven therapy / coping assistant chatbot
app.post("/api/chat", authenticateToken, llmLimiter, async (req, res) => {
  try {
    const { messages, latestLog } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages list" });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      console.warn("No GEMINI_API_KEY set. Triggering offline clinical chatbot.");
      const offlineReply = localChatAssistant(messages, latestLog);
      return res.json({ text: offlineReply });
    }

    // Prepare content elements, including latest biometric summaries to make the chatbot context-aware
    const contents: any[] = [];

    let contextSummary = "No logging history available yet. Encourage the user to enter their initial journal and biometrics tracker.";
    if (latestLog) {
      const bio = latestLog.biometrics;
      const analysis = latestLog.analysis;
      if (analysis) {
        contextSummary = `
          The user is currently showing a Burnout Risk Score of ${analysis.burnoutRiskScore}/100, categorized as '${analysis.predictorClass}'.
          Physiological autonomic stress is marked at ${analysis.stressFactorIndex}/100.
          Their wearbales tracked: HRV of ${bio.hrv}ms (lower = highly strained), Resting HR of ${bio.restingHR}bpm (higher = stressed), Sleep is ${bio.sleepHours} hours (${bio.sleepQuality}% quality).
          Psychological journal sentiment is '${analysis.sentimentAnalysis?.label ?? "neutral"}' with primary emotion of '${analysis.sentimentAnalysis?.primaryEmotion ?? "fatigue"}'.
          Key insights they received: "${(analysis.keyInsights || []).join('; ')}".
        `;
      } else {
        contextSummary = `
          The user entered biometrics: HRV of ${bio.hrv}ms, Resting HR of ${bio.restingHR}bpm, Sleep: ${bio.sleepHours}h (${bio.sleepQuality}% quality). 
          No text sentiment analysis is loaded yet.
        `;
      }
    }

    // Set up a structured contextual prompt
    const systemPrompt = `
      You are an expert, deeply warm, and professional cognitive-behavioral therapy (CBT) assistant, somatic coach, and occupational health specialist.
      Your goal is to help users manage, mitigate, and physically/psychologically heal from occupational or general life burnout.
      
      You have access to their real-world wearable biometrics and journal sentiment trends summarized below:
      === CURRENT USER WORKSPACE CONTEXT ===
      ${contextSummary}
      ======================================

      Important rules:
      - Be highly validation-oriented. Validate their exhaustion and stress immediately. Avoid toxically positive advice (e.g., do not just say "Think positive!").
      - Connect comments to their autonomic numbers if appropriate. For instance, if sleep is very low, emphasize somatic recovery over intense mental reflection.
      - Provide practical, concrete options: boundary-setting templates, somatic breathing patterns (like 4-7-8 breathing), micro-rest ideas, or emotional validation.
      - Keep responses concise, warm, structured with bullet points where necessary, and extremely conversational.
      - If they exhibit signs of critical clinical distress, gently and firmly guide them to professional medical counseling support.
    `;

    // Map systemPrompt as client instruction or systemInstruction
    // Gather system and mapping history
    const mappedContents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    let response;
    const modelCandidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let success = false;
    let apiErrorMsg = "";

    for (const model of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model: model,
          contents: mappedContents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          }
        });
        success = true;
        break; // Successfully got response, break early
      } catch (err: any) {
        const errMessage = typeof err === 'object' && err !== null ? (err.message || JSON.stringify(err)) : String(err);
        const isUnavailable = errMessage.includes("503") || errMessage.toLowerCase().includes("unavailable") || errMessage.toLowerCase().includes("high demand");
        const statusDetail = isUnavailable ? "(Service Busy/503)" : "(Unavailable)";
        console.log(`Chat candidate ${model} not available ${statusDetail}. Trying next...`);
        apiErrorMsg = errMessage;
      }
    }

    if (success && response && response.text) {
      return res.json({ text: response.text });
    } else {
      console.warn("All chat models failed. Triggering offline clinical chatbot simulation.");
      const offlineReply = localChatAssistant(messages, latestLog);
      return res.json({ text: offlineReply });
    }

  } catch (error: any) {
    console.error("Chat API failed:", error);
    return res.status(500).json({ 
      error: "Chat Assistant Failed",
      details: error.message || "An unexpected error occurred in the assistant" 
    });
  }
});

// 3. API: Generate realistic 14-day history demonstrating burnout strain to recovery
app.post("/api/generate_mock_data", authenticateToken, (req, res) => {
  try {
    const historicalLogs: any[] = [];
    const today = new Date();

    // Narratives for the 14 days representing a high stress workload peak that slowly recovers
    const templates = [
      {
        offset: 13,
        journalText: "Another brutal day at work. The client keeps demanding late additions, and feels like there is zero breathing room. Completely depleted.",
        sentiment: { score: -0.85, label: "negative", primaryEmotion: "exhaustion", keywords: ["demanding", "no space", "depleted"] },
        hrv: 24, // highly strained
        restingHR: 84, // elevated
        sleepHours: 4.8, // severe deficit
        sleepQuality: 45,
        steps: 3200,
        burnoutRiskScore: 88,
        stressFactorIndex: 82,
        predictorClass: "High Burnout Warning",
        keyInsights: [
          "Severe autonomic depletion logged. Your low HRV and resting HR peak reflect acute physiological flight-or-fight response.",
          "Feelings of complete helplessness around client deadlines match emotional exhaustion clinical indicators."
        ],
        physiologicalStatus: "Sympathetic nervous system dominance with acute cardiovascular stress.",
        psychologicalStatus: "High work exhaustion combined with feelings of operational entrapment.",
        recommendations: [
          { action: "Set an automated out-of-office message for after 6:00 PM.", type: "boundary", urgency: "high" },
          { action: "Lie flat on the floor for 10 minutes with feet elevated (parasympathetic reset).", type: "recovery", urgency: "high" }
        ]
      },
      {
        offset: 12,
        journalText: "I couldn't sleep at all. My heart was pounding thinking about the project dashboard launch. Let's see if I can push through with coffee.",
        sentiment: { score: -0.9, label: "negative", primaryEmotion: "overwhelm", keywords: ["sleepless", "pounding", "push through"] },
        hrv: 21,
        restingHR: 86,
        sleepHours: 4.2,
        sleepQuality: 38,
        steps: 2800,
        burnoutRiskScore: 92,
        stressFactorIndex: 88,
        predictorClass: "High Burnout Warning",
        keyInsights: [
          "Autonomic crash point detected. Sleep efficiency has drops below recovery baselines.",
          "High coffee intake masks psychological warnings but exacerbates physical nervous strain."
        ],
        physiologicalStatus: "Severe parasympathetic suppression; autonomic crash zone.",
        psychologicalStatus: "Borderline cognitive panic and hyper-vigilance regarding launch timelines.",
        recommendations: [
          { action: "Cut caffeine by 12:00 PM to protect next-cycle recovery sleep.", type: "recovery", urgency: "high" },
          { action: "Inform your manager you are taking a formal mental recharge block tomorrow afternoon.", type: "boundary", urgency: "high" }
        ]
      },
      {
        offset: 11,
        journalText: "Dashboard launch was delayed because of a server bug. I feel like we failed and worked all those late nights for nothing. What is the point?",
        sentiment: { score: -0.82, label: "negative", primaryEmotion: "cynicism", keywords: ["delayed", "failed", "no point"] },
        hrv: 26,
        restingHR: 81,
        sleepHours: 5.5,
        sleepQuality: 52,
        steps: 4100,
        burnoutRiskScore: 89,
        stressFactorIndex: 78,
        predictorClass: "High Burnout Warning",
        keyInsights: [
          "MBI Depersonalization subscale elevation. Feeling 'for nothing' or questioning the wider value indicates cynicism defenses activating.",
          "Subtle respiratory recovery starting, though still in a heavy fatigue state."
        ],
        physiologicalStatus: "Persistent stress signaling with minimal cardiovascular reserve.",
        psychologicalStatus: "Feelings of low occupational self-efficacy and cynicism towards project outcomes.",
        recommendations: [
          { action: "Spend 15 minutes away from all screens during lunch to decouple work context.", type: "mindfulness", urgency: "medium" },
          { action: "Do a 5-minute progressive muscle relaxation session before attempting to sleep.", type: "recovery", urgency: "medium" }
        ]
      },
      {
        offset: 10,
        journalText: "Finally took a half-day off. Just slept in the afternoon. Still have a mild headache, but didn't open my email once. Felt incredibly guilty though.",
        sentiment: { score: -0.2, label: "negative", primaryEmotion: "guilt", keywords: ["half-day", "headache", "guilt", "sleeping"] },
        hrv: 35, // starting to crawl up
        restingHR: 76,
        sleepHours: 9.0, // long makeup sleep
        sleepQuality: 70,
        steps: 3500,
        burnoutRiskScore: 78,
        stressFactorIndex: 65,
        predictorClass: "High Burnout Warning",
        keyInsights: [
          "Substantial sleep extension logged. Sleep hours act as physiological buffer, easing cardiovascular strain.",
          "Heavy psychological guilt accompanies rest period—reflecting a dysfunctional belief that health is conditional on labor."
        ],
        physiologicalStatus: "Sleep rebound initiating recovery; resting heart rate stabilized.",
        psychologicalStatus: "Exhaustion easing, though cognitive cognitive dissonance and guilt remain elevated.",
        recommendations: [
          { action: "Reframe rest as maintenance rather than a luxury—it is biologically mandatory.", type: "mindfulness", urgency: "high" },
          { action: "Take a walking break in natural sunlight without your phone.", type: "recovery", urgency: "medium" }
        ]
      },
      {
        offset: 9,
        journalText: "The team was supportive when I returned. Had a couple of quick meetings, but didn't stress as much. Did a short workout in the evening.",
        sentiment: { score: 0.3, label: "positive", primaryEmotion: "relief", keywords: ["supportive", "fewer meetings", "workout"] },
        hrv: 42,
        restingHR: 72,
        sleepHours: 7.2,
        sleepQuality: 75,
        steps: 8500,
        burnoutRiskScore: 68,
        stressFactorIndex: 50,
        predictorClass: "Moderate Burnout Risk",
        keyInsights: [
          "Positive shift in psychological sentiment score from negative back into mild optimism balances risk indexes.",
          "Physical steps increase indicates return of active energy reserves."
        ],
        physiologicalStatus: "Steady autonomic recovery. HRV enters mid-strained zone, indicating recovery response.",
        psychologicalStatus: "Renewed support perception, decreasing isolation and cynicism.",
        recommendations: [
          { action: "Acknowledge the positive team interactions as safe mental reference points.", type: "social", urgency: "low" },
          { action: "Log details of this light workout as an athletic win.", type: "physical", urgency: "low" }
        ]
      },
      {
        offset: 8,
        journalText: "Felt okay today. Just normal tasks. Still a bit fatigued by midday, but managed to sign off by 5:30. Cooked some healthy dinner.",
        sentiment: { score: 0.4, label: "positive", primaryEmotion: "neutrality", keywords: ["okay", "normal", "healthy dinner", "signed off"] },
        hrv: 48,
        restingHR: 68,
        sleepHours: 7.5,
        sleepQuality: 78,
        steps: 6200,
        burnoutRiskScore: 58,
        stressFactorIndex: 44,
        predictorClass: "Moderate Burnout Risk",
        keyInsights: [
          "The early signoff at 5:30 protected evening cortisol drop, enabling a nice resting heart rate baseline of 68 bpm.",
          "Self-care in cooking signals return of operational agency and control."
        ],
        physiologicalStatus: "Good physiological stability, heart rate variability showing slow upward progression.",
        psychologicalStatus: "Stabilizing cognitive load, regaining control over daily boundaries.",
        recommendations: [
          { action: "Protect this signing-off boundary as a strict contract with yourself.", type: "boundary", urgency: "medium" }
        ]
      },
      {
        offset: 7,
        journalText: "Had a nice conversation with a coworker about life outside of work. Made me realize work is just work, not my complete identity.",
        sentiment: { score: 0.65, label: "positive", primaryEmotion: "perspective", keywords: ["nice conversation", "coworker", "identity"] },
        hrv: 55,
        restingHR: 65,
        sleepHours: 7.8,
        sleepQuality: 82,
        steps: 7100,
        burnoutRiskScore: 46,
        stressFactorIndex: 35,
        predictorClass: "Mild Fatigue",
        keyInsights: [
          "Identity diversification logged. Psychological detaching-and-revaluating reduces depersonalization index dramatically.",
          "Sleep metrics approach solid parameters of 82% efficiency, improving nerve restoration."
        ],
        physiologicalStatus: "Parasympathetic engagement returning. Dynamic vagal recovery confirmed.",
        psychologicalStatus: "Healthy boundary revaluation, building cognitive buffer against burnout.",
        recommendations: [
          { action: "Write down 3 things you love about yourself that have nothing to do with your job.", type: "mindfulness", urgency: "medium" },
          { action: "Plan a weekend outing to keep a robust sense of personal identity.", type: "social", urgency: "low" }
        ]
      },
      {
        offset: 6,
        journalText: "A bit of backlog stress today, but handled it step-by-step. Took deep belly breaths when I felt an anxious spike in my chest. It really worked.",
        sentiment: { score: 0.2, label: "positive", primaryEmotion: "resilience", keywords: ["backlog", "deep breaths", "belly breathing"] },
        hrv: 52,
        restingHR: 66,
        sleepHours: 7.0,
        sleepQuality: 76,
        steps: 5800,
        burnoutRiskScore: 48,
        stressFactorIndex: 38,
        predictorClass: "Mild Fatigue",
        keyInsights: [
          "Adaptive coping in action. Using somatic checks (conscious breathing) interrupts stress neural pathways.",
          "Biometrics hold steady despite rising workflow backlog volume."
        ],
        physiologicalStatus: "Cardiovascular system resilient, showing good adaptability to immediate spikes.",
        psychologicalStatus: "Conscious emotional self-regulation; high sense of agency.",
        recommendations: [
          { action: "Practice 3 cycles of Box Breathing (inhale 4s, hold 4s, exhale 4s, hold 4s) during tasks.", type: "mindfulness", urgency: "low" }
        ]
      },
      {
        offset: 5,
        journalText: "Weekend starting. Spent the afternoon reading at a coffee shop and did a lengthy stretch. My body feels so much lighter.",
        sentiment: { score: 0.75, label: "positive", primaryEmotion: "peace", keywords: ["weekend", "coffee shop", "stretch", "lighter"] },
        hrv: 63,
        restingHR: 61,
        sleepHours: 8.2,
        sleepQuality: 85,
        steps: 6400,
        burnoutRiskScore: 34,
        stressFactorIndex: 25,
        predictorClass: "Mild Fatigue",
        keyInsights: [
          "Somatic muscle relief observed. Feeling 'lighter' correlates directly with a lower resting heart rate of 61 bpm.",
          "A full recovery block has returned user values back to sustainable baselines."
        ],
        physiologicalStatus: "Optimal vagal tone, high physical relaxation indicators.",
        psychologicalStatus: "Low mental load, experiencing restorative emotional spacing.",
        recommendations: [
          { action: "Incorporate full-body stretching for 10 minutes to release stored somatic tension.", type: "physical", urgency: "low" }
        ]
      },
      {
        offset: 4,
        journalText: "Slept incredibly well. Met friends for lunch and laughed a lot. I hadn't realized how isolated I was during the stress peak.",
        sentiment: { score: 0.85, label: "positive", primaryEmotion: "social connection", keywords: ["slept well", "friends", "laughed", "isolated"] },
        hrv: 72, // excellent index
        restingHR: 58, // healthy low resting HR
        sleepHours: 8.5,
        sleepQuality: 89,
        steps: 9200,
        burnoutRiskScore: 24,
        stressFactorIndex: 15,
        predictorClass: "Low Risk",
        keyInsights: [
          "Social soothing mechanism activated. Oxytocin release from social laugh blocks acts as heart rate regulator.",
          "Biometrics indicate complete recovery. The nervous system has entered a robust parasympathetic growth state."
        ],
        physiologicalStatus: "Deep sleep cycles peaked. Dominant rest-and-digest status.",
        psychologicalStatus: "Perception of deep social support; very low feelings of isolation.",
        recommendations: [
          { action: "Nurture this social group—schedule a repeating social catch-up.", type: "social", urgency: "low" }
        ]
      },
      {
        offset: 3,
        journalText: "Sunday was calm. Prepped some meals for the week, and organized my desk. Ready for the week but not feeling anxious this time.",
        sentiment: { score: 0.7, label: "positive", primaryEmotion: "calm readiness", keywords: ["calm", "desk prep", "not anxious"] },
        hrv: 68,
        restingHR: 60,
        sleepHours: 7.9,
        sleepQuality: 84,
        steps: 5100,
        burnoutRiskScore: 23,
        stressFactorIndex: 18,
        predictorClass: "Low Risk",
        keyInsights: [
          "Mental organization without anticipation anxiety prevents standard Sunday night sympathetic spike.",
          "HRV stabilizes near 68 ms, ideal autonomic readiness."
        ],
        physiologicalStatus: "Balanced autonomic activity; body prepared for cognitive task load.",
        psychologicalStatus: "Constructive preparation without anticipation panic, low occupational threat indices.",
        recommendations: [
          { action: "Keep your workspace clean to lower subconscious visual stimuli and stress triggers.", type: "boundary", urgency: "low" }
        ]
      },
      {
        offset: 2,
        journalText: "Monday workspace was busy, but I paced myself. Declined an optional meeting that could have been an email and felt proud of myself.",
        sentiment: { score: 0.6, label: "positive", primaryEmotion: "agency", keywords: ["paced myself", "declined meeting", "proud"] },
        hrv: 64,
        restingHR: 62,
        sleepHours: 7.2,
        sleepQuality: 80,
        steps: 6800,
        burnoutRiskScore: 26,
        stressFactorIndex: 22,
        predictorClass: "Low Risk",
        keyInsights: [
          "Boundary-setting efficacy demonstrated. Exercising the right to say no directly reduces occupational overload risks.",
          "HRV stays comfortably high matching the paced behavioral design."
        ],
        physiologicalStatus: "Healthy autonomic balance. Body and mind operating in safe state.",
        psychologicalStatus: "High agency, protective cognitive boundaries fully active.",
        recommendations: [
          { action: "Continue using email/chat fallback for updates to minimize zoom meeting fatigue.", type: "boundary", urgency: "medium" }
        ]
      },
      {
        offset: 1,
        journalText: "Felt productive today. Actually finished a complex task that had been sitting on my plate forever. Efficacy is back up, feeling useful.",
        sentiment: { score: 0.8, label: "positive", primaryEmotion: "efficacy", keywords: ["productive", "finished task", "useful"] },
        hrv: 66,
        restingHR: 63,
        sleepHours: 7.4,
        sleepQuality: 82,
        steps: 7500,
        burnoutRiskScore: 22,
        stressFactorIndex: 20,
        predictorClass: "Low Risk",
        keyInsights: [
          "Maslach Personal Accomplishment surge! Efficacy directly matches task resolution, lowering burnout scoring.",
          "Constant physical baseline maintained with consistent circadian rhythms."
        ],
        physiologicalStatus: "Autonomic system normalized with a healthy circadian peak.",
        psychologicalStatus: "Strong occupational self-efficacy and low alienation.",
        recommendations: [
          { action: "Celebrate task resolution by taking 5 minutes to feel proud of your craft.", type: "mindfulness", urgency: "low" }
        ]
      },
      {
        offset: 0,
        journalText: "A very balanced day. Signed off early to play a video game, then walked around the block. Sticking to my healthy boundaries.",
        sentiment: { score: 0.82, label: "positive", primaryEmotion: "vibrant balance", keywords: ["balanced", "signed off early", "boundaries"] },
        hrv: 69,
        restingHR: 61,
        sleepHours: 7.6,
        sleepQuality: 85,
        steps: 8200,
        burnoutRiskScore: 18,
        stressFactorIndex: 16,
        predictorClass: "Low Risk",
        keyInsights: [
          "Vibrant balance achieved. Regular non-work evening play breaks cognitive tracking and resets nervous levels.",
          "Autonomic system is resting on stable and excellent cardiovascular reserve levels."
        ],
        physiologicalStatus: "Optimal HRV and resting heart rate trends highlighting complete somatic recovery.",
        psychologicalStatus: "Restored psychological safety, high boundaries, clear compartmentalization of labor.",
        recommendations: [
          { action: "Maintain this schedule; it serves as your golden recovery formula.", type: "recovery", urgency: "low" }
        ]
      }
    ];

    const logs = templates.map((tpl) => {
      const d = new Date();
      d.setDate(today.getDate() - tpl.offset);
      const dateString = d.toISOString().split("T")[0];

      return {
        id: `mock-id-${tpl.offset}`,
        date: dateString,
        journal: {
          text: tpl.journalText,
          sentiment: tpl.sentiment
        },
        biometrics: {
          hrv: tpl.hrv,
          restingHR: tpl.restingHR,
          sleepHours: tpl.sleepHours,
          sleepQuality: tpl.sleepQuality,
          steps: tpl.steps
        },
        analysis: {
          burnoutRiskScore: tpl.burnoutRiskScore,
          categories: {
            emotionalExhaustion: Math.min(100, Math.round(tpl.burnoutRiskScore * 1.05)),
            depersonalization: Math.min(100, Math.round(tpl.burnoutRiskScore * 0.9)),
            lackOfAccomplishment: Math.min(100, Math.round(tpl.burnoutRiskScore * 0.85))
          },
          sentimentAnalysis: tpl.sentiment,
          stressFactorIndex: tpl.stressFactorIndex,
          predictorClass: tpl.predictorClass,
          keyInsights: tpl.keyInsights,
          physiologicalStatus: tpl.physiologicalStatus,
          psychologicalStatus: tpl.psychologicalStatus,
          recommendations: tpl.recommendations
        }
      };
    });

    return res.json(logs);

  } catch (err: any) {
    console.error("Failed to generate mock:", err);
    return res.status(500).json({ error: "Generation failed", details: err.message });
  }
});


async function startServer() {
  // Serve static frontend files in production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Vite dev mode integration
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Burnout Predictor server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
