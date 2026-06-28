import React, { useState } from "react";
import { BookOpen, AlertCircle, HelpCircle, CheckCircle, RefreshCcw } from "lucide-react";

interface JournalEntryFormProps {
  text: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

const INSIGHT_PROMPTS = [
  "How did today's work load affect my body and mental space?",
  "Did I feel connected and motivated by my tasks today, or did they feel mechanical and distant?",
  "Did I manage to establish solid barriers for rest, or did work spill into personal hours?",
  "Describe any tension, tiredness, or feelings of accomplishment you had."
];

export default function JournalEntryForm({
  text,
  onChange,
  onSubmit,
  loading
}: JournalEntryFormProps) {
  const [activePromptIndex, setActivePromptIndex] = useState(0);

  const rotatePrompt = () => {
    setActivePromptIndex((prev) => (prev + 1) % INSIGHT_PROMPTS.length);
  };

  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  return (
    <div id="journal-form-container" className="bg-white/[0.03] rounded-3xl border border-white/10 p-6 md:p-8 backdrop-blur-md shadow-2xl h-full flex flex-col justify-between">
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-serif italic text-white font-normal tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Mindful Daily Journal
          </h2>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">
            Vent your physical exhaustion, emotional load, or cognitive blockades.
          </p>
        </div>

        {/* Dynamic prompt inspiration styled elegantly */}
        <div id="writing-prompt-box" className="bg-indigo-950/20 rounded-2xl border border-indigo-500/10 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Prompt Inspiration</span>
            </div>
            <button
              id="btn-rotate-prompt"
              type="button"
              onClick={rotatePrompt}
              className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition cursor-pointer"
              title="Next Prompt"
            >
              <RefreshCcw className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-white/80 leading-relaxed font-serif italic">
            "{INSIGHT_PROMPTS[activePromptIndex]}"
          </p>
        </div>

        {/* Text Area */}
        <div className="space-y-3">
          <textarea
            id="journal-input-textarea"
            rows={8}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Start writing... venting about deadlines, tiredness, relationships, accomplishments, or mental blocks helps Gemini predict burnout indicators precisely."
            className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white placeholder-white/35 focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition font-sans leading-relaxed"
          />
          <div className="flex justify-between items-center text-[10px] text-white/30 uppercase tracking-widest font-mono">
            <span>Minimum 20 words recommended.</span>
            <span className={`font-mono font-medium ${wordCount >= 20 ? "text-teal-400" : "text-white/30"}`}>
              {wordCount} words
            </span>
          </div>
        </div>

      </div>

      <div className="pt-6 border-t border-white/5 mt-6">
        <button
          id="btn-submit-daily-analysis"
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl tracking-wider uppercase transition focus:ring-1 focus:ring-teal-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Analyzing biomarkers & sentiment...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 text-teal-300" />
              <span>Evaluate Aura Intelligence</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

