import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GitBranch, MessageSquare, Trash2, RefreshCw, Layers } from "lucide-react";
import { motion } from "framer-motion";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function StatCard({ label, value, sub }) {
  return (
    <div
      data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}
      className="bg-[#0F0F11] border border-[#27272A] p-5"
    >
      <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-2">{label}</p>
      <p className="text-3xl font-mono-ibm font-bold text-[#F4F4F5] tracking-tighter">{value}</p>
      {sub && <p className="text-[10px] text-[#71717A] mt-1 font-mono-ibm">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/conversations`);
      setConversations(res.data || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConversations(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete "${id}"?`)) return;
    await axios.delete(`${API}/index/${id}`).catch(() => {});
    fetchConversations();
  };

  const totalMsgs = conversations.reduce((s, c) => s + (c.stats?.total_messages || 0), 0);
  const totalChunks = conversations.reduce((s, c) => s + (c.stats?.total_chunks || 0), 0);
  const totalRaw = conversations.reduce((s, c) => s + (c.stats?.estimated_raw_tokens || 0), 0);
  const TOKEN_BUDGET = 4000;
  const avgReduction = conversations.length
    ? Math.max(0, Math.round((1 - TOKEN_BUDGET / Math.max(1, totalRaw / Math.max(1, conversations.length))) * 100))
    : 0;

  return (
    <div className="p-8 min-h-full" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl tracking-tighter font-mono-ibm font-bold text-[#F4F4F5]">
            RAPTOR Memory
          </h1>
          <p className="text-sm text-[#71717A] mt-1">Hierarchical token-aware conversation memory</p>
        </div>
        <button
          onClick={fetchConversations}
          data-testid="refresh-btn"
          className="flex items-center gap-2 px-4 py-2 border border-[#27272A] text-[#71717A] hover:text-[#F4F4F5] hover:border-[#3F3F46] transition-colors duration-200 text-xs font-mono-ibm"
        >
          <RefreshCw size={12} strokeWidth={1.5} /> REFRESH
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Conversations" value={conversations.length} />
        <StatCard label="Total Messages" value={totalMsgs.toLocaleString()} />
        <StatCard label="Est. Raw Tokens" value={totalRaw > 1000 ? `${(totalRaw / 1000).toFixed(1)}K` : totalRaw} />
        <StatCard
          label="Avg Token Reduction"
          value={conversations.length ? `${avgReduction}%` : "—"}
          sub={conversations.length ? `4K context from ~${(totalRaw / Math.max(1, conversations.length) / 1000).toFixed(1)}K raw` : "Index a conversation to see"}
        />
      </div>

      {/* Conversations table */}
      <div className="bg-[#0F0F11] border border-[#27272A]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#27272A]">
          <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] flex items-center gap-2">
            <Layers size={11} strokeWidth={1.5} /> INDEXED CONVERSATIONS
          </p>
          <button
            onClick={() => navigate("/index")}
            data-testid="new-index-btn"
            className="px-3 py-1.5 bg-[#8B5CF6] text-white text-[10px] font-mono-ibm tracking-[0.1em] hover:bg-[#7C3AED] transition-colors duration-200"
          >
            + NEW INDEX
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-[#71717A] text-xs font-mono-ibm">LOADING...</div>
        ) : conversations.length === 0 ? (
          <div className="p-10 text-center" data-testid="empty-state">
            <Layers size={32} strokeWidth={1} className="text-[#27272A] mx-auto mb-3" />
            <p className="text-[#71717A] text-xs font-mono-ibm">No conversations indexed yet</p>
            <button
              onClick={() => navigate("/index")}
              className="mt-4 px-5 py-2 bg-[#8B5CF6] text-white text-xs font-mono-ibm hover:bg-[#7C3AED] transition-colors duration-200"
            >
              INDEX FIRST CONVERSATION
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono-ibm">
              <thead>
                <tr className="border-b border-[#27272A]">
                  {["CONVERSATION ID", "MESSAGES", "TOPICS", "CHUNKS", "RAW TOKENS", "MAX REDUCTION", "ACTIONS"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[9px] tracking-[0.15em] text-[#71717A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conversations.map(({ conversation_id, stats }, i) => {
                  const rawTok = stats?.estimated_raw_tokens || 0;
                  const reduction = rawTok > TOKEN_BUDGET ? Math.round((1 - TOKEN_BUDGET / rawTok) * 100) : 0;
                  return (
                  <motion.tr
                    key={conversation_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-[#18181B] hover:bg-[#18181B] transition-colors duration-150 group"
                    data-testid={`conv-row-${conversation_id}`}
                  >
                    <td className="px-4 py-3 text-[#8B5CF6] max-w-[180px] truncate font-mono-ibm">{conversation_id}</td>
                    <td className="px-4 py-3 text-[#F4F4F5] font-mono-ibm">{stats?.total_messages ?? '--'}</td>
                    <td className="px-4 py-3 text-[#4F46E5] font-mono-ibm">{stats?.total_topics ?? '--'}</td>
                    <td className="px-4 py-3 text-[#10B981] font-mono-ibm">{stats?.total_chunks ?? '--'}</td>
                    <td className="px-4 py-3 text-[#A1A1AA] font-mono-ibm">
                      {rawTok ? `${(rawTok / 1000).toFixed(1)}K` : '--'}
                    </td>
                    <td className="px-4 py-3 font-mono-ibm">
                      {reduction > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 bg-[#18181B]">
                            <div className="h-full bg-[#10B981]" style={{ width: `${reduction}%` }} />
                          </div>
                          <span className="text-[#10B981] font-bold">{reduction}%</span>
                        </div>
                      ) : <span className="text-[#3F3F46]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 opacity-20 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => navigate(`/tree/${conversation_id}`)}
                          data-testid={`tree-btn-${conversation_id}`}
                          className="p-1 text-[#71717A] hover:text-[#8B5CF6] transition-colors duration-200"
                          title="View Tree"
                        >
                          <GitBranch size={13} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => navigate(`/query/${conversation_id}`)}
                          data-testid={`query-btn-${conversation_id}`}
                          className="p-1 text-[#71717A] hover:text-[#10B981] transition-colors duration-200"
                          title="Query"
                        >
                          <MessageSquare size={13} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => handleDelete(conversation_id)}
                          data-testid={`delete-btn-${conversation_id}`}
                          className="p-1 text-[#71717A] hover:text-[#EF4444] transition-colors duration-200"
                          title="Delete"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
