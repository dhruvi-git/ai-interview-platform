"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, MessageSquare, Briefcase, FileText, Play, Send, Award, CheckCircle, Loader2, ArrowRight, RefreshCw, Volume2, VolumeX, Mic, MicOff, Settings } from "lucide-react";

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
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans p-4 md:p-6 relative overflow-hidden">
      {/* Cinematic Glassmorphism Blurred Ambient Glow Vectors */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Container Header */}
      <header className="max-w-7xl mx-auto mb-6 flex justify-between items-center relative z-10 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
            G.TAKE <span className="text-blue-400 text-xs font-mono ml-1 font-normal">// DRILL COACH</span>
          </h1>
        </div>
        <div className="text-xs text-slate-400 border border-slate-800 bg-slate-900/30 px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isStarted ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          Engine: <span className="text-slate-200 font-mono">{isFinished ? "Idle" : isStarted ? "Active Session" : "Config State"}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Column Configuration Panels */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/30 border border-white/10 backdrop-blur-xl rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden group">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-white">
              <Briefcase className="w-4 h-4 text-blue-400" /> Matrix Calibration
            </h2>
            
            <div className="space-y-4 relative z-10">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Target Vocation</label>
                <input 
                  type="text" 
                  disabled={isStarted}
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/30 focus:shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Evaluation Focus Domain</label>
                <select 
                  disabled={isStarted}
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/30 transition-all disabled:opacity-50"
                >
                  <option value="technical">Technical Inquisitions</option>
                  <option value="behavioral">Behavioral (STAR Rubrics)</option>
                  <option value="mixed">Comprehensive Balanced Mix</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Resume Digest / Background Snippet</label>
                <textarea 
                  disabled={isStarted}
                  rows={4}
                  placeholder="Paste context, projects, or background constraints to customize the baseline questions..."
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/30 transition-all resize-none disabled:opacity-50"
                />
              </div>

              {!isStarted && (
                <button 
                  onClick={handleStartSession}
                  disabled={isLoading}
                  className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 font-medium text-sm py-3 rounded-xl shadow-[0_4px_20px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2 text-white"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  Sparks Active Interview
                </button>
              )}

              {(isStarted || isFinished) && (
                <button 
                  onClick={handleResetSession}
                  className="w-full mt-2 border border-white/10 hover:bg-white/5 font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-slate-300"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tear Down Session
                </button>
              )}
            </div>
          </div>

          {/* Real-time Session Turn Analytics Tracker Widget */}
          <div className="bg-slate-900/30 border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Progress Telemetry</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3.5">
                  <p className="text-[10px] text-slate-500 uppercase">Turn Space</p>
                  <p className="text-lg font-bold mt-1 text-blue-400">{turns} / 5 <span className="text-xs text-slate-400 font-normal">turns</span></p>
                </div>
                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3.5">
                  <p className="text-[10px] text-slate-500 uppercase">Architecture</p>
                  <p className="text-xs font-semibold mt-2.5 text-purple-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" /> 3-Agent Loop
                  </p>
                </div>
              </div>
            </div>

            {/* Premium Interactive Voice Configurations Block */}
            <div className="border-t border-white/5 pt-4 space-y-3.5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-blue-400" /> Interactive Voice Settings
              </h3>
              
              <div className="space-y-3">
                {/* Auto-Speak Toggle */}
                <div className="flex items-center justify-between bg-slate-950/40 border border-white/5 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    {speakEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                    <span className="text-xs font-medium text-slate-200">Auto-Speak Questions</span>
                  </div>
                  <button
                    onClick={() => {
                      const next = !speakEnabled;
                      setSpeakEnabled(next);
                      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                      }
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${speakEnabled ? "bg-blue-600" : "bg-slate-700"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${speakEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                {speakEnabled && (
                  <>
                    {/* Dynamic System Voice Selection */}
                    <div>
                      <label className="text-[9px] text-slate-400 block mb-1 uppercase font-medium">Interviewer Voice Accent</label>
                      <select
                        value={selectedVoiceName}
                        onChange={(e) => setSelectedVoiceName(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/30"
                      >
                        {voices.map((voice, idx) => (
                          <option key={idx} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Speed rate selection */}
                    <div>
                      <div className="flex justify-between items-center mb-1 text-[9px]">
                        <span className="text-slate-400 uppercase font-medium">Reading Speed</span>
                        <span className="text-blue-400 font-mono text-xs">{speechRate.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.5"
                        step="0.1"
                        value={speechRate}
                        onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Column Core Interaction Panels */}
        <section className="lg:col-span-8 h-[calc(100vh-10rem)] min-h-[450px] flex flex-col">
          {!isStarted ? (
            <div className="flex-1 bg-slate-900/10 border border-white/5 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-center p-6">
              <MessageSquare className="w-10 h-10 text-slate-700 mb-3" />
              <h3 className="text-base font-medium text-slate-400">Panel Initialization Needed</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1">Configure parameters in the left dashboard view block and spawn the dynamic interviewer to begin execution.</p>
            </div>
          ) : isFinished ? (
            
            /* GLASSMORPHIC MULTI-AGENT COACH OUTPUT REVELATION VIEW */
            <div className="flex-1 bg-slate-900/30 border border-blue-500/20 backdrop-blur-2xl rounded-2xl p-6 md:p-8 overflow-y-auto shadow-[0_0_50px_rgba(59,130,246,0.05)] space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <Award className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Diagnostic Blueprint Complete</h3>
                    <p className="text-xs text-slate-400">Synthesized metrics from Evaluator & Performance Agents</p>
                  </div>
                </div>
              </div>

              {/* Rubric Score Metrics Matrix Rendering Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950/60 border border-white/5 rounded-xl">
                  <p className="text-xs text-slate-400 font-medium">Communication Rubric</p>
                  <p className="text-2xl font-black mt-1 text-white">{matrix?.communication_score ?? 0}<span className="text-xs text-slate-500">/10</span></p>
                </div>
                <div className="p-4 bg-slate-950/60 border border-white/5 rounded-xl">
                  <p className="text-xs text-slate-400 font-medium">Technical Depth Precision</p>
                  <p className="text-2xl font-black mt-1 text-blue-400">{matrix?.technical_score ?? 0}<span className="text-xs text-slate-500">/10</span></p>
                </div>
                <div className="p-4 bg-slate-950/60 border border-white/5 rounded-xl">
                  <p className="text-xs text-slate-400 font-medium">Problem Solving Adaptivity</p>
                  <p className="text-2xl font-black mt-1 text-purple-400">{matrix?.problem_solving_score ?? 0}<span className="text-xs text-slate-500">/10</span></p>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 text-xs italic text-slate-400">
                <span className="font-bold text-white not-italic block mb-1">Executive Summary Justification:</span>
                "{matrix?.justification}"
              </div>

              {/* Formatted Markdown Render Box Block */}
              <div className="bg-slate-950/60 border border-white/5 rounded-xl p-5 md:p-6 text-sm text-slate-300 whitespace-pre-line leading-relaxed space-y-4">
                <div className="text-blue-400 font-bold tracking-wide text-xs uppercase flex items-center gap-1.5 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> Tailored Training Feedback Report
                </div>
                {feedbackMarkdown}
              </div>
            </div>
          ) : (
            
            /* CONVERSATIONAL RUNTIME INTERFACE PANEL */
            <div className="flex-1 bg-slate-900/30 border border-white/10 backdrop-blur-xl rounded-2xl flex flex-col overflow-hidden shadow-2xl">
              
              {/* Dynamic Scroll Timeline */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed border ${
                      msg.role === "candidate" 
                        ? "bg-blue-600/10 border-blue-500/20 text-slate-100 shadow-[0_0_20px_rgba(59,130,246,0.05)]" 
                        : "bg-slate-950/80 border-white/5 text-slate-300"
                    }`}>
                      <p className="text-[9px] font-bold tracking-wider uppercase mb-1 opacity-40">
                        {msg.role === "candidate" ? "You (Candidate)" : "Interviewer Panel Agent"}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      Agent orchestration system generating response...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Message Typing Control Box Entry Section */}
              <div className="p-4 bg-slate-950/80 border-t border-white/10 flex flex-col gap-3">
                {isListening && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg self-start">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-[10px] text-blue-400 font-mono tracking-wider animate-pulse uppercase">Listening to microphone... Speak clearly</span>
                  </div>
                )}
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`p-3 rounded-xl transition-all flex items-center justify-center border ${
                      isListening 
                        ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
                        : "bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                    title={isListening ? "Stop voice recognition" : "Speak response (Voice Input)"}
                  >
                    {isListening ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-slate-300" />}
                  </button>
                  <input 
                    type="text" 
                    disabled={isLoading}
                    placeholder={turns >= 5 ? "Turns concluded. Hit send to submit final evaluation bundle..." : isListening ? "Listening..." : "Type your technical or behavioral assertion down meticulously..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 transition-all text-slate-200 placeholder-slate-500 disabled:opacity-50"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isLoading || !input.trim()}
                    className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}