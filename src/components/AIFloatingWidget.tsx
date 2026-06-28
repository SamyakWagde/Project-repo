import React, { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  X, 
  Bot, 
  ChevronDown, 
  ArrowRight,
  Maximize2,
  Minimize2
} from "lucide-react";
import { ChatMessage, DailyLog } from "../types";
import { apiFetch } from "../utils/api";

interface AIFloatingWidgetProps {
  latestLog: DailyLog | null;
  onNavigateToTab: (tab: "evaluation" | "dashboard" | "chat") => void;
}

const WIDGET_SUGGESTIONS = [
  "Stress is high. Teach me a somatic breathing drill.",
  "Quick boundary email draft to my manager.",
  "What does low HRV mean?",
  "I'm feeling anxious about a deadline."
];

export default function AIFloatingWidget({ latestLog, onNavigateToTab }: AIFloatingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-floater-msg",
      sender: "assistant",
      text: "Hello! I am your 1-on-1 AI Assistant. I have read your workspace vitals. Ask me for boundary scripts, somatic exercises, or cognitive reframing techniques.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  // Track unread messages when widget is closed
  const prevMessagesCountRef = useRef(messages.length);

  useEffect(() => {
    if (!isOpen && messages.length > prevMessagesCountRef.current) {
      setUnreadCount((prev) => prev + (messages.length - prevMessagesCountRef.current));
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `float-user-${Date.now()}`,
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
          id: `float-assistant-${Date.now()}`,
          sender: "assistant",
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `float-error-${Date.now()}`,
          sender: "assistant",
          text: `Unable to process state. ${data.details || "Check server logs."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `float-error-sys-${Date.now()}`,
        sender: "assistant",
        text: "Relay timeout. Please ensure Express backend is connected.",
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

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  return (
    <div id="ai-floating-portal" className="fixed bottom-6 right-6 z-[80] hidden sm:block font-sans">
      
      {/* Floating Button Bubble */}
      {!isOpen && (
        <button
          id="btn-ai-portal-bubble"
          type="button"
          onClick={handleToggle}
          className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white rounded-full shadow-[0_8px_32px_rgba(20,184,166,0.3)] border border-white/10 active:scale-95 transition-all duration-200 cursor-pointer"
          title="Open AI Companion Portal"
        >
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#080808] animate-bounce">
              {unreadCount}
            </span>
          )}
          <Bot className="w-6 h-6 transform group-hover:rotate-12 transition-transform duration-200" />
          
          {/* Tooltip hint on hover */}
          <div className="absolute right-16 bg-[#121212] border border-white/10 px-3 py-1.5 rounded-xl text-xs text-white/95 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
            <span>AI Care Assistant 1-to-1</span>
          </div>
        </button>
      )}

      {/* Expanded Floating Chat Panel */}
      {isOpen && (
        <div 
          id="floating-chat-container" 
          className="flex flex-col w-96 max-h-[540px] h-[500px] bg-[#111111] border border-white/15 rounded-3xl shadow-[0_12px_48px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          {/* Chat Panel Header */}
          <div className="px-5 py-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Bot className="w-4 h-4 text-teal-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  Aura Companion Portal
                </h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">1-to-1 Instant Session</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                id="btn-portal-maximize"
                type="button"
                onClick={() => {
                  onNavigateToTab("chat");
                  setIsOpen(false);
                }}
                className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition"
                title="Full Screen Mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                id="btn-portal-minimize"
                type="button"
                onClick={handleToggle}
                className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Bio Status banner */}
          {latestLog && (
            <div className="bg-teal-500/[0.03] border-b border-white/5 px-4 py-2 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-white/50">
                <Sparkles className="w-3 h-3 text-teal-400" />
                <span>Risk Status:</span>
                <span className="font-semibold text-teal-400">{latestLog.analysis?.predictorClass ?? "Log Pending"}</span>
              </div>
              <span className="font-mono text-[9px] text-white/30">HRV: {latestLog.biometrics.hrv}ms</span>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-black/10">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div className="space-y-1">
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        isUser
                          ? "bg-indigo-600/20 border border-indigo-500/25 text-white"
                          : "bg-white/5 border border-white/10 text-white/80"
                      }`}
                    >
                      {msg.text.split("\n\n").map((paragraph, pIdx) => (
                        <p key={pIdx} className={pIdx > 0 ? "mt-1.5" : ""}>
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    <span className={`text-[8px] font-mono text-white/20 block px-1 ${isUser ? "text-right" : "text-left"}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2 max-w-[85%] mr-auto">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Micro suggestions when messages catalog is short */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 bg-black/20 border-t border-white/5 space-y-1">
              <span className="text-[9px] uppercase font-bold text-white/30 font-mono tracking-widest block mb-1">Suggested prompts:</span>
              <div className="flex flex-wrap gap-1.5">
                {WIDGET_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(suggestion)}
                    className="text-[10px] bg-white/5 border border-white/5 hover:bg-white/10 px-2 py-1 text-white/70 rounded-lg text-left transition text-ellipsis overflow-hidden whitespace-nowrap max-w-full cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Input Box */}
          <form onSubmit={handleFormSubmit} className="p-3 bg-[#0d0d0d] border-t border-white/5">
            <div className="relative flex items-center">
              <input
                id="portal-input-field"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={loading ? "Analyzing..." : "Ask your assistant..."}
                disabled={loading}
                className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-teal-400 transition"
              />
              <button
                id="btn-portal-send"
                type="submit"
                disabled={loading || !inputText.trim()}
                className="absolute right-1.5 p-1.5 bg-white/5 hover:bg-teal-500 text-teal-400 hover:text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

        </div>
      )}

    </div>
  );
}
