# Connected ML experiment review

Experiment Guardian can now start a review from a GitLab merge request URL and a run ID from a standalone MLflow server or GitLab's MLflow-compatible experiment tracking. Code, metrics, datasets, and model files remain in their original systems. Guardian saves read-only metadata snapshots and source links in SQLite, compares them with its experiment record, and keeps earlier snapshots when a run is refreshed.

## 1. Configure the backend

Set these server-side environment variables (also listed in `.env.example`):

```env
GITLAB_BASE_URL=https://gitlab.com
GITLAB_TOKEN=
GITLAB_TRAINING_CONFIG_PATH=experiment-guardian.json
MLFLOW_TRACKING_URL=https://your-mlflow-server.example.com
MLFLOW_TOKEN=
APP_ACCESS_PASSWORD=
```

For GitLab's own model experiment tracking, use its MLflow tracking endpoint instead:

```text
MLFLOW_TRACKING_URL=https://gitlab.com/api/v4/projects/PROJECT_ID/ml/mlflow
```

The GitLab token reads the merge request, pinned commit, and training config. The MLflow token reads a run and its artifact listing. Public sources may work without connector tokens. When linked evidence access is configured, `APP_ACCESS_PASSWORD` (at least 12 characters) is required; browsers use HTTP Basic sign-in with username `researcher` and that password. This is one shared-access safeguard for a demo deployment, not company-grade identity or reviewer roles. Keep all tokens in backend environment variables and CI secret variables, never in the browser or repository.

For GitLab's MLflow-compatible endpoint, set `MLFLOW_TOKEN` to a GitLab token authorized for that project's experiment tracking (it can be the same secret used for `GITLAB_TOKEN`).

### Current demo evidence

The demo merge request is [miko-keng/data-science-ci-example!1](https://gitlab.com/miko-keng/data-science-ci-example/-/merge_requests/1). Its head commit is `2d95c4d7e9136ea70946b6cd4cca2d8edb141729`. A real local training run logged accuracy `0.8947368421052632` to that project's GitLab MLflow endpoint, with run ID `e9cf4088-1ebe-44c5-bdcf-9c79007cad1f`. Use project ID `87814901` in `MLFLOW_TRACKING_URL` and the MR URL plus run ID in Guardian's linked review form.

The public GitLab MLflow run endpoint returned HTTP 401 without a token, so this demo needs `MLFLOW_TOKEN` and therefore `APP_ACCESS_PASSWORD`. The merge request is public, so `GITLAB_TOKEN` can remain empty. The user logged the run locally because GitLab-hosted CI requested identity verification. The MR's failed pipeline is not evidence that the local MLflow run failed. The Guardian import itself still needs to be exercised after deployment with the token configured.

The backend accepts merge request URLs only from `GITLAB_BASE_URL` and contacts only the configured GitLab and MLflow addresses. HTTPS is required outside localhost. Redirects are rejected.

## 2. Log an identifiable run

The comparison recognizes common MLflow keys:

| Evidence | MLflow parameter, tag, or metric |
| --- | --- |
| Seed | parameter `random_seed` or `seed` |
| Learning rate | parameter `learning_rate` or `lr` |
| Dataset version | parameter/tag `dataset_version` |
| Dataset hash | parameter/tag `dataset_hash`, or MLflow dataset digest |
| Accuracy | metric `accuracy`, `test_accuracy`, or `val_accuracy` |
| Source commit | tag `git.commit`, `git_commit`, `commit_sha`, or `gitlab.CI_COMMIT_SHA` |
| Baseline | tag/parameter `baseline_run_id` |

For comparison with a pinned repository configuration, add `experiment-guardian.json` at the merge request head commit (or set `GITLAB_TRAINING_CONFIG_PATH`):

```json
{"randomSeed":42,"learningRate":0.001}
```

The run's artifact list is inspected for an evaluation script, checkpoint, and dependency lockfile. Missing values remain visible as findings; the importer never fills them by guessing. Artifact listing metadata is evidence that a path was reported by MLflow, not a byte-level hash check of a remote model or dataset.

## 3. Link and review

Open **Experiments → Review an existing ML run**, paste the merge request URL and run ID, and choose **Start review**. No notes or model access are required for this path. Guardian fetches the exact merge request head commit and its config, the selected run, metrics, parameters, dataset metadata, and artifact references. It saves an immutable snapshot, creates an experiment record, and runs deterministic rules.

On the experiment page, review the source links and findings. **Refresh evidence** fetches again and appends another snapshot. You can supply a different run ID to correct a mistaken link. Earlier snapshots remain available. **Discuss this run in the Alexa lab** opens an MCP-backed session linked to the same experiment; typed or browser-voice observations can preserve rationale and propose a correction that requires approval. The existing revision controls also support approval and rejection. After an approved change or refreshed evidence, the audit is rerun.

If you already have an experiment created from notes, use **Linked GitLab and MLflow evidence** on its detail page to attach the two sources and compare its claims with the actual run.

## 4. Show an advisory result in GitLab

Copy `examples/ci/gitlab-experiment-quality.yml` into the ML project's `.gitlab-ci.yml` (or include the job in an existing pipeline) and make `scripts/gitlab-advisory-review.mjs` available in that repository. Set these CI variables:

```text
EXPERIMENT_GUARDIAN_URL=https://your-guardian.example.com
EXPERIMENT_GUARDIAN_ACCESS_PASSWORD=...   # only when APP_ACCESS_PASSWORD is set
EXPERIMENT_GUARDIAN_GITLAB_TOKEN=...       # optional, adds/updates an MR note
```

The job looks up the linked review from the merge request URL, compares the snapshot's commit with `CI_COMMIT_SHA`, and prints `PASS`, `WARN`, `FAIL`, `STALE`, `UNLINKED`, or `UNAVAILABLE`, plus a review link. With `EXPERIMENT_GUARDIAN_GITLAB_TOKEN`, it also adds or updates a note on the merge request so the result is visible in the overview. The job **always exits successfully** because this first integration is advisory. A future protected blocking gate requires project identity, reviewer roles, and a policy for exceptions.

## Limits

- The connected review has compiled locally. The GitLab MR and MLflow run above exist, but Guardian's importer has not yet been exercised against them with server-side credentials.
- The optional Bedrock and Amazon Transcribe adapters retain their existing configuration and access requirements. The linked-run workflow does not depend on them.
- SQLite and shared Basic access are suitable for a demo or a small trusted deployment. A company rollout needs user identity, per-project authorization, durable managed storage, and a controlled connector credential model.
