import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  ShieldAlert,
  Hash,
  Database,
  Check,
  ChevronDown,
  Layers,
  Cpu,
  Sliders,
  BarChart3,
  GitBranch,
  History,
  Plus,
  X,
  Radio,
  RefreshCw,
} from "lucide-react";
import {
  createDecision,
  getExperiment,
  proposeRevision,
  reviewRevision,
  updateDecisionState,
  updateFindingStatus,
} from "../api/experiments";
import { syncBeeConversation } from "../api/bee";
import { DecisionState, ExperimentDetailResponse, FindingStatus } from "../types/index";

const REVISION_FIELDS = [
  ["training.randomSeed", "Random seed"],
  ["training.learningRate", "Learning rate"],
  ["training.batchSize", "Batch size"],
  ["training.epochs", "Epochs"],
  ["training.optimizer", "Optimizer"],
  ["dataset.datasetVersion", "Dataset version"],
  ["dataset.datasetIdentifier", "Dataset identifier"],
  ["dataset.trainSplit", "Training split"],
  ["dataset.validationSplit", "Validation split"],
  ["dataset.testSplit", "Test split"],
  ["model.modelName", "Model name"],
  ["model.architecture", "Model architecture"],
  ["evaluation.codeCommit", "Code commit"],
] as const;

export const ExperimentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ExperimentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [revisionField, setRevisionField] = useState<string>("training.randomSeed");
  const [revisionValue, setRevisionValue] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [decisionStatement, setDecisionStatement] = useState("");
  const [decisionOwner, setDecisionOwner] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = () => {
    if (!id) return;
    setLoading(true);
    getExperiment(id)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Failed to load experiment details");
      })
      .finally(() => setLoading(false));
  };

  const handleProposeRevision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setActionId("new-revision");
    setActionError(null);
    try {
      await proposeRevision(id, {
        fieldPath: revisionField,
        proposedValue: revisionValue,
        reason: revisionReason,
      });
      setRevisionValue("");
      setRevisionReason("");
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Could not create revision proposal");
    } finally {
      setActionId(null);
    }
  };

  const handleReviewRevision = async (revisionId: string, action: "apply" | "reject") => {
    if (!id) return;
    setActionId(revisionId);
    setActionError(null);
    try {
      await reviewRevision(id, revisionId, action);
      loadData();
    } catch (err: any) {
      setActionError(err.message || `Could not ${action} revision`);
    } finally {
      setActionId(null);
    }
  };

  const handleCreateDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setActionId("new-decision");
    setActionError(null);
    try {
      await createDecision(id, {
        statement: decisionStatement,
        owner: decisionOwner.trim() || null,
      });
      setDecisionStatement("");
      setDecisionOwner("");
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Could not record decision");
    } finally {
      setActionId(null);
    }
  };

  const handleDecisionState = async (decisionId: string, state: DecisionState) => {
    if (!id) return;
    setActionId(decisionId);
    setActionError(null);
    try {
      await updateDecisionState(id, decisionId, state);
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Could not update decision");
    } finally {
      setActionId(null);
    }
  };

  const handleBeeSync = async () => {
    const sourceId = data?.experiment.source.sourceId;
    if (!sourceId) return;
    setActionId("bee-sync");
    setActionError(null);
    try {
      const result = await syncBeeConversation(sourceId);
      if (!result.changed) {
        setActionError("Bee synchronization completed. No new utterances were found.");
      }
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Could not synchronize Bee conversation");
    } finally {
      setActionId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleResolve = async (findingId: string, status: FindingStatus) => {
    try {
      await updateFindingStatus(findingId, status, resolutionNote || "Acknowledged and resolved by researcher");
      setResolvingId(null);
      setResolutionNote("");
      loadData();
    } catch (err: any) {
      alert(`Failed to update finding status: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
        <Clock className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
        <p className="text-sm">Loading experiment record and audit findings...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <h3 className="text-lg font-bold">Experiment Not Found</h3>
          <p className="mt-2 text-sm">{error || "Could not retrieve experiment data."}</p>
          <Link to="/" className="inline-block mt-4 text-sm font-semibold text-red-700 underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { experiment, findings, baseline } = data;
  const revisions = data.revisions || [];
  const decisions = data.decisions || [];
  const auditHistory = data.auditHistory || [];

  const renderValue = (val: any) => {
    if (val === null || val === undefined || val === "") {
      return <span className="text-slate-400 italic text-xs font-mono">Not recorded</span>;
    }
    return <span className="font-mono text-slate-900 font-medium">{String(val)}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <Link to="/" className="inline-flex items-center space-x-1 text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{experiment.title}</h1>
            {experiment.status === "needs_review" ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Needs Review ({findings.filter((f) => f.status === "open").length} Open Findings)
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                Audited & Cleared
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Recorded: {new Date(experiment.createdAt).toLocaleString()}
            </span>
            <span className="flex items-center">
              <Database className="w-3.5 h-3.5 mr-1 text-slate-400" />
              ID: {experiment.id.slice(0, 8)}...
            </span>
            {baseline && (
              <span className="flex items-center text-indigo-600 font-medium">
                Baseline: {baseline.title}
              </span>
            )}
          </div>
        </div>
        {experiment.source.sourceType === "bee" && experiment.source.sourceId && (
          <button
            type="button"
            onClick={handleBeeSync}
            disabled={actionId === "bee-sync"}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {actionId === "bee-sync" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            Sync new Bee discussion
          </button>
        )}
      </div>

      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {actionError}
        </div>
      )}

      {/* Audit Findings Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Deterministic Audit Findings</h2>
          </div>
          <span className="text-xs bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
            {findings.length} Total Finding{findings.length === 1 ? "" : "s"}
          </span>
        </div>

        {findings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No integrity issues identified</p>
            <p className="text-xs text-slate-500 mt-1">All checked experimental controls are verified.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {findings.map((f) => (
              <div key={f.id} className="p-6 space-y-3 hover:bg-slate-50/50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    {f.severity === "critical" && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                        Critical
                      </span>
                    )}
                    {f.severity === "warning" && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        Warning
                      </span>
                    )}
                    {f.severity === "info" && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                        Info
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                    <span className="text-xs text-slate-400 font-mono">[{f.ruleId}]</span>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                      f.status === "open"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {f.status}
                  </span>
                </div>

                <p className="text-sm text-slate-700">{f.description}</p>

                {/* Evidence Panel */}
                {f.evidence && f.evidence.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-200 space-y-1.5">
                    <div className="font-semibold text-slate-700 flex items-center space-x-1">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span>Evidence Details:</span>
                    </div>
                    {f.evidence.map((ev, idx) => (
                      <div key={idx} className="text-slate-600 pl-4 font-mono">
                        • {ev.description}
                        {ev.previousValue !== null && ev.previousValue !== undefined && (
                          <span className="text-amber-700"> (was: {String(ev.previousValue)})</span>
                        )}
                        {ev.currentValue !== null && ev.currentValue !== undefined && (
                          <span className="text-emerald-700"> (now: {String(ev.currentValue)})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendation */}
                <div className="text-xs text-slate-600 flex items-start space-x-1.5">
                  <span className="font-semibold text-slate-800">Recommendation:</span>
                  <span>{f.recommendation}</span>
                </div>

                {/* Resolution note display */}
                {f.resolutionNote && (
                  <div className="text-xs bg-emerald-50 text-emerald-800 rounded p-2 font-mono">
                    Resolution note: {f.resolutionNote}
                  </div>
                )}

                {/* Status action toggle */}
                {f.status === "open" && (
                  <div className="pt-2">
                    {resolvingId === f.id ? (
                      <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <input
                          type="text"
                          placeholder="Enter note or explanation (e.g. Seed 42 verified in script)"
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => handleResolve(f.id, "resolved")}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1 rounded transition"
                          >
                            Mark Resolved
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolve(f.id, "accepted")}
                            className="text-xs bg-slate-600 hover:bg-slate-700 text-white font-semibold px-3 py-1 rounded transition"
                          >
                            Accept Risk
                          </button>
                          <button
                            type="button"
                            onClick={() => setResolvingId(null)}
                            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(f.id);
                          setResolutionNote("");
                        }}
                        className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve / Acknowledge Finding</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Research decisions and governed revisions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-2">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Research Decision History</h2>
          </div>
          <form onSubmit={handleCreateDecision} className="p-5 border-b border-slate-100 space-y-3">
            <textarea
              value={decisionStatement}
              onChange={(event) => setDecisionStatement(event.target.value)}
              placeholder="Record a proposed, confirmed, or abandoned research decision..."
              rows={3}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={decisionOwner}
                onChange={(event) => setDecisionOwner(event.target.value)}
                placeholder="Owner (optional)"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={actionId === "new-decision" || decisionStatement.trim().length < 3}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Record decision
              </button>
            </div>
          </form>
          <div className="divide-y divide-slate-100">
            {decisions.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No research decisions recorded yet.</p>
            ) : decisions.map((decision) => (
              <div key={decision.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-800">{decision.statement}</p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                    {decision.state}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {decision.owner && <span>Owner: {decision.owner}</span>}
                  <span>{new Date(decision.createdAt).toLocaleString()}</span>
                </div>
                <select
                  value={decision.state}
                  disabled={actionId === decision.id}
                  onChange={(event) => handleDecisionState(decision.id, event.target.value as DecisionState)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
                  aria-label={`Update state for ${decision.statement}`}
                >
                  <option value="proposed">Proposed</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                  <option value="abandoned">Abandoned</option>
                  <option value="superseded">Superseded</option>
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Governed Revisions</h2>
            </div>
            <span className="text-xs text-slate-500">{auditHistory.length} audit run{auditHistory.length === 1 ? "" : "s"}</span>
          </div>
          <form onSubmit={handleProposeRevision} className="p-5 border-b border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={revisionField}
                onChange={(event) => setRevisionField(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Experiment field to revise"
              >
                {REVISION_FIELDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input
                value={revisionValue}
                onChange={(event) => setRevisionValue(event.target.value)}
                placeholder="Proposed value; leave blank for unknown"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <input
              value={revisionReason}
              onChange={(event) => setRevisionReason(event.target.value)}
              placeholder="Why should this value change?"
              required
              minLength={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={actionId === "new-revision" || revisionReason.trim().length < 3}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Create proposal
            </button>
          </form>
          <div className="divide-y divide-slate-100">
            {revisions.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No revisions proposed yet.</p>
            ) : revisions.map((revision) => (
              <div key={revision.id} className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="text-xs font-semibold text-indigo-700">{revision.fieldPath}</code>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    revision.status === "applied"
                      ? "bg-emerald-100 text-emerald-800"
                      : revision.status === "rejected"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-100 text-amber-800"
                  }`}>{revision.status}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                  <div><span className="text-slate-500">Previous</span><div className="font-mono text-slate-800">{revision.previousValue === null ? "Unknown" : String(revision.previousValue)}</div></div>
                  <span className="text-slate-400">→</span>
                  <div><span className="text-slate-500">Proposed</span><div className="font-mono text-slate-800">{revision.proposedValue === null ? "Unknown" : String(revision.proposedValue)}</div></div>
                </div>
                <p className="text-sm text-slate-700">{revision.reason}</p>
                {revision.status === "proposed" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionId === revision.id}
                      onClick={() => handleReviewRevision(revision.id, "apply")}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    ><Check className="w-3.5 h-3.5" /> Apply and re-audit</button>
                    <button
                      type="button"
                      disabled={actionId === revision.id}
                      onClick={() => handleReviewRevision(revision.id, "reject")}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    ><X className="w-3.5 h-3.5" /> Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Structured Configuration Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Model Configuration</h3>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Model Name</dt>
              <dd className="mt-0.5">{renderValue(experiment.model.modelName)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Architecture</dt>
              <dd className="mt-0.5">{renderValue(experiment.model.architecture)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Version</dt>
              <dd className="mt-0.5">{renderValue(experiment.model.modelVersion)}</dd>
            </div>
          </dl>
        </div>

        {/* Dataset Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Dataset & Splits</h3>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Dataset Name</dt>
              <dd className="mt-0.5">{renderValue(experiment.dataset.datasetName)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Dataset Version</dt>
              <dd className="mt-0.5">{renderValue(experiment.dataset.datasetVersion)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Train Split</dt>
              <dd className="mt-0.5">{renderValue(experiment.dataset.trainSplit)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Test Split</dt>
              <dd className="mt-0.5">{renderValue(experiment.dataset.testSplit)}</dd>
            </div>
          </dl>
        </div>

        {/* Training Hyperparameters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Training Hyperparameters</h3>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Learning Rate</dt>
              <dd className="mt-0.5">{renderValue(experiment.training.learningRate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Batch Size</dt>
              <dd className="mt-0.5">{renderValue(experiment.training.batchSize)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Epochs</dt>
              <dd className="mt-0.5">{renderValue(experiment.training.epochs)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Random Seed</dt>
              <dd className="mt-0.5">{renderValue(experiment.training.randomSeed)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Optimizer</dt>
              <dd className="mt-0.5">{renderValue(experiment.training.optimizer)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Framework</dt>
              <dd className="mt-0.5">{renderValue(experiment.training.framework)}</dd>
            </div>
          </dl>
        </div>

        {/* Evaluation Metrics */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Evaluation & Metrics</h3>
          </div>
          <div className="space-y-3">
            {Object.keys(experiment.evaluation.metrics).length > 0 ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(experiment.evaluation.metrics).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="mt-0.5 font-mono font-bold text-slate-900">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <span className="text-xs text-slate-400 italic font-mono">No metric values recorded</span>
            )}
          </div>
        </div>
      </div>

      {/* Raw Transcript & Provenance */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <button
          type="button"
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-800">Source Provenance & Raw Transcript</h4>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTranscript ? "rotate-180" : ""}`} />
        </button>

        {showTranscript && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div className="text-xs text-slate-500 font-mono">
              Source Type: <span className="text-slate-800 font-bold">{experiment.source.sourceType}</span> | Transcript Hash:{" "}
              <span className="text-slate-800 font-bold">{experiment.source.transcriptHash}</span>
            </div>
            {experiment.source.transcriptText ? (
              <pre className="bg-slate-50 p-4 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto border border-slate-200">
                {experiment.source.transcriptText}
              </pre>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Transcript persistence was disabled during submission.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
