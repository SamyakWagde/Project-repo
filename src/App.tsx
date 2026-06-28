import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  BookOpen, 
  Bot, 
  Settings, 
  Activity, 
  Calendar, 
  Sparkles, 
  AlertTriangle, 
  RefreshCcw, 
  X,
  PlusCircle,
  HelpCircle,
  TrendingUp,
  Flame,
  ArrowRight,
  Brain,
  Database
} from "lucide-react";
import { DailyLog, WearableBiometrics } from "./types";
import BiometricInputs from "./components/BiometricInputs";
import JournalEntryForm from "./components/JournalEntryForm";
import BurnoutDashboard from "./components/BurnoutDashboard";
import AIChatBot from "./components/AIChatBot";
import AIFloatingWidget from "./components/AIFloatingWidget";
import { BurnoutPredictorModel } from "./components/BurnoutPredictorModel";
import { apiFetch } from "./utils/api";

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage item retrieval failed (disabled or blocked by sandbox):", e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage item saving failed (disabled or blocked by sandbox):", e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage item removal failed (disabled or blocked by sandbox):", e);
    }
  }
};

export default function App() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [activeTab, setActiveTab] = useState<"evaluation" | "dashboard" | "chat" | "model">("evaluation");
  
  // Input fields state
  const [currentJournalText, setCurrentJournalText] = useState("");
  const [currentBiometrics, setCurrentBiometrics] = useState<WearableBiometrics>({
    hrv: 52,
    restingHR: 68,
    sleepHours: 7.2,
    sleepQuality: 78,
    steps: 6200
  });

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHistoricalLog, setSelectedHistoricalLog] = useState<DailyLog | null>(null);

  // User Target Milestones configuration state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userGoals, setUserGoals] = useState(() => {
    try {
      const storedGoals = safeStorage.getItem("burnout_user_goals");
      if (storedGoals) {
        const parsed = JSON.parse(storedGoals);
        if (parsed && typeof parsed === "object") {
          return {
            stepsTarget: typeof parsed.stepsTarget === "number" && parsed.stepsTarget > 0 ? parsed.stepsTarget : 10000,
            sleepHoursTarget: typeof parsed.sleepHoursTarget === "number" && parsed.sleepHoursTarget > 0 ? parsed.sleepHoursTarget : 8.0
          };
        }
      }
    } catch {
      // safe fallback
    }
    return {
      stepsTarget: 10000,
      sleepHoursTarget: 8.0
    };
  });

  const [stepsDraft, setStepsDraft] = useState(10005);
  const [sleepDraft, setSleepDraft] = useState(8.0);

  useEffect(() => {
    if (settingsOpen) {
      setStepsDraft(userGoals.stepsTarget ?? 10000);
      setSleepDraft(userGoals.sleepHoursTarget ?? 8.0);
    }
  }, [settingsOpen, userGoals]);

  const handleSaveGoals = (newGoals: { stepsTarget: number; sleepHoursTarget: number }) => {
    const validated = {
      stepsTarget: Math.max(100, newGoals.stepsTarget || 10000),
      sleepHoursTarget: Math.max(1, newGoals.sleepHoursTarget || 8.0)
    };
    setUserGoals(validated);
    safeStorage.setItem("burnout_user_goals", JSON.stringify(validated));
  };

  // Load logs from localStorage on initial render
  useEffect(() => {
    try {
      const stored = safeStorage.getItem("burnout_logs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setLogs(parsed);
        } else {
          safeStorage.removeItem("burnout_logs");
        }
      }
    } catch (e) {
      console.error("Local recovery of logs failed:", e);
    }
  }, []);

  // Quick auto-fill biometric from a mock wearble fetch
  const handleAutoSyncVitals = () => {
    setSyncing(true);
    // Mimic real Bluetooth or OAuth API sync from Fitbit/Garmin with organic variances
    setTimeout(() => {
      const mockHRVs = [34, 45, 68, 88, 22, 59, 71];
      const mockRHRs = [62, 74, 81, 58, 87, 65, 60];
      const randomIndex = Math.floor(Math.random() * mockHRVs.length);

      setCurrentBiometrics({
        hrv: mockHRVs[randomIndex],
        restingHR: mockRHRs[randomIndex],
        sleepHours: parseFloat((6.0 + Math.random() * 3.5).toFixed(1)),
        sleepQuality: Math.floor(60 + Math.random() * 35),
        steps: Math.floor(4000 + Math.random() * 12000)
      });
      setSyncing(false);
    }, 900);
  };

  // Generate complete historical 14-day mock burnout demonstration
  const handleBootstrapSimulation = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await apiFetch("/api/generate_mock_data", { method: "POST" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setLogs(data);
        safeStorage.setItem("burnout_logs", JSON.stringify(data));
        setActiveTab("dashboard");
      } else {
        setError(data.error || "Unable to bootstrap visual simulator logs.");
      }
    } catch (err) {
      setError("Failed to connect to full-stack Express service. Please configure port 3000.");
    } finally {
      setSyncing(false);
    }
  };

  // Run sentiment extraction and complete burnout evaluation via Express Gemini endpoint
  const handleAnalyzeSubmission = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalText: currentJournalText,
          biometrics: currentBiometrics
        })
      });

      const parsedAnalysis = await res.json();

      if (res.ok && parsedAnalysis.burnoutRiskScore !== undefined) {
        const newLog: DailyLog = {
          id: `log-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          journal: {
            text: currentJournalText,
            sentiment: parsedAnalysis.sentimentAnalysis
          },
          biometrics: { ...currentBiometrics },
          analysis: parsedAnalysis
        };

        // Filter out any duplicate log of today's date, prepending latest
        const updatedLogs = [newLog, ...logs.filter((l) => l.date !== newLog.date)];
        setLogs(updatedLogs);
        safeStorage.setItem("burnout_logs", JSON.stringify(updatedLogs));

        // Clear current journal field and show visual wellness trends board
        setCurrentJournalText("");
        setActiveTab("dashboard");
      } else {
        setError(parsedAnalysis.details || parsedAnalysis.error || "The prediction evaluation failed to return data.");
      }
    } catch (err: any) {
      setError("Analysis connection timed out. Please check that client is targeting server on port 3000.");
    } finally {
      setLoading(false);
    }
  };

  // Clear all logs utility
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleClearAllHistory = () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      // Auto-reset state if not clicked again within 4 seconds
      setTimeout(() => {
        setConfirmWipe(false);
      }, 4000);
    } else {
      setLogs([]);
      safeStorage.removeItem("burnout_logs");
      setSelectedHistoricalLog(null);
      setConfirmWipe(false);
    }
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-[#080808] text-[#e5e5e5] font-sans selection:bg-teal-500 selection:text-white pb-24">
      
      {/* 1. Global Navigation Frame */}
      <header className="sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
              <Activity className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none flex items-center gap-1.5">
                Mental Burnout Predictor
              </h1>
              <span className="text-[10px] text-white/40 font-medium font-mono uppercase tracking-wider">Wearables + Journal Cognitive Diagnostics</span>
            </div>
          </div>

          {/* Tab buttons */}
          <nav className="hidden md:flex items-center bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              id="tab-btn-eval"
              type="button"
              onClick={() => setActiveTab("evaluation")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl tracking-wide duration-155 cursor-pointer ${
                activeTab === "evaluation" ? "bg-white/10 text-teal-400 shadow-sm" : "text-white/60 hover:text-white"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Daily Entry Log
            </button>
            <button
              id="tab-btn-dash"
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl tracking-wide duration-155 cursor-pointer ${
                activeTab === "dashboard" ? "bg-white/10 text-teal-400 shadow-sm" : "text-white/60 hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Burnout Dashboard
            </button>
            <button
              id="tab-btn-chat"
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl tracking-wide duration-155 cursor-pointer ${
                activeTab === "chat" ? "bg-white/10 text-teal-400 shadow-sm" : "text-white/60 hover:text-white"
              }`}
            >
              <Bot className="w-4 h-4" />
              AI Coping Companion
            </button>
            <button
              id="tab-btn-model"
              type="button"
              onClick={() => setActiveTab("model")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl tracking-wide duration-155 cursor-pointer ${
                activeTab === "model" ? "bg-white/10 text-teal-400 shadow-sm" : "text-white/60 hover:text-white"
              }`}
            >
              <Brain className="w-4 h-4" />
              Predictive ML Model
            </button>
          </nav>

          {/* Quick simulation helper + settings */}
          <div className="flex items-center gap-2.5">
            <button
              id="btn-bootstrap-simulation"
              type="button"
              onClick={handleBootstrapSimulation}
              disabled={syncing}
              className="px-3.5 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-semibold text-xs rounded-xl border border-teal-500/20 transition duration-150 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {syncing ? "Generating..." : "Auto-Generate Scenario"}
            </button>

            <button
              id="btn-settings-toggle"
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="p-2.5 bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 hover:text-white border border-white/10 rounded-xl transition cursor-pointer flex items-center justify-center"
              title="Configure Personal Performance Goals"
            >
              <Settings className="w-4 h-4 text-teal-400" />
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Sticky Tab Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d0d0d] border-t border-white/5 z-55 py-2 shadow-2xl px-4 flex justify-around">
        <button
          id="m-tab-eval"
          type="button"
          onClick={() => setActiveTab("evaluation")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeTab === "evaluation" ? "text-teal-400" : "text-white/40"
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span>Evaluation</span>
        </button>
        <button
          id="m-tab-dash"
          type="button"
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeTab === "dashboard" ? "text-teal-400" : "text-white/40"
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Dashboard</span>
        </button>
        <button
          id="m-tab-chat"
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeTab === "chat" ? "text-teal-400" : "text-white/40"
          }`}
        >
          <Bot className="w-5 h-5" />
          <span>Companion</span>
        </button>
        <button
          id="m-tab-model"
          type="button"
          onClick={() => setActiveTab("model")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeTab === "model" ? "text-teal-400" : "text-white/40"
          }`}
        >
          <Brain className="w-5 h-5" />
          <span>Predictor</span>
        </button>
      </div>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Error notification and Setup Secrets guide */}
        {error && (
          <div id="error-alert-wrapper" className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 mb-8 flex items-start gap-4">
            <AlertTriangle className="w-5.5 h-5.5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Diagnostic Evaluation Halted</h3>
              <p className="text-xs text-white/75 leading-relaxed">
                {error}
              </p>
              {error.includes("GEMINI_API_KEY") && (
                <p className="text-xs text-teal-400 font-medium pt-1">
                  💡 <strong>To resolve</strong>: Close this panel, click the <strong>Settings</strong> cog at the top-right of your AI Studio Build workspace, open the <strong>Secrets</strong> menu, add your <code>GEMINI_API_KEY</code>, and re-run!
                </p>
              )}
            </div>
            <button
              id="btn-error-close"
              type="button"
              onClick={() => setError(null)}
              className="ml-auto p-1.5 hover:bg-white/5 rounded-xl text-white/60 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab content renders */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {activeTab === "evaluation" && (
              <div className="space-y-8">
                {/* AI Assistant Banner */}
                <div className="bg-gradient-to-r from-teal-950/30 via-indigo-950/20 to-purple-950/20 border border-teal-500/20 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0 animate-pulse">
                      <Bot className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        1-on-1 AI Assistant
                        <span className="text-[10px] font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full tracking-wider uppercase">Active Helper</span>
                      </h3>
                      <p className="text-xs text-white/60 mt-1 max-w-xl leading-relaxed">
                        Need tailored coping tools, boundary script templates, or a somatic breathing guide? Speak directly with your empathetic AI Coping Companion, seeded with your latest biometrics.
                      </p>
                    </div>
                  </div>
                  <button
                    id="btn-goto-ai-assistant"
                    type="button"
                    onClick={() => setActiveTab("chat")}
                    className="self-start md:self-center px-5 py-2.5 bg-gradient-to-tr from-teal-400 to-indigo-500 hover:from-teal-300 hover:to-indigo-400 text-[#0d0d0d] font-bold text-xs rounded-xl shadow-lg transition active:scale-95 duration-150 cursor-pointer flex items-center gap-2 border border-white/10"
                  >
                    <span>Start Live Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div id="tab-content-evaluation" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Left Side: Biometrics Sliders */}
                  <div className="space-y-6">
                    <BiometricInputs
                      biometrics={currentBiometrics}
                      onChange={setCurrentBiometrics}
                      onSyncMockWearable={handleAutoSyncVitals}
                      syncing={syncing}
                    />
                  </div>

                  {/* Right Side: Mindful Journal */}
                  <div>
                    <JournalEntryForm
                      text={currentJournalText}
                      onChange={setCurrentJournalText}
                      onSubmit={handleAnalyzeSubmission}
                      loading={loading}
                    />
                  </div>

                </div>
              </div>
            )}

            {activeTab === "dashboard" && (
              <div id="tab-content-dashboard" className="space-y-6">
                
                {/* Dashboard Options Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                  <div>
                    <h2 className="text-2xl font-serif italic text-white flex items-center gap-2 font-normal">
                      <TrendingUp className="w-6 h-6 text-teal-400" />
                      Wellness Trend Dashboard
                    </h2>
                    <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">
                      Tracking physiological autonomic changes alongside psychological sentiment.
                    </p>
                  </div>

                  <button
                    id="btn-wipe-history"
                    type="button"
                    onClick={handleClearAllHistory}
                    className={`self-start sm:self-center px-3.5 py-1.5 border text-xs font-semibold rounded-xl transition duration-150 cursor-pointer ${
                      confirmWipe
                        ? "border-red-500 bg-red-500/20 text-red-200 animate-pulse"
                        : "border-red-500/20 text-red-400 hover:bg-red-500/10"
                    }`}
                  >
                    {confirmWipe ? "Click Again to Confirm Wipe!" : "Wipe Diagnostics History"}
                  </button>
                </div>

                <BurnoutDashboard
                  logs={logs}
                  onSelectLog={(log) => setSelectedHistoricalLog(log)}
                  userGoals={userGoals}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              </div>
            )}

            {activeTab === "chat" && (
              <div id="tab-content-chat">
                <AIChatBot latestLog={logs[0] || null} />
              </div>
            )}

            {activeTab === "model" && (
              <div id="tab-content-model">
                <BurnoutPredictorModel />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Drill-down Detail Modal */}
      {selectedHistoricalLog && (
        <div id="drill-down-modal-shim" className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Diagnostic Detail: {selectedHistoricalLog.date}</h3>
                  <p className="text-[10px] text-white/30 font-mono">Log ID: {selectedHistoricalLog.id}</p>
                </div>
              </div>
              <button
                id="btn-modal-close"
                type="button"
                onClick={() => setSelectedHistoricalLog(null)}
                className="p-1.5 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Journal Quote text info */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-400" /> Journal Entry Note
                </span>
                <p className="p-4 bg-white/[0.02] rounded-2xl text-sm text-white/80 font-serif italic border border-white/5 leading-relaxed">
                  "{selectedHistoricalLog.journal.text || "No text log was provided for this day."}"
                </p>
              </div>

              {/* Vitals detail list */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono font-semibold">HRV</span>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">{selectedHistoricalLog.biometrics.hrv} ms</div>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono font-semibold">Resting HR</span>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">{selectedHistoricalLog.biometrics.restingHR} bpm</div>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono font-semibold">Sleep hours</span>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">{selectedHistoricalLog.biometrics.sleepHours} hrs</div>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono font-semibold">Sentiment Positivity</span>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">
                    {selectedHistoricalLog.analysis?.sentimentAnalysis?.score?.toFixed(2) ?? "0.00"}
                  </div>
                </div>
              </div>

              {/* Cognitive insights block */}
              <div className="space-y-3">
                <h4 className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">Dynamic Insights</h4>
                <div className="space-y-2">
                  {selectedHistoricalLog.analysis?.keyInsights?.map((ins, i) => (
                    <p key={i} className="text-xs text-white/70 leading-relaxed pl-4 border-l-2 border-teal-500">
                      {ins}
                    </p>
                  )) ?? (
                    <p className="text-xs text-white/40 italic pl-4 border-l-2 border-white/10">No insights available for this log.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01] flex justify-end">
              <button
                id="btn-modal-close-foot"
                type="button"
                onClick={() => setSelectedHistoricalLog(null)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Close Diagnostic Summary
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Settings Modal (Daily Goals) */}
      {settingsOpen && (
        <div id="settings-goals-modal shadow-2xl" className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/10 flex flex-col p-6 space-y-5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Settings className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Target Benchmarks</h3>
                  <p className="text-[10px] text-white/30 font-mono">Personalized Performance Baselines</p>
                </div>
              </div>
              <button
                id="btn-settings-close-icon"
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="space-y-4 pt-1">
              {/* Daily Steps Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/70 flex items-center justify-between">
                  <span>Daily Steps Target</span>
                  <span className="font-mono text-teal-400 text-[10px]">{stepsDraft.toLocaleString()} steps</span>
                </label>
                <input
                  id="input-target-steps"
                  type="number"
                  min="1000"
                  max="50000"
                  step="500"
                  value={stepsDraft}
                  onChange={(e) => setStepsDraft(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-400/50 font-mono transition"
                />
                <p className="text-[10px] text-white/30 leading-normal">
                  General active milestone recommended to sustain metabolic activity and cardiorespiratory health.
                </p>
              </div>

              {/* Daily Sleep Hours Input */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-white/70 flex items-center justify-between">
                  <span>Daily Sleep Target</span>
                  <span className="font-mono text-teal-400 text-[10px]">{sleepDraft} hours</span>
                </label>
                <input
                  id="input-target-sleep"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={sleepDraft}
                  onChange={(e) => setSleepDraft(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-400/50 font-mono transition"
                />
                <p className="text-[10px] text-white/30 leading-normal">
                  Target duration of bedtime rest required to facilitate full endocrine and memory recovery.
                </p>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/5 justify-end">
              <button
                id="btn-settings-cancel"
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-settings-save"
                type="button"
                onClick={() => {
                  handleSaveGoals({
                    stepsTarget: stepsDraft || 10000,
                    sleepHoursTarget: sleepDraft || 8.0
                  });
                  setSettingsOpen(false);
                }}
                className="px-4 py-2 bg-teal-400 hover:bg-teal-500 text-[#080808] font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Save Milestones
              </button>
            </div>
          </div>
        </div>
      )}

      <AIFloatingWidget 
        latestLog={logs[0] || null} 
        onNavigateToTab={(tab) => setActiveTab(tab)} 
      />

    </div>
  );
}
