import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquareText,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  BeeConversation,
  BeeConversationSummary,
  BeeStatus,
  getBeeConversation,
  getBeeStatus,
  getRelatedBeeConversations,
  importBeeConversation,
  listBeeConversations,
} from "../api/bee";

export const BeeImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<BeeStatus | null>(null);
  const [conversations, setConversations] = useState<BeeConversationSummary[]>([]);
  const [selected, setSelected] = useState<BeeConversation | null>(null);
  const [related, setRelated] = useState<BeeConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getBeeStatus();
      setStatus(current);
      if (current.configured) {
        const result = await listBeeConversations();
        setConversations(result.items);
        setNextCursor(result.nextCursor);
      }
    } catch (err: any) {
      setError(err.message || "Could not connect to Bee");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectConversation = async (conversation: BeeConversationSummary) => {
    setLoadingConversation(true);
    setError(null);
    try {
      const [detail, relatedResult] = await Promise.all([
        getBeeConversation(conversation.id),
        getRelatedBeeConversations(conversation.id),
      ]);
      setSelected(detail);
      setRelated(relatedResult.items);
    } catch (err: any) {
      setError(err.message || "Could not load Bee conversation");
    } finally {
      setLoadingConversation(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const result = await listBeeConversations(nextCursor);
      setConversations((items) => [...items, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err: any) {
      setError(err.message || "Could not load more conversations");
    } finally {
      setLoading(false);
    }
  };

  const importSelected = async () => {
    if (!selected) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importBeeConversation(selected.id);
      navigate(`/experiments/${result.experiment.id}`);
    } catch (err: any) {
      setError(err.message || "Could not import Bee conversation");
    } finally {
      setImporting(false);
    }
  };

  const filtered = conversations.filter((conversation) => {
    const haystack = `${conversation.title || ""} ${conversation.summary || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  if (loading && !status) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />Checking Bee connection…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <Radio className="w-4 h-4" /> Continuous research memory
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Bee Conversation Import</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">When Bee is connected, review Bee-captured discussions before turning them into evidence-linked experiment records. Bee is disabled in the public demo.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Refresh connection
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}

      {status && !status.configured ? (
        <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8">
          <div className="max-w-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4"><Radio className="w-6 h-6 text-amber-700" /></div>
            <h2 className="text-xl font-bold text-slate-900">Connect Bee to continue</h2>
            <p className="mt-2 text-sm text-slate-600">{status.message}</p>
            <ol className="mt-5 space-y-2 text-sm text-slate-700 list-decimal pl-5">
              <li>Install the official CLI: <code className="rounded bg-white px-1.5 py-0.5">npm install -g @beeai/cli</code></li>
              <li>Enable Developer Mode in the Bee iOS app by tapping the app version five times.</li>
              <li>Run <code className="rounded bg-white px-1.5 py-0.5">bee login</code>, then confirm with <code className="rounded bg-white px-1.5 py-0.5">bee status</code>.</li>
              <li>Set <code className="rounded bg-white px-1.5 py-0.5">BEE_ENABLED=true</code> and restart Experiment Guardian.</li>
            </ol>
            <p className="mt-5 text-xs text-slate-500">Manual transcript auditing remains available while Bee is disconnected.</p>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
          <aside className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 mb-3"><CheckCircle2 className="w-4 h-4" />Bee connected</div>
              <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search loaded conversations" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" /></div>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.map((conversation) => (
                <button key={conversation.id} type="button" onClick={() => selectConversation(conversation)} className={`w-full text-left p-4 hover:bg-amber-50 transition ${selected?.id === conversation.id ? "bg-amber-50" : ""}`}>
                  <p className="text-sm font-semibold text-slate-900">{conversation.title || "Untitled Bee conversation"}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{conversation.summary || "Open to review the transcript."}</p>
                  {conversation.startedAt && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(conversation.startedAt).toLocaleString()}</p>}
                </button>
              ))}
            </div>
            {nextCursor && <button type="button" onClick={loadMore} className="w-full border-t border-slate-200 p-3 text-sm font-semibold text-indigo-600 hover:bg-slate-50">Load more</button>}
          </aside>

          <main className="rounded-xl border border-slate-200 bg-white min-h-[520px]">
            {loadingConversation ? (
              <div className="h-full flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />Loading conversation…</div>
            ) : selected ? (
              <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div><h2 className="text-xl font-bold text-slate-900">{selected.title || "Untitled Bee conversation"}</h2><p className="text-sm text-slate-500 mt-1">{selected.utterances.length} transcript utterances</p></div>
                  <button type="button" onClick={importSelected} disabled={importing || selected.utterances.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Import and audit <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <section><h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-amber-600" />Transcript evidence</h3><div className="max-h-80 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200">{selected.utterances.map((utterance, index) => <div key={utterance.id || index} className="p-3 text-sm"><div className="flex justify-between gap-3 text-xs text-slate-500 mb-1"><span className="font-semibold text-slate-700">{utterance.speaker || "Unknown speaker"}</span><span>{utterance.spokenAt ? new Date(utterance.spokenAt).toLocaleTimeString() : ""}</span></div><p className="text-slate-800">{utterance.text}</p></div>)}</div></section>
                <section><h3 className="text-sm font-bold text-slate-900 mb-3">Related research conversations</h3>{related.length === 0 ? <p className="text-sm text-slate-500">No related conversations returned by Bee.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{related.map((item) => <button type="button" key={item.id} onClick={() => selectConversation(item)} className="rounded-lg border border-slate-200 p-3 text-left hover:border-amber-300 hover:bg-amber-50"><p className="text-sm font-semibold text-slate-800">{item.title || "Related conversation"}</p><p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.summary}</p></button>)}</div>}</section>
              </div>
            ) : (
              <div className="h-full min-h-[520px] flex flex-col items-center justify-center text-center p-8"><MessageSquareText className="w-12 h-12 text-slate-300 mb-3" /><h2 className="text-base font-semibold text-slate-900">Select a Bee conversation</h2><p className="text-sm text-slate-500 mt-1 max-w-sm">Review its transcript and related research context before importing it.</p></div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};
