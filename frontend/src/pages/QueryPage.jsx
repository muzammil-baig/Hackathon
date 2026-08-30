import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronDown, ChevronUp, AlertCircle, Loader } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NODE_COLORS = { ROOT: "#8B5CF6", TOPIC: "#4F46E5", SECTION: "#4F46E5", CHUNK: "#10B981" };

function TokenBar({ contextTokens, budget, reductionPct }) {
  const pct = Math.min(100, Math.round((contextTokens / budget) * 100));
  return (
    <div className="space-y-2" data-testid="token-bar">
      <div className="h-1.5 bg-[#18181B]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full bg-[#8B5CF6]"
        />
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono-ibm text-[#71717A]">
        <span data-testid="token-count">{contextTokens?.toLocaleString()} / {budget?.toLocaleString()} tokens</span>
        <span className="text-[#10B981] font-bold" data-testid="reduction-pct">{reductionPct}% less than raw</span>
      </div>
    </div>
  );
}

export default function QueryPage() {
  const { conversationId: paramId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(paramId || "");
  const [query, setQuery] = useState("");
  const [tokenBudget, setTokenBudget] = useState(4000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/conversations`).then(r => setConversations(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { if (paramId) setSelectedConv(paramId); }, [paramId]);

  const handleQuery = async () => {
    if (!query.trim() || !selectedConv) return;
    setLoading(true); setError(""); setResult(null); setSourcesOpen(false);
    try {
      const res = await axios.post(`${API}/query`, {
        conversation_id: selectedConv,
        query: query.trim(),
        token_budget: tokenBudget,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Query failed");
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleQuery();
  };

  return (
    <div className="p-8 min-h-full max-w-3xl" data-testid="query-page">
      <div className="mb-8">
        <h1 className="text-4xl tracking-tighter font-mono-ibm font-bold text-[#F4F4F5]">QUERY</h1>
        <p className="text-sm text-[#71717A] mt-1">Ask questions about your indexed conversations</p>
      </div>

      {/* Controls */}
      <div className="space-y-4 mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-2">
              CONVERSATION
            </label>
            <select
              value={selectedConv}
              onChange={e => { setSelectedConv(e.target.value); navigate(`/query/${e.target.value}`); }}
              data-testid="query-conv-selector"
              className="w-full px-3 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-xs font-mono-ibm outline-none focus:border-[#8B5CF6] transition-colors duration-200 cursor-pointer"
            >
              <option value="">Select a conversation...</option>
              {conversations.map(c => (
                <option key={c.conversation_id} value={c.conversation_id}>{c.conversation_id}</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <label className="block text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-2">
              TOKEN BUDGET: <span className="text-[#F4F4F5]">{tokenBudget.toLocaleString()}</span>
            </label>
            <input
              type="range" min="1000" max="8000" step="500"
              value={tokenBudget}
              onChange={e => setTokenBudget(+e.target.value)}
              data-testid="token-budget-slider"
              className="w-full accent-[#8B5CF6]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-2">
            QUESTION <span className="text-[#3F3F46]">(Ctrl+Enter to send)</span>
          </label>
          <div className="relative">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              data-testid="query-input"
              disabled={loading}
              className="w-full px-3 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-sm outline-none focus:border-[#8B5CF6] transition-colors duration-200 resize-none pr-12 font-sans-ibm leading-relaxed"
              placeholder="What decisions were made about the architecture? How did the approach evolve over time?"
            />
            <button
              onClick={handleQuery}
              disabled={loading || !query.trim() || !selectedConv}
              data-testid="ask-btn"
              className="absolute right-3 bottom-3 p-2 bg-[#8B5CF6] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#7C3AED] transition-colors duration-200"
            >
              <Send size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-[#7F1D1D]/20 border border-[#EF4444]/30 text-[#FCA5A5] text-xs font-mono-ibm" data-testid="query-error">
          <AlertCircle size={12} strokeWidth={1.5} /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0F0F11] border border-[#27272A]" data-testid="loading-state">
          <Loader size={14} strokeWidth={1.5} className="animate-spin text-[#8B5CF6]" />
          <span className="text-xs font-mono-ibm text-[#71717A]">Retrieving context and generating answer...</span>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
            data-testid="query-result"
          >
            {/* Answer */}
            <div className="bg-[#0F0F11] border border-[#27272A] p-5">
              <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-3">ANSWER</p>
              <MarkdownRenderer content={result.answer} data-testid="answer-text" />
            </div>

            {/* Token bar */}
            {result.token_counts && (
              <div className="bg-[#0F0F11] border border-[#27272A] p-4">
                <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-3">TOKEN USAGE</p>
                <TokenBar
                  contextTokens={result.token_counts.context_tokens}
                  budget={result.token_counts.token_budget}
                  reductionPct={result.token_counts.reduction_pct}
                />
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    ["CONTEXT", result.token_counts.context_tokens],
                    ["ANSWER", result.token_counts.answer_tokens],
                    ["LATENCY", `${result.latency_ms}ms`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[8px] font-mono-ibm tracking-[0.15em] text-[#71717A]">{k}</p>
                      <p className="text-base font-mono-ibm font-bold text-[#F4F4F5]">{v?.toLocaleString?.() ?? v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {result.nodes_used?.length > 0 && (
              <div className="bg-[#0F0F11] border border-[#27272A]">
                <button
                  onClick={() => setSourcesOpen(o => !o)}
                  data-testid="sources-toggle"
                  className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-mono-ibm tracking-[0.15em] text-[#71717A] hover:text-[#F4F4F5] transition-colors duration-200"
                >
                  <span>SOURCES USED ({result.nodes_used.length} nodes)</span>
                  {sourcesOpen ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
                </button>
                {sourcesOpen && (
                  <div className="border-t border-[#27272A] px-4 py-3 space-y-1.5" data-testid="sources-list">
                    {result.nodes_used.map((n, i) => (
                      <div key={i} className="flex items-center gap-3 text-[10px] font-mono-ibm py-1 border-l-2 pl-3"
                        style={{ borderColor: NODE_COLORS[n.level] || "#27272A" }}>
                        <span className="font-bold min-w-[44px]" style={{ color: NODE_COLORS[n.level] }}>{n.level}</span>
                        <span className="text-[#71717A]">{(n.similarity * 100).toFixed(0)}%</span>
                        <span className="text-[#71717A]">{n.token_count}t</span>
                        {n.topic_label && <span className="text-[#A1A1AA] truncate">{n.topic_label}</span>}
                        <span className="ml-auto text-[#3F3F46]">
                          {Array.isArray(n.line_range) ? `L${n.line_range[0]}–${n.line_range[1]}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
