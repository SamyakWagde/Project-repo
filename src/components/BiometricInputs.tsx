import React from "react";
import { WearableBiometrics } from "../types";
import { Heart, Moon, Footprints, Info, Sparkles } from "lucide-react";

interface BiometricInputsProps {
  biometrics: WearableBiometrics;
  onChange: (biometrics: WearableBiometrics) => void;
  onSyncMockWearable: () => void;
  syncing: boolean;
}

export default function BiometricInputs({
  biometrics,
  onChange,
  onSyncMockWearable,
  syncing
}: BiometricInputsProps) {
  
  const updateField = (key: keyof WearableBiometrics, val: number) => {
    onChange({
      ...biometrics,
      [key]: val
    });
  };

  // Autonomic nervous state helper descriptions redesigned with sleek premium dark colors
  const getHRVStatus = (val: number) => {
    if (val < 30) return { label: "Severe Stress / Low Vagal Tone", color: "text-red-400 bg-red-950/30 border border-red-900/40" };
    if (val < 55) return { label: "Moderate Stress / Autonomic Balance Strained", color: "text-amber-400 bg-amber-950/30 border border-amber-900/40" };
    return { label: "Optimal Recovery / Strong Parasympathetic Active", color: "text-teal-400 bg-teal-950/30 border border-teal-900/40" };
  };

  const getRHRStatus = (val: number) => {
    if (val > 80) return { label: "Elevated / Physiological Strain Active", color: "text-red-400 bg-red-950/30 border border-red-900/40" };
    if (val > 70) return { label: "Elevated Baseline", color: "text-amber-400 bg-amber-950/30 border border-amber-900/40" };
    return { label: "Healthy Resting Baseline", color: "text-teal-400 bg-teal-950/30 border border-teal-900/40" };
  };

  const getSleepStatus = (hours: number, quality: number) => {
    if (hours < 6) return { label: "Acute Sleep Deficit", color: "text-red-400 bg-red-950/30 border border-red-900/40" };
    if (quality < 65) return { label: "Fragmented Rest", color: "text-amber-400 bg-amber-950/30 border border-amber-900/40" };
    return { label: "Restorative Rest", color: "text-teal-400 bg-teal-950/30 border border-teal-900/40" };
  };

  const hrvStatus = getHRVStatus(biometrics.hrv);
  const rhrStatus = getRHRStatus(biometrics.restingHR);
  const sleepStatus = getSleepStatus(biometrics.sleepHours, biometrics.sleepQuality);

  return (
    <div id="biometric-inputs-container" className="bg-white/[0.03] rounded-3xl border border-white/10 p-6 md:p-8 backdrop-blur-md shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-serif italic text-white font-normal tracking-tight flex items-center gap-2">
            <Heart className="w-5 h-5 text-teal-400" />
            Physiological Wearable Biometrics
          </h2>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">
            Replicate biometric logs from Garmin, Oura, Fitbit or Watch OS.
          </p>
        </div>
        
        <button
          id="btn-sync-wearable"
          type="button"
          onClick={onSyncMockWearable}
          disabled={syncing}
          className="relative inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-teal-400 font-medium text-xs rounded-xl border border-white/10 transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-teal-400 group-hover:scale-110 transition-transform" />
          {syncing ? "Syncing..." : "Auto-Sync Garmin"}
        </button>
      </div>

      <div className="space-y-8">
        
        {/* HRV Input */}
        <div id="input-group-hrv" className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white/60 tracking-wider uppercase flex items-center gap-1.5">
              <span>Heart Rate Variability (HRV)</span>
              <span className="text-xs font-mono font-medium text-white/30 capitalize normal-case">(ms)</span>
            </label>
            <span className="font-mono text-lg font-bold text-white">{biometrics.hrv} <span className="text-xs font-medium text-teal-400">ms</span></span>
          </div>
          <input
            id="slider-hrv"
            type="range"
            min="10"
            max="120"
            value={biometrics.hrv}
            onChange={(e) => updateField("hrv", parseInt(e.target.value))}
            className="w-full h-[3px] bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] font-mono text-white/30">
            <span>Strained & Depleted (10 ms)</span>
            <span>Optimized Base (120 ms)</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${hrvStatus.color}`}>
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{hrvStatus.label}</span>
          </div>
        </div>

        {/* Resting Heart Rate Input */}
        <div id="input-group-rhr" className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white/60 tracking-wider uppercase flex items-center gap-1.5">
              <span>Resting Heart Rate (RHR)</span>
              <span className="text-xs font-mono font-medium text-white/30 capitalize normal-case">(bpm)</span>
            </label>
            <span className="font-mono text-lg font-bold text-white">{biometrics.restingHR} <span className="text-xs font-medium text-indigo-400">bpm</span></span>
          </div>
          <input
            id="slider-rhr"
            type="range"
            min="40"
            max="110"
            value={biometrics.restingHR}
            onChange={(e) => updateField("restingHR", parseInt(e.target.value))}
            className="w-full h-[3px] bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] font-mono text-white/30">
            <span>Athletic Rest Only (40 bpm)</span>
            <span>Elevated Stress (110 bpm)</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${rhrStatus.color}`}>
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{rhrStatus.label}</span>
          </div>
        </div>

        {/* Sleep Metrics Double Grid */}
        <div id="input-group-sleep" className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/60 tracking-wider uppercase flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-teal-400" />
                <span>Sleep duration</span>
              </label>
              <span className="font-mono text-sm font-bold text-white">{biometrics.sleepHours} <span className="text-xs font-medium text-white/40">hrs</span></span>
            </div>
            <input
              id="slider-sleep-hours"
              type="range"
              min="3"
              step="0.1"
              max="12"
              value={biometrics.sleepHours}
              onChange={(e) => updateField("sleepHours", parseFloat(e.target.value))}
              className="w-full h-[3px] bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] font-mono text-white/30">
              <span>Deficit (3h)</span>
              <span>Extended (12h)</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/60 tracking-wider uppercase flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sleep Quality Score</span>
              </label>
              <span className="font-mono text-sm font-bold text-white">{biometrics.sleepQuality}%</span>
            </div>
            <input
              id="slider-sleep-quality"
              type="range"
              min="20"
              max="100"
              value={biometrics.sleepQuality}
              onChange={(e) => updateField("sleepQuality", parseInt(e.target.value))}
              className="w-full h-[3px] bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] font-mono text-white/30">
              <span>Restless (20%)</span>
              <span>Perfect (100%)</span>
            </div>
          </div>
        </div>

        {/* Sleep feedback badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${sleepStatus.color}`}>
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{sleepStatus.label}</span>
        </div>

        {/* Daily Steps */}
        <div id="input-group-steps" className="space-y-3 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white/60 tracking-wider uppercase flex items-center gap-1.5">
              <Footprints className="w-3.5 h-3.5 text-teal-400" />
              <span>Physical Activity (Steps)</span>
            </label>
            <span className="font-mono text-sm font-bold text-white">{biometrics.steps.toLocaleString()} <span className="text-xs font-medium text-white/40">steps</span></span>
          </div>
          <input
            id="slider-steps"
            type="range"
            min="0"
            max="25000"
            step="100"
            value={biometrics.steps}
            onChange={(e) => updateField("steps", parseInt(e.target.value))}
            className="w-full h-[3px] bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] font-mono text-white/30">
            <span>Sedentary</span>
            <span>25k Steps</span>
          </div>
        </div>

      </div>
    </div>
  );
}

