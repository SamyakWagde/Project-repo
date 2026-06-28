export interface JournalSentiment {
  score: number; // -1 (very negative) to +1 (very positive)
  label: 'positive' | 'neutral' | 'negative';
  primaryEmotion: string;
  keywords: string[];
}

export interface JournalEntry {
  text: string;
  sentiment: JournalSentiment | null;
}

export interface WearableBiometrics {
  hrv: number;         // Heart Rate Variability in ms (lower = more stressed)
  restingHR: number;   // Resting Heart Rate in bpm (higher = more stressed)
  sleepHours: number;  // Duration of sleep in hours
  sleepQuality: number;// Quality score 0-100 (deep/REM sleep ratio etc.)
  steps: number;       // Activity level
}

export interface Recommendation {
  action: string;
  type: 'recovery' | 'boundary' | 'social' | 'physical' | 'mindfulness';
  urgency: 'high' | 'medium' | 'low';
}

export interface BurnoutAnalysis {
  burnoutRiskScore: number; // 0 to 100
  categories: {
    emotionalExhaustion: number; // 0 to 100
    depersonalization: number;   // 0 to 100 (cynicism / detachment)
    lackOfAccomplishment: number;// 0 to 100 (feelings of low efficacy)
  };
  sentimentAnalysis: JournalSentiment;
  stressFactorIndex: number;    // Physiological stress index (0-100) combining HRV, RHR, sleep deficit
  predictorClass: 'Low Risk' | 'Mild Fatigue' | 'Moderate Burnout Risk' | 'High Burnout Warning';
  keyInsights: string[];
  physiologicalStatus: string;  // Analysis of physical recovery from wearables (e.g., "high autonomic strain")
  psychologicalStatus: string;  // Analysis of psychological state from journal (e.g., "cognitive fatigue, feelings of isolation")
  recommendations: Recommendation[];
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  journal: JournalEntry;
  biometrics: WearableBiometrics;
  analysis: BurnoutAnalysis | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
