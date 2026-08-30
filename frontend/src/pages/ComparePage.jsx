import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompare, Loader, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const NODE_COLORS = { ROOT: "#8B5CF6", TOPIC: "#4F46E5", SECTION: "#4F46E5", CHUNK: "#10B981" };

function TokenMeter({ tokens, budget, rawTotal, label, accent }) {
  const pct = Math.min(100, Math.round((tokens / Math.max(1, rawTotal)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[9px] font-mono-ibm tracking-[0.1em] text-[#71717A]">
        <span>{label}</span>
        <span style={{ color: accent }} className="font-bold">{tokens?.toLocaleString()} tokens</span>
      </div>
      <div className="h-1.5 bg-[#18181B]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full"
          style={{ background: accent }}
        />
      </div>
      <div className="text-[9px] font-mono-ibm text-[#3F3F46]">
        {pct}% of raw conversation ({rawTotal?.toLocaleString()} total)
      </div>
    </div>
  );
}

function ResultPanel({ result, label, accent, isRaw, sourcesOpen, setSourcesOpen }) {
  const tc = isRaw
    ? { context_tokens: result?.context_tokens, latency_ms: result?.latency_ms, answer_tokens: result?.answer_tokens }
    : result?.token_counts || {};

  return (
    <div className="flex-1 min-w-0 border flex flex-col" style={{ borderColor: accent + "40" }}>
      {/* Panel header */}
      <div className="px-5 py-3 border-b" style={{ borderColor: accent + "30", background: accent + "08" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase" style={{ color: accent }}>
              {label}
            </p>
            <p className="text-xl font-mono-ibm font-bold text-[#F4F4F5] mt-0.5">
              {tc.context_tokens?.toLocaleString() ?? "—"}
              <span className="text-[#71717A] text-xs font-normal"> tokens</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-mono-ibm text-[#71717A]">LATENCY</p>
            <p className="text-sm font-mono-ibm font-bold text-[#F4F4F5]">{tc.latency_ms?.toLocaleString()}ms</p>
          </div>
        </div>
      </div>

      {/* Answer */}
      <div className="flex-1 overflow-y-auto px-5 py-4 max-h-[520px]" data-testid={`answer-panel-${isRaw ? 'raw' : 'raptor'}`}>
        {result ? (
          <MarkdownRenderer content={result.answer} compact={false} />
        ) : (
          <p className="text-[#3F3F46] text-xs font-mono-ibm">No answer yet</p>
        )}
      </div>

      {/* Sources (RAPTOR only) */}
      {!isRaw && result?.nodes_used?.length > 0 && (
        <div className="border-t px-5 py-3" style={{ borderColor: accent + "20" }}>
          <button
            onClick={() => setSourcesOpen(o => !o)}
            data-testid="compare-sources-toggle"
            className="flex items-center gap-2 text-[10px] font-mono-ibm text-[#71717A] hover:text-[#F4F4F5] transition-colors duration-200"
          >
            {sourcesOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {result.nodes_used.length} NODES RETRIEVED
          </button>
          {sourcesOpen && (
            <div className="mt-2 space-y-1">
              {result.nodes_used.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-[9px] font-mono-ibm py-0.5 border-l-2 pl-2"
                  style={{ borderColor: NODE_COLORS[n.level] || "#27272A" }}>
                  <span className="font-bold min-w-[40px]" style={{ color: NODE_COLORS[n.level] }}>{n.level}</span>
                  <span className="text-[#71717A]">{(n.similarity * 100).toFixed(0)}%</span>
                  <span className="text-[#71717A]">{n.token_count}t</span>
                  {n.topic_label && <span className="text-[#3F3F46]">{n.topic_label}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState("");
  const [query, setQuery] = useState("");
  const [tokenBudget, setTokenBudget] = useState(4000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/conversations`).then(r => {
      const convs = r.data || [];
      setConversations(convs);
      // Auto-select largest conversation for best demo
      if (!selectedConv && convs.length > 0) {
        const biggest = convs.reduce((a, b) =>
          (b.stats?.estimated_raw_tokens || 0) > (a.stats?.estimated_raw_tokens || 0) ? b : a
        );
        setSelectedConv(biggest.conversation_id);
      }
    }).catch(() => {});
  }, []);

  const handleCompare = async () => {
    if (!query.trim() || !selectedConv) return;
    setLoading(true); setError(""); setResult(null); setSourcesOpen(false);
    try {
      const res = await axios.post(`${API}/compare`, {
        conversation_id: selectedConv,
        query: query.trim(),
        token_budget: tokenBudget,
      }, { timeout: 120000 });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Comparison failed");
    } finally { setLoading(false); }
  };

  const summary = result?.summary;
  const selectedStats = conversations.find(c => c.conversation_id === selectedConv)?.stats;

  return (
    <div className="p-8 min-h-full" data-testid="compare-page">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <GitCompare size={22} strokeWidth={1.5} className="text-[#8B5CF6]" />
          <h1 className="text-4xl tracking-tighter font-mono-ibm font-bold text-[#F4F4F5]">COMPARE</h1>
        </div>
        <p className="text-sm text-[#71717A]">
          Same question · Same LLM · RAPTOR 4K context vs full raw context — side by side
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-2">CONVERSATION</label>
          <select
            value={selectedConv}
            onChange={e => setSelectedConv(e.target.value)}
            data-testid="compare-conv-selector"
            className="w-full px-3 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-xs font-mono-ibm outline-none focus:border-[#8B5CF6] transition-colors duration-200 cursor-pointer"
          >
            <option value="">Select conversation...</option>
            {conversations.map(c => (
              <option key={c.conversation_id} value={c.conversation_id}>
                {c.conversation_id} ({c.stats?.total_messages}msg · {((c.stats?.estimated_raw_tokens || 0) / 1000).toFixed(1)}K tokens)
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A]">QUESTION</label>
            {selectedStats && (
              <span className="text-[9px] font-mono-ibm text-[#71717A]">
                {selectedStats.estimated_raw_tokens?.toLocaleString()} raw tokens · {selectedStats.total_topics} topics · {selectedStats.total_chunks} chunks
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCompare()}
              data-testid="compare-query-input"
              disabled={loading}
              placeholder="What key decisions were made about the infrastructure?"
              className="flex-1 px-3 py-2.5 bg-[#0F0F11] border border-[#27272A] text-[#F4F4F5] text-sm font-sans-ibm outline-none focus:border-[#8B5CF6] transition-colors duration-200"
            />
            <button
              onClick={handleCompare}
              disabled={loading || !query.trim() || !selectedConv}
              data-testid="compare-run-btn"
              className="px-6 py-2.5 bg-[#8B5CF6] text-white text-xs font-mono-ibm tracking-[0.1em] hover:bg-[#7C3AED] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 whitespace-nowrap"
            >
              {loading ? "RUNNING..." : "COMPARE"}
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-5 py-4 bg-[#0F0F11] border border-[#27272A] mb-4"
          data-testid="compare-loading"
        >
          <Loader size={16} strokeWidth={1.5} className="animate-spin text-[#8B5CF6]" />
          <div>
            <p className="text-xs font-mono-ibm text-[#F4F4F5]">Running both queries concurrently</p>
            <p className="text-[9px] font-mono-ibm text-[#71717A] mt-0.5">
              RAPTOR retrieval (fast) + Full raw context (slower, all {selectedStats?.estimated_raw_tokens?.toLocaleString()} tokens)
            </p>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-[#7F1D1D]/20 border border-[#EF4444]/30 text-[#FCA5A5] text-xs font-mono-ibm">
          <AlertCircle size={12} strokeWidth={1.5} /> {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="compare-results"
          >
            {/* Summary bar */}
            {summary && (
              <div className="bg-[#0F0F11] border border-[#27272A] px-5 py-4 mb-4">
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-1">RAPTOR TOKENS</p>
                    <p className="text-2xl font-mono-ibm font-bold text-[#8B5CF6]">{summary.raptor_tokens?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-1">RAW TOKENS</p>
                    <p className="text-2xl font-mono-ibm font-bold text-[#A1A1AA]">{summary.raw_tokens?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-1">REDUCTION</p>
                    <p className="text-2xl font-mono-ibm font-bold text-[#10B981]">{summary.reduction_pct}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-1">SPEED DELTA</p>
                    <p className="text-2xl font-mono-ibm font-bold text-[#F59E0B]">
                      {summary.raw_latency_ms > summary.raptor_latency_ms
                        ? `${((summary.raw_latency_ms / summary.raptor_latency_ms)).toFixed(1)}×`
                        : "—"}
                      <span className="text-xs font-normal text-[#71717A]"> slower raw</span>
                    </p>
                  </div>
                </div>
                {/* Comparative token bars */}
                <div className="mt-4 space-y-3">
                  <TokenMeter
                    tokens={summary.raptor_tokens}
                    rawTotal={summary.estimated_full_tokens}
                    label="RAPTOR CONTEXT"
                    accent="#8B5CF6"
                  />
                  <TokenMeter
                    tokens={summary.raw_tokens}
                    rawTotal={summary.estimated_full_tokens}
                    label="RAW CONTEXT"
                    accent="#4B5563"
                  />
                </div>
              </div>
            )}

            {/* Side-by-side panels */}
            <div className="flex gap-4 items-stretch min-h-[400px]">
              <ResultPanel
                result={result.raptor}
                label="RAPTOR MEMORY"
                accent="#8B5CF6"
                isRaw={false}
                sourcesOpen={sourcesOpen}
                setSourcesOpen={setSourcesOpen}
              />
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                <div className="h-full w-px bg-[#27272A]" />
                <div className="absolute text-[9px] font-mono-ibm text-[#3F3F46] bg-[#050505] px-1 py-0.5">VS</div>
              </div>
              <ResultPanel
                result={{ answer: result.raw?.answer, token_counts: { latency_ms: result.raw?.latency_ms } }}
                label={`FULL RAW CONTEXT (${result.raw?.context_tokens?.toLocaleString()} tokens)`}
                accent="#4B5563"
                isRaw={true}
                sourcesOpen={false}
                setSourcesOpen={() => {}}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => navigate(`/query/${selectedConv}`)}
                className="text-[10px] font-mono-ibm text-[#71717A] hover:text-[#8B5CF6] transition-colors duration-200"
              >
                Open in Query page →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-20 text-[#71717A]">
          <GitCompare size={40} strokeWidth={0.8} className="mx-auto mb-4 text-[#27272A]" />
          <p className="text-xs font-mono-ibm">Select a conversation, type a question, and click COMPARE</p>
          <p className="text-[10px] font-mono-ibm text-[#3F3F46] mt-1">Both queries run concurrently — see the difference in real time</p>
        </div>
      )}
    </div>
  );
}
