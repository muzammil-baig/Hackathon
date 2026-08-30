import { useState, useEffect } from "react";
import axios from "axios";
import { Save, CheckCircle, AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import { motion } from "framer-motion";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      await axios.post(`${API}/settings`, { api_key: apiKey.trim() });
      setSaved(true);
      const res = await axios.get(`${API}/settings`);
      setSettings(res.data);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save settings");
    } finally { setSaving(false); }
  };

  return (
    <div className="p-8 min-h-full max-w-2xl" data-testid="settings-page">
      <div className="mb-8">
        <h1 className="text-4xl tracking-tighter font-mono-ibm font-bold text-[#F4F4F5]">SETTINGS</h1>
        <p className="text-sm text-[#71717A] mt-1">Configure your ConvoMemory backend</p>
      </div>

      <div className="space-y-5">
        {/* API Key section */}
        <div className="bg-[#0F0F11] border border-[#27272A] p-6">
          <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-4">
            ANTHROPIC API KEY
          </p>

          {settings && (
            <div className="flex items-center gap-2 mb-4 text-[10px] font-mono-ibm" data-testid="api-key-status">
              {settings.has_api_key ? (
                <>
                  <CheckCircle size={12} strokeWidth={1.5} className="text-[#10B981]" />
                  <span className="text-[#10B981]">
                    {settings.is_emergent_key ? "Using Emergent Universal Key" : "Custom key configured"}
                  </span>
                  <span className="text-[#3F3F46] ml-1">{settings.key_preview}</span>
                </>
              ) : (
                <>
                  <AlertCircle size={12} strokeWidth={1.5} className="text-[#F59E0B]" />
                  <span className="text-[#F59E0B]">No key configured</span>
                </>
              )}
            </div>
          )}

          <div className="relative mb-3">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              data-testid="api-key-input"
              className="w-full px-3 py-2.5 bg-[#050505] border border-[#27272A] text-[#F4F4F5] text-xs font-mono-ibm outline-none focus:border-[#8B5CF6] transition-colors duration-200 pr-10"
              placeholder="sk-ant-... or sk-emergent-..."
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F4F4F5] transition-colors duration-200"
            >
              {showKey ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
            </button>
          </div>

          {error && (
            <p className="text-[10px] font-mono-ibm text-[#EF4444] mb-3" data-testid="settings-error">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            data-testid="save-api-key-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#8B5CF6] text-white text-xs font-mono-ibm tracking-[0.1em] hover:bg-[#7C3AED] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {saved ? <CheckCircle size={13} strokeWidth={1.5} /> : <Save size={13} strokeWidth={1.5} />}
            {saved ? "SAVED" : saving ? "SAVING..." : "SAVE KEY"}
          </button>
        </div>

        {/* System info */}
        <div className="bg-[#0F0F11] border border-[#27272A] p-6">
          <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-4">SYSTEM INFO</p>
          <div className="grid grid-cols-2 gap-4 text-[10px] font-mono-ibm">
            {[
              ["RAPTOR READY", settings?.raptor_ready ? "YES" : "INSTALLING...", settings?.raptor_ready ? "#10B981" : "#F59E0B"],
              ["SUMMARIZATION MODEL", "claude-haiku-4-5", "#A1A1AA"],
              ["Q&A MODEL", "claude-sonnet-4-6", "#A1A1AA"],
              ["EMBEDDING MODEL", "all-MiniLM-L6-v2", "#A1A1AA"],
              ["TOKEN BUDGET (DEFAULT)", "4,000", "#A1A1AA"],
              ["VECTOR DB", "ChromaDB (local)", "#A1A1AA"],
            ].map(([k, v, c]) => (
              <div key={k}>
                <p className="text-[#71717A] tracking-[0.1em] mb-0.5">{k}</p>
                <p style={{ color: c || "#F4F4F5" }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info panel */}
        <div className="flex gap-3 px-4 py-3 bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 text-[10px] font-mono-ibm text-[#A1A1AA]">
          <Info size={13} strokeWidth={1.5} className="text-[#8B5CF6] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>The system uses an Emergent Universal Key by default (credits deducted from your balance).</p>
            <p>You can replace it with your own Anthropic key at any time — enter it above and click Save.</p>
          </div>
        </div>

        {/* Extension info */}
        <div className="bg-[#0F0F11] border border-[#27272A] p-6">
          <p className="text-[9px] font-mono-ibm tracking-[0.2em] uppercase text-[#71717A] mb-4">
            CHROME EXTENSION
          </p>
          <div className="space-y-2 text-[10px] font-mono-ibm text-[#A1A1AA]">
            <p>1. Open Chrome → Extensions → Enable Developer Mode</p>
            <p>2. Click "Load unpacked" → select the <span className="text-[#F4F4F5]">/app/extension/</span> directory</p>
            <p>3. Navigate to <span className="text-[#F4F4F5]">claude.ai</span> and open the extension popup</p>
            <p>4. Set backend URL to: <span className="text-[#8B5CF6] break-all">{process.env.REACT_APP_BACKEND_URL}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
