import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle, ArrowLeft, Database, Info, Loader2 } from "lucide-react";
import { createAndAuditExperiment, listExperiments } from "../api/experiments";
import { ApiClientError } from "../api/client";
import { Experiment } from "../types/index";

const SAMPLE_TRANSCRIPTS = {
  baseline: `In today's meeting, Alex and Sarah finalized the baseline run. We trained ResNet-50 on ImageNet with dataset version v2.0 using the standard 80/20 train/test split. The learning rate was set to 0.001 with AdamW optimizer, batch size 64, and random seed 42. After 50 epochs, the top-1 evaluation accuracy reached 0.785.`,
  missingSeed: `We ran another iteration of BERT-Base on the GLUE SST-2 benchmark dataset version v1. The learning rate was set to 0.00002, batch size 32, for 3 epochs. But we forgot to document what random seed was initialized for this training run.`,
  confounding: `Comparing against our baseline run: we wanted to speed up training, so we increased the learning rate to 0.01 and simultaneously adjusted the dataset split from 80/20 to 70/30. We evaluated the model and noticed a 3% improvement in speed.`,
};

export const NewExperimentPage: React.FC = () => {
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState("");
  const [baselineId, setBaselineId] = useState<string>("");
  const [persistTranscript, setPersistTranscript] = useState(true);
  const [sourceType] = useState<"manual" | "bee">("manual");
  const [baselines, setBaselines] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; details?: unknown } | null>(null);

  useEffect(() => {
    listExperiments({ limit: 50 })
      .then((res) => setBaselines(res.items))
      .catch((err) => console.error("Failed to load potential baselines:", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript.trim()) {
      setError({
        code: "VALIDATION_ERROR",
        message: "Please enter or paste a research transcript before submitting.",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await createAndAuditExperiment({
        transcript,
        sourceType,
        baselineExperimentId: baselineId || null,
        persistTranscript,
      });

      // Navigate to the experiment detail view on success
      navigate(`/experiments/${response.experiment.id}`);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError({
          code: err.code,
          message: err.message,
          details: err.details,
        });
      } else {
        setError({
          code: "UNKNOWN_ERROR",
          message: err.message || "An unexpected error occurred during extraction.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (key: keyof typeof SAMPLE_TRANSCRIPTS) => {
    setTranscript(SAMPLE_TRANSCRIPTS[key]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center space-x-1 text-sm font-medium text-slate-500 hover:text-slate-800 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Meeting Notes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Paste experimental discussions from lab meetings or Slack. The configured extractor structures the record, then deterministic rules verify scientific controls. The public demo uses the Bedrock Mock Extractor.
        </p>
      </div>

      {/* Quick sample loader */}
      <div className="mb-6 bg-indigo-50/70 border border-indigo-100 rounded-xl p-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Quick Sample Transcripts (Specification Test Cases)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadSample("baseline")}
            className="text-xs bg-white text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 font-medium transition"
          >
            Test A: Complete Baseline
          </button>
          <button
            type="button"
            onClick={() => loadSample("missingSeed")}
            className="text-xs bg-white text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 font-medium transition"
          >
            Test B: Missing Random Seed
          </button>
          <button
            type="button"
            onClick={() => loadSample("confounding")}
            className="text-xs bg-white text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 font-medium transition"
          >
            Test D: Confounding Multi-Variable Change
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold">{error.code}: Extraction Error</h4>
              <p className="text-sm mt-1">{error.message}</p>
              {error.code === "PERMISSION_DENIED" && (
                <div className="mt-3 p-3 bg-red-100/70 rounded-md text-xs text-red-900 font-mono">
                  Tip: Your AWS account verification or Bedrock model access grant is in progress. Check Settings or toggle ALLOW_MOCK_AI=true in .env for local testing.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="transcript" className="block text-sm font-semibold text-slate-800">
                Research Conversation Transcript <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-slate-400">{transcript.length} / 50,000 characters</span>
            </div>
            <textarea
              id="transcript"
              rows={8}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste raw conversation, meeting notes, or experimental discussion here..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="baseline" className="block text-sm font-medium text-slate-700 mb-1">
                Comparative Baseline (Optional)
              </label>
              <select
                id="baseline"
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">No baseline comparison (standalone run)</option>
                {baselines.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({new Date(b.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Select an existing run to detect confounding variables or setting regressions.
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="persistTranscript"
                  checked={persistTranscript}
                  onChange={(e) => setPersistTranscript(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="persistTranscript" className="text-sm font-medium text-slate-800">
                  Persist raw transcript text in database
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1 pl-6">
                When unchecked, only the SHA-256 integrity hash and extracted parameters will be stored.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400" />
            <span>AI extracts facts only. Scientific auditing is executed deterministically.</span>
          </div>

          <button
            type="submit"
            disabled={loading || !transcript.trim()}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting & Auditing...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Submit & Run Audit</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
