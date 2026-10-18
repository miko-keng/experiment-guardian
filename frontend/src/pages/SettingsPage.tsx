import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck, Database, Cpu, Lock } from "lucide-react";
import { getHealth } from "../api/experiments";
import { HealthResponse } from "../types/index";

export const SettingsPage: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => console.error("Error loading health:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Integration Status</h1>
        <p className="text-sm text-slate-500 mt-1">
          Read-only configuration indicators. All AWS and external service credentials are kept securely on the backend.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
        {/* Database */}
        <div className="p-6 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Database className="w-5 h-5 text-indigo-600 mt-1 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">SQLite Database</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Local persistent storage for experiment runs, metadata, and audit records.
              </p>
            </div>
          </div>
          <div>
            {health?.database === "connected" ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
                Disconnected
              </span>
            )}
          </div>
        </div>

        {/* AWS Bedrock */}
        <div className="p-6 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Cpu className="w-5 h-5 text-indigo-600 mt-1 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AWS Bedrock Runtime</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Model: <span className="font-mono text-slate-800 font-semibold">{health?.modelId || "anthropic.claude-haiku-5-5"}</span> | Region: <span className="font-mono text-slate-800 font-semibold">{health?.region || "ap-southeast-2"}</span>
              </p>
              {health?.mockMode && (
                <div className="mt-2 text-xs bg-amber-50 text-amber-800 rounded px-2.5 py-1 inline-block border border-amber-200 font-medium">
                  Running in Mock Extractor mode (ALLOW_MOCK_AI=true)
                </div>
              )}
            </div>
          </div>
          <div>
            {health?.mockMode ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Mock Only
              </span>
            ) : health?.bedrockConfigured ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Configured
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <XCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Not Configured
              </span>
            )}
          </div>
        </div>

        {/* Bee Integration */}
        <div className="p-6 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 mt-1 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Bee Wearable AI Integration</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Optional wearable audio transcript intake (Phase 3). Currently operating in manual fallback mode.
              </p>
            </div>
          </div>
          <div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Disabled (Phase 3)
            </span>
          </div>
        </div>
      </div>

      {/* Security and Credentials Guidance */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 text-xs text-slate-600 space-y-3">
        <div className="flex items-center space-x-2 font-semibold text-slate-800 text-sm">
          <Lock className="w-4 h-4 text-slate-500" />
          <span>Security & Credential Management Policy</span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Credentials must never be placed in frontend code, browser localStorage, or client network requests.</li>
          <li>Configuration changes are managed strictly via backend environment variables in <code>.env</code>.</li>
          <li>Transcripts are treated as sensitive research data; retention can be toggled via <code>PERSIST_TRANSCRIPTS</code>.</li>
        </ul>
      </div>
    </div>
  );
};
