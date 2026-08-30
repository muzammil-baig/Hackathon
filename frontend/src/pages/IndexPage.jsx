import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Upload, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function parseConversation(text) {
  if (!text.trim()) return [];
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j) && j[0]?.role) return j;
  } catch (_) {}

  const msgs = [];
  let idx = 0, role = null, lines = [];
  for (const line of text.split("\n")) {
    if (/^(Human|User):\s*/i.test(line)) {
      if (role && lines.length) msgs.push({ role, text: lines.join("\n").trim(), index: idx++ });
      role = "human"; lines = [line.replace(/^(Human|User):\s*/i, "")];
    } else if (/^(Assistant|Claude):\s*/i.test(line)) {
      if (role && lines.length) msgs.push({ role, text: lines.join("\n").trim(), index: idx++ });
      role = "assistant"; lines = [line.replace(/^(Assistant|Claude):\s*/i, "")];
    } else if (role) {
      lines.push(line);
    }
  }
  if (role && lines.length) msgs.push({ role, text: lines.join("\n").trim(), index: idx++ });
  return msgs;
}

const STEPS = [
  "Parsing conversation",
  "Chunking messages",
  "Computing embeddings",
  "Clustering topics",
  "Summarizing with LLM",
  "Building RAPTOR tree",
  "Storing in vector DB",
];

export default function IndexPage() {
  const [convId, setConvId] = useState(() => `conv-${Date.now().toString(36)}`);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | indexing | indexed | error
  const [progress, setProgress] = useState("");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [msgCount, setMsgCount] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    const parsed = parseConversation(val);
    setMsgCount(parsed.length);
  };

  const startPolling = (id) => {
    let step = 0;
    pollRef.current = setInterval(async () => {
      step = Math.min(step + 1, STEPS.length - 2);
      setActiveStep(step);
      try {
        const res = await axios.get(`${API}/status/${id}`);
        const d = res.data;
        setProgress(d.progress || "");
        if (d.status === "indexed") {
          clearInterval(pollRef.current);
          setActiveStep(STEPS.length - 1);
          setTimeout(() => { setStatus("indexed"); setStats(d.stats || {}); }, 400);
        } else if (d.status === "error") {
          clearInterval(pollRef.current);
          setStatus("error"); setError(d.progress || "Indexing failed");
        }
      } catch (e) { /* continue */ }
    }, 2500);
  };

  const handleIndex = async () => {
    const msgs = parseConversation(text);
    if (!msgs.length) { setError("No messages parsed. Use Human:/Assistant: format or JSON."); return; }
    if (!convId.trim()) { setError("Conversation ID is required."); return; }

    setStatus("indexing"); setError(""); setActiveStep(0);

    try {
      const res = await axios.post(`${API}/index`, {
        conversation_id: convId.trim(),
        messages: msgs,
      });
      if (res.data.status === "indexing") {
        startPolling(convId.trim());
      } else {
        setStatus("indexed"); setStats(res.data.stats || {});
      }
    } catch (e) {
      setStatus("error");
      setError(e.response?.data?.detail || e.message || "Server error");
    }
  };

  return (
    <div className="p-8 min-h-full max-w-3xl" data-testid="index-page">
      <div className="mb-8">
        <h1 className="text-4xl tracking-tighter font-mono-ibm font-bold text-[#F4F4F5]">
          INDEX CONVERSATION
        </h1>
        <p className="text-sm text-[#71717A] mt-1">Build a RAPTOR memory tree from your conversation</p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── IDLE / INPUT ── */}
        {status === "idle" && (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-5">
              <div>
                <label className="block text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-2">
                  CONVERSATION ID
                </label>
                <input
                  type="text"
                  value={convId}
                  onChange={e => setConvId(e.target.value)}
                  data-testid="conv-id-input"
                  className="w-full px-3 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-sm font-mono-ibm outline-none focus:border-[#8B5CF6] transition-colors duration-200"
                  placeholder="my-conversation-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A]">
                    CONVERSATION TEXT
                  </label>
                  {msgCount > 0 && (
                    <span className="text-[9px] font-mono-ibm text-[#10B981]">
                      {msgCount} messages detected
                    </span>
                  )}
                </div>
                <textarea
                  value={text}
                  onChange={handleTextChange}
                  data-testid="conversation-input"
                  className="w-full h-64 px-3 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-xs font-mono-ibm outline-none focus:border-[#8B5CF6] transition-colors duration-200 resize-none leading-relaxed"
                  placeholder={"Human: What is RAPTOR?\n\nAssistant: RAPTOR is a recursive summarization technique...\n\nHuman: How does clustering work?\n\n— or paste raw JSON —"}
                />
                <p className="text-[9px] text-[#71717A] mt-1 font-mono-ibm">
                  Accepts: Human/Assistant format or JSON array [{"{"}role, text, index{"}"}]
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#7F1D1D]/20 border border-[#EF4444]/30 text-[#FCA5A5] text-xs font-mono-ibm" data-testid="error-msg">
                  <AlertCircle size={12} strokeWidth={1.5} /> {error}
                </div>
              )}

              <button
                onClick={handleIndex}
                disabled={!text.trim() || !convId.trim()}
                data-testid="start-index-btn"
                className="flex items-center gap-2 px-6 py-3 bg-[#8B5CF6] text-white text-xs font-mono-ibm tracking-[0.1em] hover:bg-[#7C3AED] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <Upload size={14} strokeWidth={1.5} /> START INDEXING
              </button>
            </div>
          </motion.div>
        )}

        {/* ── INDEXING ── */}
        {status === "indexing" && (
          <motion.div key="indexing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="indexing-panel">
            <div className="bg-[#0F0F11] border border-[#27272A] p-8">
              <div className="flex items-center gap-3 mb-6">
                <Loader size={18} strokeWidth={1.5} className="text-[#8B5CF6] animate-spin" />
                <p className="text-sm font-mono-ibm text-[#F4F4F5] tracking-tight">INDEXING IN PROGRESS</p>
              </div>
              <p className="text-xs font-mono-ibm text-[#71717A] mb-6">{progress || "Initializing..."}</p>
              <div className="space-y-2">
                {STEPS.map((step, i) => (
                  <div key={step} className={`flex items-center gap-3 text-[10px] font-mono-ibm transition-colors duration-500 ${
                    i < activeStep ? "text-[#10B981]" : i === activeStep ? "text-[#F4F4F5]" : "text-[#3F3F46]"
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      i < activeStep ? "bg-[#10B981]" : i === activeStep ? "bg-[#8B5CF6] animate-pulse" : "bg-[#27272A]"
                    }`} />
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS ── */}
        {status === "indexed" && (
          <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="success-panel">
            <div className="bg-[#0F0F11] border border-[#10B981]/40 p-8">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle size={18} strokeWidth={1.5} className="text-[#10B981]" />
                <p className="text-sm font-mono-ibm text-[#10B981] tracking-tight">INDEXED SUCCESSFULLY</p>
              </div>
              {stats && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    ["MESSAGES", stats.total_messages],
                    ["TOPICS", stats.total_topics],
                    ["CHUNKS", stats.total_chunks],
                    ["RAW TOKENS", stats.estimated_raw_tokens?.toLocaleString()],
                  ].map(([k, v]) => (
                    <div key={k} className="border border-[#27272A] p-3">
                      <p className="text-[9px] font-mono-ibm tracking-[0.2em] text-[#71717A]">{k}</p>
                      <p className="text-2xl font-mono-ibm font-bold text-[#F4F4F5]">{v ?? "--"}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/tree/${convId}`)}
                  data-testid="view-tree-btn"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#8B5CF6] text-white text-xs font-mono-ibm tracking-[0.1em] hover:bg-[#7C3AED] transition-colors duration-200"
                >
                  VIEW TREE
                </button>
                <button
                  onClick={() => navigate(`/query/${convId}`)}
                  data-testid="query-now-btn"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-xs font-mono-ibm tracking-[0.1em] hover:border-[#3F3F46] transition-colors duration-200"
                >
                  QUERY NOW
                </button>
                <button
                  onClick={() => { setStatus("idle"); setText(""); setConvId(`conv-${Date.now().toString(36)}`); }}
                  data-testid="index-another-btn"
                  className="px-5 py-2.5 text-[#71717A] text-xs font-mono-ibm hover:text-[#F4F4F5] transition-colors duration-200"
                >
                  INDEX ANOTHER
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="error-panel">
            <div className="bg-[#0F0F11] border border-[#EF4444]/40 p-8">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle size={18} strokeWidth={1.5} className="text-[#EF4444]" />
                <p className="text-sm font-mono-ibm text-[#EF4444] tracking-tight">INDEXING FAILED</p>
              </div>
              <p className="text-xs font-mono-ibm text-[#A1A1AA] mb-6">{error}</p>
              <button onClick={() => setStatus("idle")} data-testid="try-again-btn"
                className="px-5 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-xs font-mono-ibm hover:border-[#3F3F46] transition-colors duration-200">
                TRY AGAIN
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
