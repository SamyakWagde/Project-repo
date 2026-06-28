import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Sparkles, Smile, Bot, Shield, ArrowRight } from "lucide-react";
import { ChatMessage, DailyLog } from "../types";
import { apiFetch } from "../utils/api";

interface AIChatBotProps {
  latestLog: DailyLog | null;
}

const CHAT_PROMPT_SUGGESTIONS = [
  "Stress is high. Teach me a somatic breathing drill.",
  "Help me draft a polite boundary email to my manager.",
  "I slept poorly and feel guilty taking a break today.",
  "What do low heart rate variability (HRV) levels mean physically?"
];

export default function AIChatBot({ latestLog }: AIChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-assistant-msg",
      sender: "assistant",
      text: "Hello, I am your wellness assistant. Drawing on cognitive-behavioral principles and stress physiology, I can help you reframe thoughts and craft calming biological recovery routines. How are you holding up right now?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-msg-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          latestLog: latestLog
        })
      });

      const data = await response.json();

      if (response.ok && data.text) {
        const assistantMsg: ChatMessage = {
          id: `assistant-msg-${Date.now()}`,
          sender: "assistant",
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `error-msg-${Date.now()}`,
          sender: "assistant",
          text: `I couldn't establish a mental model. ${data.details || data.error || "Please verify your Gemini configuration."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-msg-${Date.now()}`,
        sender: "assistant",
        text: "My neural relays timed out. Please check that the server is running on port 3000.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  return (
    <div id="ai-chatbot-wrapper" className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)] min-h-[500px]">
      
      {/* Messages Column (Left 2 columns on lg) */}
      <div className="lg:col-span-2 flex flex-col h-full bg-[#111111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        
        {/* Chat Header */}
        <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                Aura Guide
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-teal-500/10 text-teal-400 font-mono tracking-widest uppercase">
                  <Sparkles className="w-2 h-2" /> Context-Aware
                </span>
              </div>
              <p className="text-[11px] text-white/40 uppercase tracking-wider">Empathetic cognitive & biological restoration coach</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-white/35 font-mono tracking-widest">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            AES-256
          </div>
        </div>

        {/* Message Panel */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-black/20">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                id={`chat-msg-${msg.id}`}
                className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-teal-400 font-serif italic text-xs flex-shrink-0">
                    A
                  </div>
                )}
                <div className="space-y-1">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? "bg-indigo-600/20 border border-indigo-500/30 text-white/90"
                        : "bg-white/5 border border-white/10 text-white/80"
                    }`}
                  >
                    {msg.text.split("\n\n").map((paragraph, pIdx) => (
                      <p key={pIdx} className={pIdx > 0 ? "mt-2" : ""}>
                        {paragraph.split("\n").map((line, lIdx) => (
                          <React.Fragment key={lIdx}>
                            {line}
                            {lIdx < paragraph.split("\n").length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </p>
                    ))}
                  </div>
                  <span className={`text-[9px] font-mono text-white/20 block px-1 ${isUser ? "text-right" : "text-left"}`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}
          
          {loading && (
            <div className="flex gap-3 max-w-[85%] mr-auto">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-teal-400 font-serif italic text-xs flex-shrink-0 animate-pulse">
                A
              </div>
              <div className="bg-white/5 border border-white/10 text-white/40 rounded-2xl px-4 py-3 text-sm shadow-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                <span className="italic text-xs text-white/30 ml-1">Absorbing biometric curves...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Controls */}
        <form onSubmit={handleFormSubmit} className="p-4 bg-white/[0.01] border-t border-white/5">
          <div className="relative flex items-center">
            <input
              id="chat-input-field"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={loading ? "Waiting for response..." : "Ask for a boundary script, somatic reset, or reframe..."}
              disabled={loading}
              className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition"
            />
            <button
              id="btn-chat-send"
              type="submit"
              disabled={loading || !inputText.trim()}
              className="absolute right-2 p-2 bg-white/10 hover:bg-teal-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

      </div>

      {/* Context Sidebar (Right 1 column on lg) */}
      <div className="space-y-6 flex flex-col h-full lg:overflow-y-auto">
        
        {/* Helper Context Panel */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-teal-400" />
            Active Bio-Memory
          </h3>
          {latestLog ? (
            <div id="active-bio-memory-data" className="space-y-4">
              <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl">
                <div className="text-[9px] text-teal-400 font-mono uppercase tracking-widest">Latest Burnout Risk</div>
                <div className="font-sans font-bold text-white text-lg mt-0.5">{latestLog.analysis?.burnoutRiskScore ?? 0} / 100</div>
                <div className="text-xs text-teal-400 font-medium font-serif italic mt-0.5">{latestLog.analysis?.predictorClass ?? "Calculating..."}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[9px] text-white/35 uppercase tracking-wider font-semibold font-mono">HRV</div>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">{latestLog.biometrics.hrv} ms</div>
                </div>
                <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[9px] text-white/35 uppercase tracking-wider font-semibold font-mono">Resting HR</div>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">{latestLog.biometrics.restingHR} bpm</div>
                </div>
                <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[9px] text-white/35 uppercase tracking-wider font-semibold font-mono">Sleep</div>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">{latestLog.biometrics.sleepHours} hrs</div>
                </div>
                <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[9px] text-white/35 uppercase tracking-wider font-semibold font-mono">Sentiment</div>
                  <div className="font-serif text-sm font-bold text-teal-400 mt-0.5 italic">{latestLog.analysis?.sentimentAnalysis?.primaryEmotion ?? "None"}</div>
                </div>
              </div>
              <p className="text-[10px] text-white/20 mt-2 leading-relaxed font-mono">
                Your parameters are processed server-side alongside this bio-memory logs.
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <Smile className="w-8 h-8 mx-auto text-white/20" />
              <p className="text-xs text-white/40 mt-2 font-medium">No diagnostic history logged yet.</p>
              <p className="text-[10px] text-white/25 mt-1 font-mono">Log a journal entry and biometrics to provide context memory.</p>
            </div>
          )}
        </div>

        {/* Prompt triggers list */}
        <div id="ai-quick-prompts-container" className="flex-1 bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Suggested Triggers
            </h3>
            <div className="space-y-2">
              {CHAT_PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  id={`quick-prompt-btn-${idx}`}
                  type="button"
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={loading}
                  className="w-full text-left p-3 border border-white/5 rounded-xl bg-white/[0.01] hover:bg-white/5 hover:border-white/15 text-xs text-white/60 hover:text-white transition leading-relaxed flex items-center justify-between group cursor-pointer"
                >
                  <span className="pr-4">{suggestion}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-teal-400 flex-shrink-0 transition" />
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-white/5 mt-4 text-[10px] text-white/25 leading-normal italic font-serif">
            "Your companion translates stress parameters directly into biological recovery scripts."
          </div>
        </div>

      </div>

    </div>
  );
}

