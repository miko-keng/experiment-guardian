import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, Search, AlertTriangle, CheckCircle, Clock, ChevronRight, FileText, ArrowRight } from "lucide-react";
import { createLinkedReview, listExperiments } from "../api/experiments";
import { Experiment } from "../types/index";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [mergeRequestUrl, setMergeRequestUrl] = useState("");
  const [runId, setRunId] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    listExperiments({ search, status: statusFilter || undefined })
      .then((res) => {
        setExperiments(res.items);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Failed to load experiments. Check that the backend is running.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const total = experiments.length;
  const needsReviewCount = experiments.filter((e) => e.status === "needs_review").length;
  const auditedCount = experiments.filter((e) => e.status === "audited").length;

  const linkRun = async (event: React.FormEvent) => {
    event.preventDefault(); setLinkBusy(true); setLinkError(null);
    try {
      const result = await createLinkedReview({ mergeRequestUrl: mergeRequestUrl.trim(), runId: runId.trim() });
      navigate(`/experiments/${result.experiment.id}`);
    } catch (error: any) { setLinkError(error.message || "Could not link the merge request and run"); }
    finally { setLinkBusy(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Research Integrity Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit experiments, detect confounding variables, and safeguard reproducibility before publishing results.
          </p>
        </div>
        <Link
          to="/new"
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Audit meeting notes</span>
        </Link>
      </div>

      <form onSubmit={linkRun} className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 space-y-3">
        <div><h2 className="font-bold text-slate-900">Review an existing ML run</h2>
          <p className="text-sm text-slate-600">Paste a GitLab merge request and MLflow run ID. Guardian reads their evidence without moving your code or artifacts.</p></div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <input required type="url" aria-label="GitLab merge request URL" placeholder="https://gitlab.com/group/project/-/merge_requests/12" value={mergeRequestUrl} onChange={e => setMergeRequestUrl(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input required aria-label="MLflow run ID" placeholder="MLflow run ID" value={runId} onChange={e => setRunId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button disabled={linkBusy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{linkBusy ? "Reading evidence…" : "Start review"}</button>
        </div>
        {linkError && <p role="alert" className="text-sm text-red-700">{linkError}</p>}
      </form>

      {/* Metrics overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Recorded Runs</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-slate-900">{total}</div>
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-amber-700 uppercase tracking-wider">Requires Review</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-amber-600">{needsReviewCount}</div>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Audited & Verified</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-emerald-600">{auditedCount}</div>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search experiments by title, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="needs_review">Needs Review</option>
            <option value="audited">Audited</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Table list */}
      <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {error ? (
          <div role="alert" className="p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-900">Could not load experiment history</h3>
            <p className="text-sm text-slate-600 mt-1">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-500">
            <Clock className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
            <p className="text-sm">Loading experiment history...</p>
          </div>
        ) : experiments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">No experiments recorded yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Submit your first research conversation transcript to extract structured parameters and run integrity audits.
            </p>
            <Link
              to="/new"
              className="mt-4 inline-flex items-center space-x-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <span>Audit your first experiment</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Experiment Title</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5">Model / Architecture</th>
                <th className="px-3 py-3.5">Dataset</th>
                <th className="px-3 py-3.5">Created At</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {experiments.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 pl-6 pr-3 font-medium text-slate-900">
                    <Link to={`/experiments/${exp.id}`} className="hover:text-indigo-600">
                      {exp.title}
                    </Link>
                  </td>
                  <td className="px-3 py-4">
                    {exp.status === "needs_review" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                        Needs Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
                        Audited
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-slate-600">
                    {exp.model.modelName || exp.model.architecture || (
                      <span className="text-slate-400 italic">Not recorded</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-slate-600">
                    {exp.dataset.datasetName ? (
                      <span>
                        {exp.dataset.datasetName} {exp.dataset.datasetVersion && `(${exp.dataset.datasetVersion})`}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Not recorded</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-slate-500 text-xs">
                    {new Date(exp.createdAt).toLocaleDateString()} {new Date(exp.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-4 pl-3 pr-6 text-right font-medium">
                    <Link
                      to={`/experiments/${exp.id}`}
                      className="inline-flex items-center text-indigo-600 hover:text-indigo-900 text-xs font-semibold"
                    >
                      <span>View Audit</span>
                      <ChevronRight className="w-4 h-4 ml-0.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
