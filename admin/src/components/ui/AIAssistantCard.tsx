import { useState, useEffect, FormEvent } from 'react';
import { Sparkles, Send, Activity, CheckCircle, Key, RefreshCw, X } from '../../lib/icons';
import { api } from '../../services/adminApi';

interface AIAssistantCardProps {
  summary?: string;
  spendingTrends?: number;
  customerPayments?: number;
  loading?: boolean;
}

export function AIAssistantCard({
  summary: initialSummary = 'Your platform metrics for this period remain stable. User growth is consistent with expected seasonal variation. Adherence rates are balanced across key categories. No unusual patterns detected.',
  spendingTrends = 7,
  customerPayments: initialInteractions = 25,
  loading = false,
}: AIAssistantCardProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [interactions, setInteractions] = useState(initialInteractions);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initial summary when prop changes (unless user asked a custom question)
  useEffect(() => {
    if (!summary || summary === initialSummary) {
      setSummary(initialSummary);
    }
  }, [initialSummary]);

  // Load API Key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('dawa_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
    setApiKey(savedKey);
    setKeyInput(savedKey);
  }, []);

  const handleSaveKey = (e: FormEvent) => {
    e.preventDefault();
    const cleanKey = keyInput.trim();
    setApiKey(cleanKey);
    localStorage.setItem('dawa_gemini_api_key', cleanKey);
    setShowKeyModal(false);
    setErrorMsg(null);
  };

  const handleAskGemini = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const promptText = query.trim();
    if (!promptText || isGenerating) return;

    setIsGenerating(true);
    setErrorMsg(null);

    // 1. Primary: Route request through Render Backend API (uses process.env.GEMINI_API_KEY on Render)
    try {
      const res = await api.ai.query(promptText);
      if (res?.text) {
        setSummary(res.text);
        setInteractions((prev) => prev + 1);
        setQuery('');
        setIsGenerating(false);
        return;
      }
    } catch (backendErr: any) {
      console.warn('[AIAssistantCard] Backend query failed, trying direct client API key fallback…', backendErr.message);
    }

    // 2. Fallback: Direct Gemini API request if client API key is provided
    const currentKey = apiKey || localStorage.getItem('dawa_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;

    if (!currentKey) {
      setIsGenerating(false);
      setShowKeyModal(true);
      setErrorMsg('Render backend query failed. Please configure GEMINI_API_KEY on Render backend or enter a client key below.');
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: promptText }],
              },
            ],
            systemInstruction: {
              parts: [
                {
                  text: 'You are Dawa-Lens AI, an intelligent administrative and clinical analytics companion for the Dawa-Lens platform. Provide concise, clear, accurate, and professional answers for health, medication adherence, platform analytics, and user growth queries. Keep responses structured, helpful, and under 150 words.',
                },
              ],
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const message = data?.error?.message || `API error (${response.status})`;
        if (response.status === 403 || message.includes('API_KEY') || message.includes('blocked')) {
          setShowKeyModal(true);
          throw new Error('Gemini API Key is invalid or blocked. Please provide a working Gemini API key.');
        }
        throw new Error(message);
      }

      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        throw new Error('Gemini returned an empty response.');
      }

      setSummary(generatedText);
      setInteractions((prev) => prev + 1);
      setQuery('');
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      setErrorMsg(err.message || 'Failed to generate response from Gemini 2.0 Flash');
    } finally {
      setIsGenerating(false);
    }
  };


  const shortSummary = summary.slice(0, 120);
  const hasMore = summary.length > 120;

  return (
    <div className="admin-card flex flex-col h-full gap-3 relative overflow-hidden p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center">
            <Sparkles size={14} className={`text-violet-400 ${isGenerating ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">How can I help you?</h3>
            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gemini 2.0 Flash
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowKeyModal(true)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              apiKey ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
            }`}
            title={apiKey ? 'Gemini API Key Connected (Click to change)' : 'Connect Gemini API Key'}
          >
            <Key size={13} />
          </button>
        </div>
      </div>

      {/* Error banner if any */}
      {errorMsg && (
        <div className="px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[10px] text-destructive flex items-center justify-between shrink-0">
          <span className="truncate">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-1 text-muted-foreground hover:text-foreground">
            <X size={10} />
          </button>
        </div>
      )}

      {/* AI Summary */}
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex-1 flex flex-col min-h-0 overflow-y-auto thin-scroll">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 shrink-0">
            <Activity size={10} className="text-primary" />
            AI Summary
          </p>
          {loading || isGenerating ? (
            <div className="space-y-2 py-1">
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
              <div className="skeleton h-3 w-3/5 rounded" />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {expanded || !hasMore ? summary : shortSummary + '…'}
              {hasMore && (
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="text-primary ml-1 hover:underline font-medium inline-block"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </p>
          )}
        </div>

        {/* Quick stat tiles */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
            <p className="text-[10px] text-muted-foreground mb-0.5">Adherence Events</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-base font-bold text-foreground tabular-nums leading-none">
                {loading ? '—' : spendingTrends}
              </p>
              <span className="badge badge-primary text-[9px] px-1.5 py-0.5">Active</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
            <p className="text-[10px] text-muted-foreground mb-0.5">AI Interactions</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-base font-bold text-foreground tabular-nums leading-none">
                {loading ? '—' : interactions}
              </p>
              <span className="badge badge-success text-[9px] px-1.5 py-0.5">
                <CheckCircle size={8} />
                Good
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleAskGemini} className="relative shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isGenerating}
          placeholder={isGenerating ? 'Gemini 2.0 Flash is thinking…' : 'Ask me anything…'}
          className="w-full pr-10 pl-3 py-2 text-xs bg-secondary/60 border border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isGenerating || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary hover:bg-primary/25 disabled:opacity-40 transition-colors"
          title="Send to Gemini 2.0 Flash"
        >
          {isGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Send size={11} />}
        </button>
      </form>

      {/* Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 fade-up-enter">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Key size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Gemini API Key</h4>
                  <p className="text-[11px] text-muted-foreground">Powered by Gemini 2.0 Flash</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Get your free API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                  . Saved securely in your browser.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
