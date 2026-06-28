import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Brain, 
  Cpu, 
  Settings2, 
  Activity, 
  Play, 
  CheckCircle, 
  TrendingDown, 
  Briefcase, 
  ShieldAlert, 
  FileSpreadsheet, 
  Clock, 
  Heart,
  Smile,
  Users,
  Compass
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { apiFetch } from "../utils/api";

interface TrainingMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lossHistory: number[];
  weights: Record<string, number>;
  bias: number;
  sampleCount: number;
  epochs: number;
}

interface PredictionResult {
  probability: number;
  burnoutRisk: number;
  riskLevel: string;
}

export function BurnoutPredictorModel() {
  const [learningRate, setLearningRate] = useState<number>(0.05);
  const [epochs, setEpochs] = useState<number>(600);
  const [training, setTraining] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom inputs for predicting
  const [age, setAge] = useState<number>(35);
  const [yearsAtCompany, setYearsAtCompany] = useState<number>(5);
  const [workHours, setWorkHours] = useState<number>(45);
  const [remoteWork, setRemoteWork] = useState<string>("Hybrid");
  const [jobSatisfaction, setJobSatisfaction] = useState<number>(6);
  const [stressLevel, setStressLevel] = useState(6);
  const [productivity, setProductivity] = useState<number>(7);
  const [sleepHours, setSleepHours] = useState<number>(7);
  const [activityHrs, setActivityHrs] = useState<number>(4);
  const [commuteTime, setCommuteTime] = useState<number>(45);
  const [hasMentalSupport, setHasMentalHealthSupport] = useState<string>("No");
  const [managerSupport, setManagerSupport] = useState<number>(6);
  const [hasTherapy, setHasTherapy] = useState<string>("No");
  const [mentalHealthDays, setMentalHealthDaysOff] = useState<number>(2);
  const [workLifeBalance, setWorkLifeBalance] = useState<number>(6);
  const [teamSize, setTeamSize] = useState<number>(8);
  const [careerGrowth, setCareerGrowth] = useState<number>(6);

  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<{ riskScore: number; riskClass: string } | null>(null);

  // Initial load: auto-train the model if not trained yet
  useEffect(() => {
    handleTrainModel(true);
  }, []);

  const handleTrainModel = async (silent = false) => {
    if (!silent) setTraining(true);
    setError(null);
    try {
      const res = await apiFetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningRate, epochs })
      });

      const data = await res.json();
      if (res.ok) {
        setMetrics(data.metrics);
        if (!silent) {
          setSuccessMsg(`Model successfully trained on ${data.metrics.sampleCount} employee records!`);
          setTimeout(() => setSuccessMsg(null), 5000);
        }
      } else {
        setError(data.error || "Model training failed.");
      }
    } catch (err) {
      setError("Failed to communicate with Express training server on port 3000.");
    } finally {
      if (!silent) setTraining(false);
    }
  };

  const handlePredictRisk = async () => {
    setPredicting(true);
    setError(null);
    try {
      const inputs = {
        Age: age,
        YearsAtCompany: yearsAtCompany,
        WorkHoursPerWeek: workHours,
        RemoteWork: remoteWork === "Yes" ? 1.0 : (remoteWork === "Hybrid" ? 0.5 : 0.0),
        JobSatisfaction: jobSatisfaction,
        StressLevel: stressLevel,
        ProductivityScore: productivity,
        SleepHours: sleepHours,
        PhysicalActivityHrs: activityHrs,
        CommuteTime: commuteTime,
        HasMentalHealthSupport: hasMentalSupport === "Yes" ? 1.0 : 0.0,
        ManagerSupportScore: managerSupport,
        HasTherapyAccess: hasTherapy === "Yes" ? 1.0 : 0.0,
        MentalHealthDaysOff: mentalHealthDays,
        WorkLifeBalanceScore: workLifeBalance,
        TeamSize: teamSize,
        CareerGrowthScore: careerGrowth
      };

      const res = await apiFetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPrediction({
          riskScore: data.result.probability * 100,
          riskClass: data.result.riskLevel
        });
      } else {
        setError(data.error || "Risk prediction failed.");
      }
    } catch (err) {
      setError("Failed to obtain prediction from backend service.");
    } finally {
      setPredicting(false);
    }
  };

  const lossData = metrics?.lossHistory.map((loss, idx) => ({
    epoch: `Epoch ${Math.round((idx / (metrics.lossHistory.length - 1 || 1)) * metrics.epochs)}`,
    loss
  })) || [];

  return (
    <div id="ml-model-wrapper" className="space-y-8 pb-12">
      
      {/* SECTION 1: Banner Header */}
      <div className="bg-gradient-to-r from-teal-950/40 via-indigo-950/20 to-[#0e0e0e] border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl backdrop-blur-md">
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-teal-400" />
            Supervised Autonomic Learning
          </span>
          <h2 className="text-2xl font-serif italic text-white font-normal leading-tight">Logistic Regression Heuristics Trainer</h2>
          <p className="text-xs text-white/50 max-w-2xl leading-relaxed">
            Train a custom 17-dimensional Logistic Regression model on the diagnostic dataset you supplied. This model determines weights for each stressor and computes exact probability risks.
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1 font-mono text-xs self-start md:self-center">
          <div className="text-[9px] text-white/30 uppercase tracking-wider">Dataset Registry</div>
          <div className="text-white flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-teal-400" />
            <span>burnout_employees.csv</span>
          </div>
          <div className="text-white/40 text-[10px]">
            100 clinical records | 17 target attributes
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4 text-xs text-teal-400 flex items-center gap-2.5">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 1: Model Training Control Board (5 Cols) */}
        <div className="lg:col-span-5 space-y-8">
          
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <Settings2 className="w-5 h-5 text-teal-400" />
              <h3 className="font-serif italic text-white text-lg font-normal">Training Configuration</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/70 flex justify-between">
                  <span>Learning Rate (α)</span>
                  <span className="font-mono text-teal-400">{learningRate}</span>
                </label>
                <input 
                  type="range" 
                  min="0.01" 
                  max="0.5" 
                  step="0.01"
                  value={learningRate} 
                  onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer bg-white/5"
                />
                <span className="text-[10px] text-white/30 font-mono block">Controls step size during Gradient Descent parameter optimization.</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/70 flex justify-between">
                  <span>Gradient Descent Epochs</span>
                  <span className="font-mono text-teal-400">{epochs}</span>
                </label>
                <input 
                  type="range" 
                  min="100" 
                  max="3000" 
                  step="50"
                  value={epochs} 
                  onChange={(e) => setEpochs(parseInt(e.target.value, 10))}
                  className="w-full accent-teal-400 cursor-pointer bg-white/5"
                />
                <span className="text-[10px] text-white/30 font-mono block">Iterations over the dataset to minimize Binary Cross-Entropy Loss.</span>
              </div>

              <button
                type="button"
                onClick={() => handleTrainModel()}
                disabled={training}
                className="w-full py-3 bg-teal-400 hover:bg-teal-500 disabled:opacity-50 text-[#080808] font-bold text-xs rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Play className="w-4 h-4 fill-current" />
                {training ? "Fitting Coefficients..." : "Initiate Model Training"}
              </button>
            </div>
          </div>

          {/* Model Metrics Display */}
          {metrics && (
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-serif italic text-white text-lg font-normal">Performance Metrics</h3>
                </div>
                <span className="bg-teal-500/10 border border-teal-500/20 text-[10px] text-teal-400 px-2 py-0.5 rounded font-mono font-bold uppercase">
                  Trained
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Accuracy</span>
                  <span className="text-xl font-mono font-bold text-white">{(metrics.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">F1 Score</span>
                  <span className="text-xl font-mono font-bold text-teal-400">{(metrics.f1Score * 100).toFixed(1)}%</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Precision</span>
                  <span className="text-sm font-mono font-bold text-white/80">{(metrics.precision * 100).toFixed(1)}%</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Recall / Sens</span>
                  <span className="text-sm font-mono font-bold text-white/80">{(metrics.recall * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Loss Curve */}
              <div className="space-y-3 pt-2">
                <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  Loss Minimization Curve
                </span>
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lossData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="mlLossGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="epoch" stroke="rgba(255,255,255,0.2)" fontSize={8} fontFamily="monospace" tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={8} fontFamily="monospace" tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "10px", fontFamily: "monospace" }} 
                        labelStyle={{ color: "rgba(255,255,255,0.4)" }}
                      />
                      <Area type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#mlLossGrad)" name="BCE Loss" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* COLUMN 2: Predictor Form and Result Simulator (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5.5 h-5.5 text-teal-400" />
                <div>
                  <h3 className="font-serif italic text-white text-lg font-normal">Interactive Patient Profile</h3>
                  <p className="text-[10px] text-white/30 font-mono">Fill characteristics to evaluate with trained weights</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePredictRisk}
                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition duration-150 shadow-lg cursor-pointer flex items-center gap-1.5 uppercase tracking-wide"
              >
                <Activity className="w-3.5 h-3.5" />
                Evaluate Risk
              </button>
            </div>

            {/* Profile Forms grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Demographics & History */}
              <div className="space-y-4">
                <h4 className="text-[10px] text-teal-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> General Demographics
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Age (Years)</label>
                    <input 
                      type="number" 
                      value={age} 
                      onChange={(e) => setAge(parseInt(e.target.value) || 35)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Company Tenure</label>
                    <input 
                      type="number" 
                      value={yearsAtCompany} 
                      onChange={(e) => setYearsAtCompany(parseInt(e.target.value) || 5)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Work Hours/Week</label>
                    <input 
                      type="number" 
                      value={workHours} 
                      onChange={(e) => setWorkHours(parseInt(e.target.value) || 40)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Remote Status</label>
                    <select 
                      value={remoteWork} 
                      onChange={(e) => setRemoteWork(e.target.value)}
                      className="w-full bg-[#121212] border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                    >
                      <option value="No">On-Site (No)</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Yes">Full Remote (Yes)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Commute Time (Min)</label>
                    <input 
                      type="number" 
                      value={commuteTime} 
                      onChange={(e) => setCommuteTime(parseInt(e.target.value) || 30)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Team Size</label>
                    <input 
                      type="number" 
                      value={teamSize} 
                      onChange={(e) => setTeamSize(parseInt(e.target.value) || 8)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                <h4 className="text-[10px] text-teal-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 pt-2">
                  <Heart className="w-3.5 h-3.5" /> Sleep & Vitals
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Sleep Duration (Hrs)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      value={sleepHours} 
                      onChange={(e) => setSleepHours(parseFloat(e.target.value) || 7.0)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Activity (Hrs/Wk)</label>
                    <input 
                      type="number" 
                      value={activityHrs} 
                      onChange={(e) => setActivityHrs(parseInt(e.target.value) || 3)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

              </div>

              {/* Psychological & Satisfaction metrics */}
              <div className="space-y-4">
                <h4 className="text-[10px] text-teal-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5" /> Cognitive & Well-being
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/50 font-semibold">Job Satisfaction (1-10)</span>
                    <span className="font-mono text-white font-bold">{jobSatisfaction}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={jobSatisfaction} 
                    onChange={(e) => setJobSatisfaction(parseInt(e.target.value))}
                    className="w-full accent-teal-400 bg-white/5 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/50 font-semibold">Subjective Stress (1-10)</span>
                    <span className="font-mono text-white font-bold">{stressLevel}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={stressLevel} 
                    onChange={(e) => setStressLevel(parseInt(e.target.value))}
                    className="w-full accent-teal-400 bg-white/5 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/50 font-semibold">Work-Life Balance Score (1-10)</span>
                    <span className="font-mono text-white font-bold">{workLifeBalance}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={workLifeBalance} 
                    onChange={(e) => setWorkLifeBalance(parseInt(e.target.value))}
                    className="w-full accent-teal-400 bg-white/5 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/50 font-semibold">Manager Support Index (1-10)</span>
                    <span className="font-mono text-white font-bold">{managerSupport}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={managerSupport} 
                    onChange={(e) => setManagerSupport(parseInt(e.target.value))}
                    className="w-full accent-teal-400 bg-white/5 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Mental Health Support</label>
                    <select 
                      value={hasMentalSupport} 
                      onChange={(e) => setHasMentalHealthSupport(e.target.value)}
                      className="w-full bg-[#121212] border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Therapy Benefit Access</label>
                    <select 
                      value={hasTherapy} 
                      onChange={(e) => setHasTherapy(e.target.value)}
                      className="w-full bg-[#121212] border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Productivity (1-10)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10"
                      value={productivity} 
                      onChange={(e) => setProductivity(parseInt(e.target.value) || 5)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-semibold block">Mental Days Taken</label>
                    <input 
                      type="number" 
                      value={mentalHealthDays} 
                      onChange={(e) => setMentalHealthDaysOff(parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

              </div>

            </div>

            {/* Prediction Output Demonstration Panel */}
            {prediction && (
              <div className="mt-8 p-6 bg-white/5 border border-white/5 rounded-3xl grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-4 text-center space-y-1">
                  <span className="text-[9px] text-white/30 uppercase font-mono tracking-wider">Burnout Probability</span>
                  <div className={`text-4xl font-mono font-bold ${
                    prediction.riskScore >= 75 ? "text-red-400" : (prediction.riskScore >= 45 ? "text-amber-400" : "text-teal-400")
                  }`}>
                    {prediction.riskScore.toFixed(1)}%
                  </div>
                  <div className="pt-1">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      prediction.riskClass.includes("High") ? "bg-red-500/10 text-red-400" : (prediction.riskClass.includes("Moderate") ? "bg-amber-500/10 text-amber-400" : "bg-teal-500/10 text-teal-400")
                    }`}>
                      {prediction.riskClass}
                    </span>
                  </div>
                </div>

                <div className="md:col-span-8 space-y-2 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 text-xs text-white/70 leading-relaxed">
                  <h4 className="font-bold text-white leading-none">Diagnostic Explanation:</h4>
                  {prediction.riskScore >= 75 ? (
                    <p>
                      The machine learning model identifies a <strong className="text-red-400">High Risk Profile</strong>. The high stress level, paired with elevated work hours and minimal work-life balance scores, are contributing heavily to the diagnostic risk. Deferral to employer therapy benefits and mental health days off is strongly advised.
                    </p>
                  ) : (prediction.riskScore >= 45 ? (
                    <p>
                      The model identifies a <strong className="text-amber-400">Moderate Risk Profile</strong>. While biometric sleep scores remain within stable bounds, cumulative task load is outstripping personal rest margins. Proactive manager boundary alignments are recommended.
                    </p>
                  ) : (
                    <p>
                      The model identifies a <strong className="text-teal-400">Low Risk Profile</strong>. Your physiological sleep quality, low stress indexes, and solid work-life boundaries are successfully buffering you against burnout conditions. Maintain this autonomic balance!
                    </p>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* SECTION 3: Weights Visualization */}
      {metrics && (
        <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
          <div className="space-y-1">
            <h3 className="font-serif italic text-white text-lg font-normal">Logistic Regression Feature Coefficients</h3>
            <p className="text-xs text-white/40">
              Positive values increase burnout risk probability, while negative values protect against it.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(metrics.weights).map(([name, weight]) => {
              const w = weight as number;
              return (
                <div key={name} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-between h-20">
                  <span className="text-[10px] text-white/50 leading-tight font-medium line-clamp-1">{name}</span>
                  <div className="flex items-baseline justify-between gap-1 mt-2">
                    <span className={`text-base font-mono font-bold ${
                      w > 0 ? "text-red-400" : (w < 0 ? "text-teal-400" : "text-white/40")
                    }`}>
                      {w > 0 ? `+${w}` : w}
                    </span>
                    <span className="text-[9px] font-mono text-white/20 uppercase">coeff</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
