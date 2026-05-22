"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, MessageSquare, Briefcase, Play, Send, Award, CheckCircle, 
  Loader2, ArrowRight, RefreshCw, Volume2, VolumeX, Mic, MicOff, 
  Settings, Target, Activity, ShieldAlert, Cpu, Terminal, ChevronRight
} from "lucide-react";

interface Message {
  role: "interviewer" | "candidate";
  text: string;
}

interface EvaluationMatrix {
  communication_score: number;
  technical_score: number;
  problem_solving_score: number;
  justification: string;
}

export default function MockInterviewDashboard() {
  // Config Setup States
  const [role, setRole] = useState("Frontend Engineer Intern");
  const [focus, setFocus] = useState("mixed");
  const [background, setBackground] = useState("");
  
  // Orchestration & UX Tracking States
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [turns, setTurns] = useState(0);
  
  // Multi-Agent Completion Feedback Payload States
  const [isFinished, setIsFinished] = useState(false);
  const [matrix, setMatrix] = useState<EvaluationMatrix | null>(null);
  const [feedbackMarkdown, setFeedbackMarkdown] = useState("");

  // Voice Interaction Configuration States
  const [speakEnabled, setSpeakEnabled] = useState<boolean>(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  
  // Voice Input Transcription States
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto Scroll Chat Timeline to Bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load and populate available native TTS voices dynamically
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        const englishVoices = allVoices.filter(v => v.lang.startsWith("en"));
        setVoices(englishVoices.length > 0 ? englishVoices : allVoices);
        
        if (!selectedVoiceName && allVoices.length > 0) {
          const preferred = allVoices.find(v => v.name.includes("Google US English") || v.name.includes("Natural") || v.name.includes("David") || v.name.includes("Zira"));
          setSelectedVoiceName(preferred ? preferred.name : allVoices[0].name);
        }
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceName]);

  // Initialize browser SpeechRecognition API client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";
        
        rec.onstart = () => {
          setIsListening(true);
        };
        
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput((prev) => {
              const base = prev.trim();
              return base ? `${base} ${transcript.trim()}` : transcript.trim();
            });
          }
        };
        
        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };
        
        rec.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = rec;
      }
    }
  }, []);

  // Text-To-Speech execution helper
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !speakEnabled) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voices.length > 0) {
      const voiceObj = voices.find(v => v.name === selectedVoiceName);
      if (voiceObj) {
        utterance.voice = voiceObj;
      }
    }
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  };

  // Toggle Speech Input recording state
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use a modern browser like Google Chrome or Microsoft Edge.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      recognitionRef.current.start();
    }
  };

  // Command Backend to spin up core agent configurations
  const handleStartSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, focus, background }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages([{ role: "interviewer", text: data.text }]);
        setIsStarted(true);
        setTimeout(() => speakText(data.text), 200);
      } else {
        alert("Backend Engine Error: " + data.detail);
      }
    } catch (err) {
      alert("Could not link to backend routing server. Did you start main.py?");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Candidate response to processing loop
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const userMessage: Message = { role: "candidate", text: input };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput("");
    setTurns((prev) => prev + 1);
    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          focus,
          background,
          messages: updatedMessages,
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        if (data.finished) {
          setIsFinished(true);
          setMatrix(data.matrix);
          setFeedbackMarkdown(data.feedback_markdown);
          setTimeout(() => speakText("Your interview evaluation is complete. Let's review the coach's feedback report!"), 200);
        } else {
          setMessages([...updatedMessages, { role: "interviewer", text: data.text }]);
          setTimeout(() => speakText(data.text), 200);
        }
      } else {
        alert("Processing Node Exception: " + data.detail);
      }
    } catch (err) {
      alert("Lost connectivity during evaluation routing step.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsStarted(false);
    setIsFinished(false);
    setMessages([]);
    setTurns(0);
    setMatrix(null);
    setFeedbackMarkdown("");
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-sans p-4 lg:p-6 relative overflow-x-hidden selection:bg-blue-500/20">
      
      {/* Neo-Aura Cyber Glowing Atmospheric Backgrounds */}
      <div className="absolute top-[-25%] left-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-blue-600/15 to-transparent rounded-full blur-[160px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-tl from-indigo-500/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Structural App Layout */}
      <div className="max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-2rem)] min-h-[750px]">
        
        {/* Navigation & Status Header */}
        <header className="flex justify-between items-center border-b border-slate-800/60 pb-4 mb-5 backdrop-blur-md relative z-20">
          <div className="flex items-center gap-3 group">
            <div className="p-2.5 bg-blue-950/40 border border-blue-500/30 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all group-hover:border-blue-500/60 group-hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]">
              <Sparkles className="w-5 h-5 text-blue-400 transition-transform duration-500 group-hover:rotate-12" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center">
                prep<span className="text-blue-400 font-mono font-semibold text-lg bg-blue-500/10 px-1.5 py-0.5 rounded-md ml-0.5 border border-blue-500/10">.ai</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Autonomous Simulation Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs border border-slate-800 bg-slate-900/40 px-3.5 py-2 rounded-xl backdrop-blur-md flex items-center gap-2.5 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStarted ? "bg-blue-400" : "bg-amber-400"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isStarted ? "bg-blue-500" : "bg-amber-500"}`} />
              </span>
              <span className="text-slate-400 font-medium">State:</span> 
              <span className="text-slate-200 font-mono font-semibold">{isFinished ? "Session Finished" : isStarted ? "Agent Loop Engaged" : "Calibration Mode"}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Workstation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch overflow-hidden relative z-10">
          
          {/* Dashboard Left Rail: Configuration & Environment Settings */}
          <section className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-1">
            
            {/* Main Config Terminal Block */}
            <div className="bg-slate-900/20 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl hover:border-slate-800 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 mb-4">
                  <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                    <Target className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">Simulation Alignment</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-medium">Target Vocation Role</label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        disabled={isStarted}
                        value={role} 
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-medium">Evaluation Focus Domain</label>
                    <select 
                      disabled={isStarted}
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed appearance-none cursor-pointer"
                    >
                      <option value="technical">Technical Architecture & Engineering</option>
                      <option value="behavioral">Behavioral Evaluation (STAR Competencies)</option>
                      <option value="mixed">Comprehensive Balanced Evaluation Matrix</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-medium">Background Metadata / Resume Digest</label>
                    <textarea 
                      disabled={isStarted}
                      rows={isStarted ? 3 : 5}
                      placeholder="Inject performance constraints, complex project notes or personal experience profiles here to contextualize the agent framework..."
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-2">
                {!isStarted ? (
                  <button 
                    onClick={handleStartSession}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:bg-slate-900 disabled:text-slate-600 font-medium text-sm py-3 px-4 rounded-xl shadow-[0_4px_20px_rgba(59,130,246,0.15)] hover:shadow-[0_4px_25px_rgba(59,130,246,0.3)] transition-all flex items-center justify-center gap-2 text-white"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current text-white/90" />}
                    Initialize Agent Interview Loop
                  </button>
                ) : (
                  <button 
                    onClick={handleResetSession}
                    className="w-full border border-slate-800 bg-slate-950/20 hover:bg-red-950/10 hover:border-red-900/50 font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-red-400"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Terminate Active Session
                  </button>
                )}
              </div>
            </div>

            {/* Live Metrics Telemetry Panel */}
            <div className="bg-slate-900/20 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">Telemetry Streaming</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 shadow-inner">
                  <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wider">Conversation Index</p>
                  <p className="text-xl font-bold mt-1 text-blue-400 font-mono">
                    {turns} <span className="text-xs text-slate-600 font-sans font-normal">/ 5 turns</span>
                  </p>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(turns / 5) * 100}%` }} />
                  </div>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 shadow-inner flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wider">Node Cluster</p>
                    <p className="text-xs font-semibold mt-1.5 text-slate-300 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Multi-Agent Engine
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono mt-1 block">orchestrator.v2.py</span>
                </div>
              </div>

              {/* Enhanced Speech Customizer Subcard */}
              <div className="border-t border-slate-800/60 pt-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-slate-400 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-blue-400" /> TTS Audio Matrix
                  </h4>
                  <button
                    onClick={() => {
                      const next = !speakEnabled;
                      setSpeakEnabled(next);
                      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                      }
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 outline-none ${speakEnabled ? "bg-blue-600" : "bg-slate-800"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${speakEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
                
                {speakEnabled && voices.length > 0 && (
                  <div className="space-y-2.5 animate-fadeIn duration-300">
                    <div>
                      <select
                        value={selectedVoiceName}
                        onChange={(e) => setSelectedVoiceName(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-900 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/40"
                      >
                        {voices.map((voice, idx) => (
                          <option key={idx} value={voice.name}>
                            {voice.name.replace("Google", "").trim()} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1 text-[10px]">
                        <span className="text-slate-500">Audio Stream Velocity</span>
                        <span className="text-blue-400 font-mono font-bold">{speechRate.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.4"
                        step="0.1"
                        value={speechRate}
                        onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Dashboard Right Column: Main Interaction Arena */}
          <section className="lg:col-span-8 flex flex-col overflow-hidden h-full border border-slate-800/50 rounded-2xl bg-slate-900/10 backdrop-blur-md shadow-2xl">
            
            {!isStarted ? (
              /* Empty Welcome State Overlay */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.04),transparent_60%)]" />
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl mb-4 text-slate-600 shadow-xl relative z-10">
                  <Terminal className="w-8 h-8 text-blue-500/70" />
                </div>
                <h3 className="text-base font-semibold text-slate-300 relative z-10">Execution Framework Grounded</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed relative z-10">
                  Adjust target matrix options on the left-side panel configuration deck. Activating the loop creates a real-time agent system simulation.
                </p>
                <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-600 font-mono bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-900">
                  <span>Awaiting system_init call</span>
                  <span className="w-1.5 h-3 bg-slate-700 animate-pulse" />
                </div>
              </div>
            ) : isFinished ? (
              
              /* Evaluation Matrix / Post-Interview Report View */
              <div className="flex-1 p-5 lg:p-7 overflow-y-auto space-y-6">
                
                {/* Score Header Meta Block */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-5 gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                      <Award className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">Performance Matrix Decoupled</h3>
                      <p className="text-xs text-slate-400">Synthesized report issued by Multi-Agent Evaluator cluster</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleResetSession}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-lg transition-all self-start sm:self-auto"
                  >
                    Run New Simulation <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Score Matrix Grid Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Communication Architecture", score: matrix?.communication_score, color: "text-emerald-400" },
                    { label: "Technical Precision & Depth", score: matrix?.technical_score, color: "text-blue-400" },
                    { label: "Adaptive Problem Solving", score: matrix?.problem_solving_score, color: "text-indigo-400" }
                  ].map((item, index) => (
                    <div key={index} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl relative overflow-hidden group hover:border-slate-700 transition-all">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/40" />
                      <p className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">{item.label}</p>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className={`text-3xl font-black font-mono tracking-tight ${item.color}`}>{item.score ?? 0}</span>
                        <span className="text-xs text-slate-600 font-semibold">/ 10</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Justification Memo Box */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4.5 text-xs text-slate-300 leading-relaxed shadow-inner">
                  <div className="flex items-center gap-2 text-white font-semibold text-[11px] uppercase tracking-wider mb-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Executive Evaluation Core Summary
                  </div>
                  <p className="italic text-slate-400">"{matrix?.justification}"</p>
                </div>

                {/* Main Dynamic Text Markdown Container */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 lg:p-6 text-sm text-slate-300 shadow-xl relative">
                  <div className="text-blue-400 font-bold tracking-widest text-[11px] uppercase flex items-center gap-2 mb-4 border-b border-slate-900 pb-3">
                    <CheckCircle className="w-4 h-4" /> Customized Remediation & Training Guide
                  </div>
                  <div className="whitespace-pre-line leading-relaxed text-slate-300 font-sans space-y-2">
                    {feedbackMarkdown}
                  </div>
                </div>
              </div>
            ) : (
              
              /* Real-time Streaming Live Chat Arena */
              <div className="flex-1 flex flex-col overflow-hidden h-full">
                
                {/* Active Chat Timeline Frame */}
                <div className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-5 bg-gradient-to-b from-transparent to-slate-950/20">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"} animate-fadeIn`}>
                      <div className={`max-w-[80%] rounded-2xl px-4.5 py-3.5 text-sm leading-relaxed border transition-all ${
                        msg.role === "candidate" 
                          ? "bg-blue-600/10 border-blue-500/30 text-slate-100 rounded-tr-none shadow-[0_4px_15px_rgba(59,130,246,0.05)]" 
                          : "bg-slate-950/80 border-slate-800/80 text-slate-200 rounded-tl-none shadow-md"
                      }`}>
                        <p className={`text-[9px] font-bold tracking-widest uppercase mb-1.5 font-mono opacity-50 ${
                          msg.role === "candidate" ? "text-blue-400 text-right" : "text-slate-400"
                        }`}>
                          {msg.role === "candidate" ? "Candidate Input" : "Interviewer Agent Stack"}
                        </p>
                        <p className="whitespace-pre-wrap text-slate-200 selection:bg-blue-500/40">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Streaming Loading/Thinking Node Indicator */}
                  {isLoading && (
                    <div className="flex justify-start animate-pulse">
                      <div className="bg-slate-950/50 border border-slate-900 rounded-2xl px-4.5 py-3.5 flex items-center gap-3 text-xs text-slate-400 shadow-md">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        <span className="font-mono text-[11px] tracking-wide">Syncing runtime weights & processing logs...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Entry Input Control Dock */}
                <div className="p-4 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-md flex flex-col gap-3 relative z-10">
                  
                  {/* Listening Aura Soundwaves Banner */}
                  {isListening && (
                    <div className="flex items-center gap-3 px-3.5 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl self-start shadow-inner">
                      <div className="flex items-center gap-0.5 h-3 w-5">
                        <div className="w-0.5 bg-blue-400 rounded-full h-full animate-audio-bar-1" />
                        <div className="w-0.5 bg-blue-400 rounded-full h-full animate-audio-bar-2" />
                        <div className="w-0.5 bg-blue-400 rounded-full h-full animate-audio-bar-3" />
                        <div className="w-0.5 bg-blue-400 rounded-full h-full animate-audio-bar-4" />
                      </div>
                      <span className="text-[10px] text-blue-400 font-mono tracking-wider font-semibold uppercase">Microphone Pipeline Hot — Dictate Cleanly</span>
                    </div>
                  )}

                  <div className="flex gap-3 items-center">
                    <button 
                      onClick={toggleListening}
                      disabled={isLoading}
                      className={`p-3.5 rounded-xl transition-all flex items-center justify-center border duration-300 outline-none ${
                        isListening 
                          ? "bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.25)] scale-[1.03]" 
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 active:scale-95"
                      }`}
                      title={isListening ? "Halt voice interface stream" : "Engage speech dictation input channel"}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 relative flex items-center">
                      <input 
                        type="text" 
                        disabled={isLoading}
                        placeholder={turns >= 5 ? "Turn parameters concluded. Dispatch response to compute evaluation payload..." : isListening ? "Transcribing runtime audio stream..." : "Type clear architectural or contextual response here..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10 transition-all text-slate-200 placeholder-slate-500 disabled:opacity-40"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 disabled:text-slate-700 text-white rounded-lg transition-all flex items-center justify-center active:scale-95 shadow-md"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}