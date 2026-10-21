import { z } from "zod";
import { config } from "../config/env.js";
import { db } from "../database/connection.js";
import { artifactRepository } from "../database/artifact-repository.js";
import { linkedEvidenceRepository } from "../database/linked-evidence-repository.js";
import { experimentRepository } from "../database/experiment-repository.js";
import { auditService } from "./audit-service.js";
import crypto from "crypto";
import type { Experiment } from "../extraction/experiment-schema.js";

export const LinkEvidenceSchema = z.object({
  mergeRequestUrl: z.string().trim().url(),
  runId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,128}$/, "Invalid MLflow run ID"),
  title: z.string().trim().max(160).optional(),
  demoScenario: z.literal("iris-composite").optional(),
});

export const IRIS_DEMO = {
  mergeRequestUrl: "https://gitlab.com/miko-keng/data-science-ci-example/-/merge_requests/1",
  runId: "e9cf4088-1ebe-44c5-bdcf-9c79007cad1f",
  draftNote: "Unverified draft note for the Iris run: random seed 7, learning rate 0.01, and dataset version v2. The train/test split was not written down. Compare these claims with the linked run before accepting them.",
} as const;

function serviceUrl(base: string, path: string): URL {
  const url = new URL(`${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Evidence service URLs must use HTTPS, except localhost development services");
  }
  if (url.username || url.password) throw new Error("Put service tokens in environment variables, not URLs");
  return url;
}

async function readJson(url: URL, headers: Record<string, string>): Promise<any> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers }, redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Evidence source returned HTTP ${response.status} for ${url.pathname}`);
  if (Number(response.headers.get("content-length") || 0) > 2_000_000) throw new Error("Evidence response is too large");
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("Evidence response is too large");
  return JSON.parse(text);
}

function pairs(items: any): Record<string, string> {
  return Object.fromEntries((Array.isArray(items) ? items : [])
    .filter((item) => typeof item?.key === "string")
    .map((item) => [item.key, String(item.value ?? "")]));
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function first(map: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) if (map[key]) return map[key];
  return null;
}

function parseMergeRequest(input: string) {
  const url = new URL(input);
  const base = serviceUrl(config.gitlabBaseUrl, "");
  if (url.origin !== base.origin || url.username || url.password || url.search || url.hash) {
    throw new Error("Use a merge request URL from the configured GitLab server");
  }
  const prefix = base.pathname.replace(/\/$/, "");
  if (prefix && !url.pathname.startsWith(`${prefix}/`)) throw new Error("Merge request URL is outside the configured GitLab path");
  const projectAndIid = url.pathname.slice(prefix.length).match(/^\/(.+)\/-\/merge_requests\/(\d+)\/?$/);
  if (!projectAndIid) throw new Error("Expected a GitLab URL ending in /-/merge_requests/<number>");
  return { projectPath: decodeURI(projectAndIid[1]), iid: Number(projectAndIid[2]), url: url.toString() };
}

export class LinkedEvidenceService {
  async import(experimentId: string | null, input: z.infer<typeof LinkEvidenceSchema> & { previewOnly?: boolean }) {
    const existing = experimentId ? experimentRepository.findById(experimentId) : null;
    if (experimentId && !existing) throw new Error("Experiment not found");
    if (input.demoScenario && (experimentId || input.mergeRequestUrl !== IRIS_DEMO.mergeRequestUrl || input.runId !== IRIS_DEMO.runId)) {
      throw new Error("The connected judge scenario is available only for its documented Iris merge request and run");
    }
    if (!config.mlflowTrackingUrl) throw new Error("Set MLFLOW_TRACKING_URL on the backend before linking a run");
    const mr = parseMergeRequest(input.mergeRequestUrl);
    const gitlabHeaders: Record<string, string> = {};
    if (config.gitlabToken) gitlabHeaders["PRIVATE-TOKEN"] = config.gitlabToken;
    const project = encodeURIComponent(mr.projectPath);
    const mrData = await readJson(serviceUrl(config.gitlabBaseUrl,
      `api/v4/projects/${project}/merge_requests/${mr.iid}`), gitlabHeaders);
    const sha = String(mrData?.sha || mrData?.diff_refs?.head_sha || "");
    if (!/^[a-f0-9]{40,64}$/i.test(sha)) throw new Error("GitLab did not return a valid merge request head commit");
    const commitData = await readJson(serviceUrl(config.gitlabBaseUrl,
      `api/v4/projects/${project}/repository/commits/${sha}`), gitlabHeaders);
    if (String(commitData?.id || "").toLowerCase() !== sha.toLowerCase()) {
      throw new Error("GitLab returned a different commit than the merge request head");
    }
    const commitUrl = `${config.gitlabBaseUrl}/${mr.projectPath}/-/commit/${sha}`;
    const configPath = config.gitlabTrainingConfigPath.replace(/^\/+/, "");
    const configUrl = serviceUrl(config.gitlabBaseUrl,
      `api/v4/projects/${project}/repository/files/${encodeURIComponent(configPath)}/raw`);
    configUrl.searchParams.set("ref", sha);
    let trainingConfig: Record<string, unknown> | null = null;
    try {
      const value = await readJson(configUrl, gitlabHeaders);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Training config must contain a JSON object");
      trainingConfig = value;
    } catch (error: any) {
      if (!String(error?.message).includes("HTTP 404")) throw error;
    }
    const mlflowHeaders: Record<string, string> = {};
    if (config.mlflowToken) mlflowHeaders.Authorization = `Bearer ${config.mlflowToken}`;
    const tracking = config.mlflowTrackingUrl;
    const runUrl = serviceUrl(tracking, "api/2.0/mlflow/runs/get");
    runUrl.searchParams.set("run_id", input.runId);
    const runResponse = await readJson(runUrl, mlflowHeaders);
    const run = runResponse?.run;
    if (!run || String(run.info?.run_id || run.info?.run_uuid || "") !== input.runId) {
      throw new Error("MLflow returned a different run ID");
    }
    const gitlabTracking = tracking.includes("/api/v4/projects/") && tracking.includes("/ml/mlflow");
    const artifactUri = String(run.info?.artifact_uri || "");
    const artifactRoot = gitlabTracking && artifactUri.startsWith("mlflow-artifacts:")
      ? new URL(artifactUri).pathname.replace(/^\/+|\/+$/g, "") : "";
    const artifacts: Array<{ path: string; isDir: boolean; fileSize: number | null }> = [];
    let artifactListingStatus: "verified" | "unavailable" = "unavailable";
    const gitlabProjectId = tracking.match(/\/api\/v4\/projects\/(\d+)\/ml\/mlflow\/?$/)?.[1];
    const packageUri = gitlabTracking && artifactUri.startsWith("https:") ? new URL(artifactUri) : null;
    const packageParts = packageUri?.origin === new URL(config.gitlabBaseUrl).origin
      ? packageUri?.pathname.match(/^\/api\/v4\/projects\/(\d+)\/packages\/generic\/(ml_experiment_[^/]+)\/([^/]+)\/?$/) : null;
    if (gitlabTracking && packageParts && packageParts[1] === gitlabProjectId) {
      const packagesUrl = serviceUrl(config.gitlabBaseUrl, `api/v4/projects/${gitlabProjectId}/packages`);
      packagesUrl.searchParams.set("package_type", "generic");
      packagesUrl.searchParams.set("package_name", packageParts[2]);
      packagesUrl.searchParams.set("package_version", packageParts[3]);
      packagesUrl.searchParams.set("per_page", "100");
      const packages = await readJson(packagesUrl, mlflowHeaders);
      for (const pkg of Array.isArray(packages) ? packages : []) {
        if (pkg.name !== packageParts[2] || pkg.version !== packageParts[3] || !Number.isInteger(pkg.id)) continue;
        const filesUrl = serviceUrl(config.gitlabBaseUrl,
          `api/v4/projects/${gitlabProjectId}/packages/${pkg.id}/package_files`);
        filesUrl.searchParams.set("per_page", "100");
        const files = await readJson(filesUrl, mlflowHeaders);
        for (const file of Array.isArray(files) ? files : []) {
          artifacts.push({ path: String(file.file_name || ""), isDir: false,
            fileSize: typeof file.size === "number" ? file.size : null });
          if (artifacts.length >= 100) break;
        }
        if (artifacts.length >= 100) break;
      }
      artifactListingStatus = "verified";
    } else if (!gitlabTracking || (artifactRoot && !artifactRoot.split("/").includes(".."))) {
      const directories = [""];
      while (directories.length && artifacts.length < 100) {
        const path = directories.shift()!;
        const artifactUrl = serviceUrl(tracking, gitlabTracking
          ? "api/2.0/mlflow-artifacts/artifacts" : "api/2.0/mlflow/artifacts/list");
        if (gitlabTracking) artifactUrl.searchParams.set("path", [artifactRoot, path].filter(Boolean).join("/"));
        else {
          artifactUrl.searchParams.set("run_id", input.runId);
          if (path) artifactUrl.searchParams.set("path", path);
        }
        const response = await readJson(artifactUrl, mlflowHeaders);
        for (const item of Array.isArray(response?.files) ? response.files : []) {
          const entry = { path: String(item.path || ""), isDir: Boolean(item.is_dir),
            fileSize: typeof item.file_size === "number" ? item.file_size : null };
          artifacts.push(entry);
          if (entry.isDir && entry.path.split("/").length <= 3 && directories.length < 20) directories.push(entry.path);
          if (artifacts.length >= 100) break;
        }
      }
      artifactListingStatus = "verified";
    }
    const params = pairs(run.data?.params);
    const tags = pairs(run.data?.tags);
    const metrics = Object.fromEntries((Array.isArray(run.data?.metrics) ? run.data.metrics : [])
      .filter((item: any) => typeof item?.key === "string" && Number.isFinite(Number(item.value)))
      .map((item: any) => [item.key, Number(item.value)]));
    const datasetInputs = Array.isArray(run.inputs?.dataset_inputs) ? run.inputs.dataset_inputs : [];
    const datasetTag = datasetInputs[0]?.tags || [];
    const datasetTags = pairs(datasetTag);
    const source = { mergeRequest: mr.url, commit: commitUrl,
      config: `${config.gitlabBaseUrl}/${mr.projectPath}/-/blob/${sha}/${configPath}`,
      run: gitlabTracking
        ? `${config.gitlabBaseUrl}/${mr.projectPath}/-/ml/experiments`
        : `${tracking}/#/experiments/${encodeURIComponent(String(run.info?.experiment_id || ""))}/runs/${encodeURIComponent(input.runId)}` };
    const observed = {
      randomSeed: number(first(params, ["random_seed", "seed", "randomSeed"])),
      learningRate: number(first(params, ["learning_rate", "lr", "learningRate"])),
      datasetVersion: first(params, ["dataset_version", "datasetVersion"]) || first(tags, ["dataset_version"]) || first(datasetTags, ["version"]),
      datasetHash: first(params, ["dataset_hash", "dataset_identifier", "datasetHash"]) || first(tags, ["dataset_hash"]) || first(datasetTags, ["hash"]) ||
        (typeof datasetInputs[0]?.dataset?.digest === "string" ? datasetInputs[0].dataset.digest : null),
      accuracy: number(metrics.accuracy ?? metrics.test_accuracy ?? metrics.val_accuracy),
      codeCommit: first(tags, ["git.commit", "git_commit", "commit_sha", "gitlab.CI_COMMIT_SHA"]),
      baselineRunId: first(tags, ["baseline_run_id"]) || first(params, ["baseline_run_id"]),
      configRandomSeed: number(trainingConfig?.randomSeed ?? trainingConfig?.seed),
      configLearningRate: number(trainingConfig?.learningRate ?? trainingConfig?.learning_rate),
    };
    const evidence = { source, gitlab: { title: String(mrData.title || ""), sha,
      commitTitle: String(commitData.title || ""), committedDate: String(commitData.committed_date || ""),
      projectPath: mr.projectPath, iid: mr.iid, trainingConfig },
      mlflow: { runId: input.runId, experimentId: String(run.info?.experiment_id || ""),
        artifactUri, artifactListingStatus, params, metrics, tags, artifacts,
        datasetInputs: datasetInputs.slice(0, 20) }, observed };
    if (input.previewOnly) return {
      previewOnly: true,
      mergeRequestUrl: mr.url,
      commitSha: sha,
      trainingConfigFound: Boolean(trainingConfig),
      runId: input.runId,
      observed,
      artifactListingStatus,
    };
    const result = db.transaction(() => {
      const now = new Date().toISOString();
      const demo = input.demoScenario === "iris-composite";
      const experiment: Experiment = existing || {
        id: crypto.randomUUID(), title: demo ? "Iris review — draft note versus linked run" : input.title || String(mrData.title || "Linked ML experiment"),
        hypothesis: null, objective: null, status: "auditing",
        model: { architecture: null, modelName: first(params, ["model_name", "model"]),
          modelVersion: null, parameters: {} },
        dataset: { datasetName: first(params, ["dataset_name"]),
          datasetVersion: demo ? "v2" : observed.datasetVersion, datasetIdentifier: observed.datasetHash,
          trainSplit: null, validationSplit: null, testSplit: null, preprocessing: {} },
        training: { learningRate: demo ? 0.01 : observed.learningRate, batchSize: number(params.batch_size),
          epochs: number(params.epochs), optimizer: params.optimizer || null,
          randomSeed: demo ? 7 : observed.randomSeed, framework: params.framework || null,
          frameworkVersion: params.framework_version || null, environment: {}, otherParameters: {} },
        evaluation: { metrics: observed.accuracy === null ? {} : { accuracy: observed.accuracy },
          evaluationProcedure: null, evaluationDatasetIdentifier: null,
          codeCommit: sha, notes: null },
        baselineExperimentId: null,
        source: { sourceType: "manual", sourceId: null, sourceReference: demo ? "judge-demo:iris-composite-draft" : mr.url,
          transcriptText: demo ? IRIS_DEMO.draftNote : null,
          transcriptHash: demo ? crypto.createHash("sha256").update(IRIS_DEMO.draftNote).digest("hex") : null, sourceTimestamp: now },
        extractedAt: null, createdAt: now, updatedAt: now,
      };
      if (!existing) experimentRepository.create(experiment, experiment.source);
      const snapshot = linkedEvidenceRepository.create({ experimentId: experiment.id, gitlabMrUrl: mr.url,
        gitlabProjectPath: mr.projectPath, gitlabMrIid: mr.iid, gitlabCommitSha: sha,
        mlflowRunId: input.runId, mlflowTrackingUrl: tracking, evidence });
      if (!artifactRepository.getPolicy(experiment.id)) artifactRepository.setPolicy(experiment.id, "linked-ml-review");
      const audit = auditService.runAuditForExperiment(experiment);
      return { experiment, snapshot, audit };
    })();
    return result;
  }
}

export const linkedEvidenceService = new LinkedEvidenceService();
