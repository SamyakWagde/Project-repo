import React, { useState } from "react";
import { DailyLog, Recommendation, WearableBiometrics } from "../types";
import { 
  Activity, 
  Moon, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Eye, 
  CheckCircle, 
  Flame, 
  PlusCircle, 
  Smile, 
  FileText,
  Bookmark,
  ChevronRight,
  Info,
  Settings,
  Download,
  Sparkles
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine
} from "recharts";

interface BurnoutDashboardProps {
  logs: DailyLog[];
  onSelectLog: (log: DailyLog) => void;
  userGoals?: {
    stepsTarget: number;
    sleepHoursTarget: number;
  };
  onOpenSettings?: () => void;
}

export default function BurnoutDashboard({ logs, onSelectLog, userGoals, onOpenSettings }: BurnoutDashboardProps) {
  const [completedRecommendations, setCompletedRecommendations] = useState<string[]>([]);
  const [selectedHistoricalLog, setSelectedHistoricalLog] = useState<DailyLog | null>(null);

  if (logs.length === 0) {
    return (
      <div id="dashboard-empty-state" className="bg-white/[0.03] border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
        <Activity className="w-12 h-12 text-teal-400 mx-auto animate-pulse" />
        <h3 className="text-lg font-serif italic text-white mt-4">Diagnostic Board is Empty</h3>
        <p className="text-xs text-white/40 mt-2 max-w-md mx-auto uppercase tracking-wider font-mono">
          We need at least one log to populate metrics. Type in today's journal and wearable vitals, or click "Auto-Generate 14-Day Simulation" in the navigation to instantly bootstrap visual trends.
        </p>
      </div>
    );
  }

  // Sort logs chronological for charts, reverse for feed list
  const chronologicalLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const latestLog = recentLogs[0];
  const latestAnalysis = latestLog.analysis;

  // Toggle checklist for recommendations
  const toggleRecommendation = (action: string) => {
    setCompletedRecommendations((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const handleDownloadReport = () => {
    try {
      const totalLogs = logs.length;
      if (totalLogs === 0) return;
      const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
      const latestLogEntry = sortedLogs[0];
      const avgHRV = Math.round(logs.reduce((acc, log) => acc + log.biometrics.hrv, 0) / totalLogs);
      const avgSleep = parseFloat((logs.reduce((acc, log) => acc + log.biometrics.sleepHours, 0) / totalLogs).toFixed(1));
      const avgSteps = Math.round(logs.reduce((acc, log) => acc + (log.biometrics.steps || 0), 0) / totalLogs);
      
      const reportData = {
        reportMetadata: {
          generatedAt: new Date().toISOString(),
          totalLogsCount: totalLogs,
          averageMetrics: {
            heartRateVariabilityMs: avgHRV,
            sleepHours: avgSleep,
            dailySteps: avgSteps
          },
          latestRiskAssessment: latestLogEntry?.analysis ? {
            date: latestLogEntry.date,
            predictorClass: latestLogEntry.analysis.predictorClass,
            burnoutRiskScore: latestLogEntry.analysis.burnoutRiskScore,
            stressFactorIndex: latestLogEntry.analysis.stressFactorIndex
          } : "No assessment data available"
        },
        logs: logs
      };

      const jsonString = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `burnout_diagnostics_report_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate and download report:", err);
    }
  };

  // Helper colors for Predictor Classes aligned to dark premium schema
  const getPredictorColor = (cls: string) => {
    switch (cls) {
      case "High Burnout Warning":
        return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", fill: "bg-red-500", progress: "from-red-500 to-rose-600" };
      case "Moderate Burnout Risk":
        return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", fill: "bg-amber-500", progress: "from-amber-400 to-orange-500" };
      case "Mild Fatigue":
        return { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", fill: "bg-indigo-500", progress: "from-indigo-400 to-purple-500" };
      default:
        return { text: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/20", fill: "bg-teal-500", progress: "from-teal-400 to-indigo-500" };
    }
  };

  const trendColor = getPredictorColor(latestAnalysis?.predictorClass ?? "Low Risk");

  // Custom SVG line-chart rendering helper designed with dark grids
  const renderSVGLineChart = (
    data: DailyLog[], 
    valueExtractor: (log: DailyLog) => number, 
    minVal: number, 
    maxVal: number, 
    label: string, 
    strokeColor: string,
    gradientId: string,
    isSentiment: boolean = false
  ) => {
    const width = 500;
    const height = 140;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    if (data.length < 2) {
      return (
        <div className="h-[140px] flex items-center justify-center text-xs text-white/30 font-medium font-mono">
          More history points required to establish trend curve.
        </div>
      );
    }

    // Points calculation
    const points = data.map((log, index) => {
      const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
      const rawVal = valueExtractor(log);
      // Bound
      const val = Math.max(minVal, Math.min(maxVal, rawVal));
      
      const normVal = (val - minVal) / (maxVal - minVal);
      // Invert Y because SVG coordinates starts from top left
      const y = paddingTop + (1 - normVal) * chartHeight;
      return { x, y, val: rawVal, date: log.date };
    });

    // Generate Path string
    let pathString = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      // Curve smoothing calculation
      const cpX1 = points[i - 1].x + (points[i].x - points[i - 1].x) / 3;
      const cpY1 = points[i - 1].y;
      const cpX2 = points[i].x - (points[i].x - points[i - 1].x) / 3;
      const cpY2 = points[i].y;
      pathString += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y}`;
    }

    // Area path for gradient fill
    const areaPathString = `${pathString} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    return (
      <svg id={`chart-svg-${gradientId}`} viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines in matching white opacity */}
        <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* Y Axis labels */}
        <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end" className="fill-white/30 font-mono text-[9px]">
          {isSentiment ? "+1.0" : maxVal}
        </text>
        <text x={paddingLeft - 8} y={paddingTop + chartHeight / 2 + 3} textAnchor="end" className="fill-white/30 font-mono text-[9px]">
          {isSentiment ? "0.0" : Math.round((maxVal + minVal) / 2)}
        </text>
        <text x={paddingLeft - 8} y={height - paddingBottom + 3} textAnchor="end" className="fill-white/30 font-mono text-[9px]">
          {isSentiment ? "-1.0" : minVal}
        </text>

        {/* Area fill */}
        <path d={areaPathString} fill={`url(#${gradientId})`} />

        {/* Main Line */}
        <path d={pathString} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />

        {/* Points Dot indicators */}
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r="3" className="fill-[#080808] stroke-2" stroke={strokeColor} />
            <circle cx={p.x} cy={p.y} r="6" className="fill-transparent hover:fill-teal-500/25 transition duration-150" />
            
            {/* Hover Simple Dot Tooltip */}
            <title>{`Date: ${p.date.slice(5)}\nValue: ${isSentiment ? p.val.toFixed(2) : Math.round(p.val)}`}</title>
          </g>
        ))}

        {/* X Axis Date markers */}
        {points.length > 0 && (
          <>
            <text x={points[0].x} y={height - 6} textAnchor="middle" className="fill-white/30 font-mono text-[9px]">
              {points[0].date.slice(5)}
            </text>
            <text x={points[points.length - 1].x} y={height - 6} textAnchor="middle" className="fill-white/30 font-mono text-[9px]">
              {points[points.length - 1].date.slice(5)}
            </text>
          </>
        )}
      </svg>
    );
  };

  // Extract last 7 days of logs to display correlation
  const last7DaysLogs = chronologicalLogs.slice(-7);
  const correlationData = last7DaysLogs.map((log) => {
    const dateObj = new Date(log.date);
    const formattedDate = isNaN(dateObj.getTime())
      ? log.date
      : dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    
    return {
      date: formattedDate,
      "Restorative Sleep (Hours)": log.biometrics.sleepHours,
      "Sentiment Positivity": parseFloat((log.analysis?.sentimentAnalysis?.score ?? 0).toFixed(2)),
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#121212]/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs space-y-2 font-mono">
          <p className="text-white/40 font-bold uppercase tracking-wider">{label}</p>
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-6">
              <span className="font-sans font-medium text-white/70" style={{ color: item.color }}>
                {item.name}:
              </span>
              <span className="font-bold text-white">
                {item.value} {item.name.includes("Sleep") ? "h" : ""}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="burnout-dashboard-wrapper" className="space-y-8">
      
      {/* Download Diagnostic Report Panel */}
      <div id="download-report-panel" className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            Diagnostic Telemetry Export
          </span>
          <h3 className="text-base font-serif italic text-white font-normal">Save Your Mental & Physical History</h3>
          <p className="text-xs text-white/40">Securely download a full JSON report of your daily wearable vitals and somatic sentiment logs.</p>
        </div>
        <button
          id="btn-download-report"
          type="button"
          onClick={handleDownloadReport}
          className="self-start sm:self-center inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 hover:text-teal-200 border border-teal-500/20 hover:border-teal-500/40 rounded-xl transition duration-150 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer shadow-xl active:scale-[0.98]"
        >
          <Download className="w-4 h-4 text-teal-400" />
          Download Report (.json)
        </button>
      </div>
      
      {/* SECTION 1: Master Prediction Metric & Bento Diagnostic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Prediction Indicator Gauge (Large Card) */}
        <div id="core-burnout-gauge-card" className="bg-white/[0.03] rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl lg:col-span-1 flex flex-col justify-between backdrop-blur-md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">Prediction Meter</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase font-bold ${trendColor.bg} ${trendColor.text} ${trendColor.border} border`}>
                <Flame className="w-3.5 h-3.5" />
                {latestAnalysis?.predictorClass ?? "Calculating"}
              </span>
            </div>

            {/* Gauge visual */}
            <div className="relative pt-6 flex flex-col items-center">
              
              {/* Semi-circular visual */}
              <div className="relative w-44 h-24 overflow-hidden flex items-end justify-center">
                <div className="absolute top-0 left-0 right-0 bottom-0 rounded-t-full bg-white/5 border-4 border-white/5"></div>
                {/* Custom rotate meter needle based on score */}
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-1 rounded-full bg-gradient-to-r ${trendColor.progress} origin-bottom transform`}
                  style={{ 
                    transform: `rotate(${(latestAnalysis?.burnoutRiskScore ?? 0) * 1.8}deg)`, 
                    height: '6px',
                    transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1)' 
                  }}
                ></div>
                
                {/* Hollow center */}
                <div className="absolute bottom-0 w-32 h-16 rounded-t-full bg-[#0a0a0a] flex flex-col items-center justify-end pb-2">
                  <span className="text-[10px] font-mono font-medium text-white/30 uppercase tracking-widest mt-1">Burnout Risk</span>
                  <span className="text-4xl font-serif italic font-normal text-white leading-none">
                    {latestAnalysis?.burnoutRiskScore ?? 0}
                  </span>
                </div>
              </div>

              <div className="flex justify-between w-full px-4 text-[9px] font-mono text-white/30 mt-2">
                <span>0 (LOW)</span>
                <span>100 (HIGH)</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 mt-6 space-y-2">
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Physiological load level:</div>
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-white/60">Autonomic Tension Index:</span>
              <span className="font-bold text-white">{latestAnalysis?.stressFactorIndex ?? 0}%</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${latestAnalysis?.stressFactorIndex ?? 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Bento Column 2: MBI Maslach Dimension breakdown */}
        <div id="mbi-breakdown-card" className="bg-white/[0.03] rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl lg:col-span-1 space-y-5 backdrop-blur-md">
          <div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">Psychological Dimensions (MBI Scale)</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <h3 className="text-xl font-serif italic text-white font-normal tracking-tight">Maslach Burnout Index</h3>
              <span className="p-0.5 bg-white/5 text-white/40 rounded-full hover:bg-white/10 cursor-pointer" title="Occupational Burnout is measured across three core dimensions according to clinical standards.">
                <Info className="w-3.5 h-3.5 text-teal-400" />
              </span>
            </div>
          </div>

          <div className="space-y-4">
            
            {/* Emotional Exhaustion */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-white/70">1. Emotional Exhaustion</span>
                <span className="font-mono text-white/40">{latestAnalysis?.categories?.emotionalExhaustion ?? 0}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-teal-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${latestAnalysis?.categories?.emotionalExhaustion ?? 0}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-white/40 leading-normal">
                Reflects feelings of being chronically drained in daily life.
              </p>
            </div>

            {/* Depersonalization */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-white/70">2. Detachment & Cynicism</span>
                <span className="font-mono text-white/40">{latestAnalysis?.categories?.depersonalization ?? 0}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${latestAnalysis?.categories?.depersonalization ?? 0}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-white/40 leading-normal">
                Reflects mental detachment or defensive indifference.
              </p>
            </div>

            {/* Accomplishment */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-white/70">3. Sense of Low Efficacy</span>
                <span className="font-mono text-white/40">{latestAnalysis?.categories?.lackOfAccomplishment ?? 0}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${latestAnalysis?.categories?.lackOfAccomplishment ?? 0}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-white/40 leading-normal">
                Reflects believing your efforts hold little value.
              </p>
            </div>

          </div>
        </div>

        {/* Bento Column 3: Daily Target Progress */}
        <div id="personal-goals-card" className="bg-white/[0.03] rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl lg:col-span-1 flex flex-col justify-between backdrop-blur-md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">My Milestones</span>
              <button
                id="btn-inline-settings"
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-teal-400 rounded-lg border border-white/10 transition duration-155 cursor-pointer flex items-center justify-center animate-pulse"
                title="Edit Milestones"
              >
                <Settings className="w-3.5 h-3.5 text-teal-400" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <h3 className="text-xl font-serif italic text-white font-normal tracking-tight">Daily Goals Progress</h3>
            </div>

            <p className="text-[10px] text-white/40 leading-normal font-mono uppercase tracking-widest">
              Daily comparative baselines.
            </p>
          </div>

          <div className="space-y-5 pt-4">
            {/* Daily Sleep Hours progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-white/70">Sleep Goal</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs text-white/95 font-semibold">{latestLog.biometrics.sleepHours}h </span>
                  <span className="font-mono text-[10px] text-white/30">/ {userGoals?.sleepHoursTarget ?? 8.0}h</span>
                </div>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden relative">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, (latestLog.biometrics.sleepHours / (userGoals?.sleepHoursTarget ?? 8.0)) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-white/30">
                <span>0%</span>
                <span className="font-bold text-teal-400">
                  {Math.round((latestLog.biometrics.sleepHours / (userGoals?.sleepHoursTarget ?? 8.0)) * 100)}% Completed
                </span>
                <span>100%</span>
              </div>
            </div>

            {/* Daily Steps progress bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-semibold text-white/70">Active Steps</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs text-white/95 font-semibold">{(latestLog.biometrics.steps || 0).toLocaleString()} </span>
                  <span className="font-mono text-[10px] text-white/30 font-mono">/ {(userGoals?.stepsTarget ?? 10000).toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden relative">
                <div 
                  className="bg-gradient-to-r from-orange-400 to-amber-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, ((latestLog.biometrics.steps || 0) / (userGoals?.stepsTarget ?? 10000)) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-white/30">
                <span>0%</span>
                <span className="font-bold text-teal-400">
                  {Math.round(((latestLog.biometrics.steps || 0) / (userGoals?.stepsTarget ?? 10000)) * 100)}% Completed
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 2: Dynamic Empathetic Insights and Synthesis */}
      <div className="bg-gradient-to-br from-white/[0.03] to-[#111111] rounded-3xl p-6 md:p-8 border border-white/10 text-white shadow-2xl relative overflow-hidden">
        {/* Abstract design dots */}
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="relative space-y-6">
          <div className="flex items-center gap-2">
            <Smile className="w-5 h-5 text-teal-400" />
            <h3 className="text-xs font-mono font-medium text-teal-400 uppercase tracking-widest">Holistic Diagnostic Synthesis</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="space-y-3">
              <div className="text-[10px] font-mono font-semibold text-white/30 uppercase tracking-widest">Physiological Summary</div>
              <p className="text-sm text-white/80 leading-relaxed font-sans font-light">
                {latestAnalysis?.physiologicalStatus ?? "Calculating autonomic responses..."}
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] text-white/30 block tracking-wider uppercase font-mono">HRV</span>
                  <span className="text-xs font-mono font-bold text-white">{latestLog.biometrics.hrv} ms</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] text-white/30 block tracking-wider uppercase font-mono">RHR</span>
                  <span className="text-xs font-mono font-bold text-white">{latestLog.biometrics.restingHR} bpm</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] text-white/30 block tracking-wider uppercase font-mono">Sleep</span>
                  <span className="text-xs font-mono font-bold text-white">{latestLog.biometrics.sleepHours} h</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-mono font-semibold text-white/30 uppercase tracking-widest">Psychological Sentiment</div>
              <p className="text-sm text-white/80 leading-relaxed font-sans font-light">
                {latestAnalysis?.psychologicalStatus ?? "Venting details in the journal card allows sentiment analysis..."}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs capitalize font-mono text-teal-400">
                  {latestAnalysis?.sentimentAnalysis?.label ?? "neutral"} ({latestAnalysis?.sentimentAnalysis?.score ?? 0})
                </span>
                {latestAnalysis?.sentimentAnalysis?.keywords?.map((kw, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>

          </div>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <h4 className="text-[10px] uppercase font-bold text-teal-400 tracking-widest font-mono">Key Diagnostic Integration insights</h4>
            <ul className="space-y-3">
              {latestAnalysis?.keyInsights?.map((insight, idx) => (
                <li key={idx} className="text-xs text-white/70 flex items-start gap-2.5 leading-relaxed">
                  <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              )) ?? (
                <li className="text-xs text-white/40 italic font-mono uppercase tracking-wider">Submit journal details to receive core therapeutic insights</li>
              )}
            </ul>
          </div>

        </div>
      </div>

      {/* SECTION 3: Customized Actionable Recovery Recommendations Checklist */}
      <div id="recommendations-checklist" className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        <h3 className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest mb-1">Tailored Recharging Protocols</h3>
        <h2 className="text-xl font-serif italic text-white font-normal mt-1 mb-6">Actionable Somatic & Executive Guidelines</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {latestAnalysis?.recommendations?.map((rec, idx) => {
            const isCompleted = completedRecommendations.includes(rec.action);
            return (
              <div 
                key={idx}
                id={`recommendation-box-${idx}`}
                onClick={() => toggleRecommendation(rec.action)}
                className={`p-4 border rounded-2xl flex items-start gap-3.5 cursor-pointer transition select-none ${
                  isCompleted 
                    ? "bg-white/[0.01] border-white/5 text-white/30" 
                    : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10 hover:border-teal-400/30 text-white/80 shadow-xs"
                }`}
              >
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => {}} // toggled on box level
                    className="rounded-lg h-4.5 w-4.5 border-white/20 text-teal-500 focus:ring-teal-400 bg-black/40 cursor-pointer pointer-events-none"
                  />
                </div>
                <div className="space-y-1 my-auto">
                  <p className={`text-xs leading-relaxed font-medium ${isCompleted ? "line-through text-white/30" : "text-white/95"}`}>
                    {rec.action}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#1d1d1d] text-teal-400 uppercase">
                      {rec.type}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      rec.urgency === 'high' ? "bg-red-500/10 text-red-400" : rec.urgency === 'medium' ? "bg-amber-500/10 text-amber-400" : "bg-teal-500/10 text-teal-400"
                    }`}>
                      {rec.urgency} Urgency
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3.5: Weekly Sleep & Sentiment Correlation Chart (Recharts) */}
      <div id="weekly-correlation-section" className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              Somatic Sentiment Alignment
            </span>
            <h2 className="text-xl font-serif italic text-white font-normal mt-1">Sleep & Sentiment Positivity Correlation</h2>
            <p className="text-xs text-white/40 mt-1 max-w-2xl">
              Compare your daily restorative sleep duration against the overall positivity of your journal entries over the last 7 logs.
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-right font-mono text-xs space-y-1 self-start sm:self-center">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">7-Log Baselines</div>
            <div className="text-white">
              <span className="text-indigo-400 font-bold">Avg Sleep:</span> {(correlationData.reduce((acc, d) => acc + d["Restorative Sleep (Hours)"], 0) / (correlationData.length || 1)).toFixed(1)}h
            </div>
            <div className="text-white">
              <span className="text-teal-400 font-bold">Avg Sentiment:</span> {(correlationData.reduce((acc, d) => acc + d["Sentiment Positivity"], 0) / (correlationData.length || 1)).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="h-[280px] w-full" id="correlation-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={correlationData}
              margin={{ top: 15, right: 10, bottom: 5, left: -10 }}
            >
              <defs>
                <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={9} 
                fontFamily="JetBrains Mono, monospace" 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                yAxisId="left" 
                stroke="#818cf8" 
                fontSize={9} 
                fontFamily="JetBrains Mono, monospace" 
                tickLine={false} 
                axisLine={false} 
                domain={[0, 12]}
                tickCount={7}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#2dd4bf" 
                fontSize={9} 
                fontFamily="JetBrains Mono, monospace" 
                tickLine={false} 
                axisLine={false} 
                domain={[-1, 1]}
                tickCount={5}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.6)' }} 
              />
              {/* Bar for sleep hours */}
              <Bar 
                yAxisId="left" 
                name="Restorative Sleep" 
                dataKey="Restorative Sleep (Hours)" 
                fill="#6366f1" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={28}
                opacity={0.85}
                isAnimationActive={true}
                animationBegin={100}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              {/* Line for sentiment score */}
              <Line 
                yAxisId="right" 
                name="Sentiment Positivity" 
                type="monotone" 
                dataKey="Sentiment Positivity" 
                stroke="#2dd4bf" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 1, fill: "#0a0a0a" }} 
                activeDot={{ r: 6 }} 
                isAnimationActive={true}
                animationBegin={400}
                animationDuration={1600}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-white/30 font-mono text-center tracking-wider">
          💡 PRO-TIP: Sleep hours are charted on the <span className="text-indigo-400 font-bold">left axis</span> while journal sentiment score (-1 to +1) is plotted on the <span className="text-teal-400 font-bold">right axis</span>.
        </p>
      </div>

      {/* SECTION 4: Interactive Historical SVG curves */}
      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur-md">
        <div>
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">Time-series Biomarkers</span>
          <h2 className="text-xl font-serif italic text-white font-normal mt-1">Wearable Trends & Emotional Variance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="bg-white/[0.01] rounded-2xl border border-white/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/75">Autonomic Tension (HRV ms)</span>
              <span className="text-[10px] font-mono text-teal-400">Aim for high</span>
            </div>
            {renderSVGLineChart(chronologicalLogs, (log) => log.biometrics.hrv, 15, 100, "HRV", "#2dd4bf", "grad-hrv")}
            <p className="text-[9px] font-mono text-white/20 text-center">X: Logs | Y: HRV (ms)</p>
          </div>

          <div className="bg-white/[0.01] rounded-2xl border border-white/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/75">Restorative Sleep (Hours)</span>
              <span className="text-[10px] font-mono text-indigo-400">Aim for {">"} 7h</span>
            </div>
            {renderSVGLineChart(chronologicalLogs, (log) => log.biometrics.sleepHours, 4, 10, "Sleep", "#6366f1", "grad-sleep")}
            <p className="text-[9px] font-mono text-white/20 text-center">X: Logs | Y: Sleep (Hours)</p>
          </div>

          <div className="bg-white/[0.01] rounded-2xl border border-white/5 p-5 space-y-3 md:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/75">Journal Sentiment positivity</span>
              <span className="text-[10px] font-mono text-purple-400">Valued -1.0 to +1.0</span>
            </div>
            {renderSVGLineChart(chronologicalLogs, (log) => log.analysis?.sentimentAnalysis?.score ?? 0, -1, 1, "Vibe", "#a855f7", "grad-vibe", true)}
            <p className="text-[9px] font-mono text-white/20 text-center">X: Logs | Y: Sentiment Index</p>
          </div>

        </div>
      </div>

      {/* SECTION 5: Previous Diagnosis lists explorer */}
      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-4 backdrop-blur-md">
        <div>
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">History Explorer</span>
          <h2 className="text-xl font-serif italic text-white font-normal mt-1">Previous Burnout Logs</h2>
        </div>

        <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
          {recentLogs.map((log) => (
            <div 
              key={log.id} 
              id={`history-row-${log.id}`}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white/5 rounded-xl px-2.5 transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 font-mono text-xs font-semibold">
                  {log.date.slice(5)}
                </div>
                <div>
                  <div className="text-[10px] font-mono text-white/30">{log.date}</div>
                  <div className="text-sm font-light text-white/80 line-clamp-1 max-w-sm sm:max-w-md">
                    "{log.journal.text || "Vitals-only recording"}"
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-center">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
                  getPredictorColor(log.analysis?.predictorClass ?? "Low Risk").bg
                } ${getPredictorColor(log.analysis?.predictorClass ?? "Low Risk").text}`}>
                  Risk: {log.analysis?.burnoutRiskScore ?? 0}/100
                </span>
                
                <button
                  id={`btn-view-hist-${log.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedHistoricalLog(log);
                    onSelectLog(log);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 text-teal-400 duration-150 rounded-lg group-hover:translate-x-0.5 transition cursor-pointer"
                  title="Drill-down Diagnostic"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

