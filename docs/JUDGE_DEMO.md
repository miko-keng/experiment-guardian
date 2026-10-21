# Judge demo: one connected Iris review

**Record this scenario.** Guardian starts from an intentionally inaccurate draft research note, fetches a real GitLab merge request and MLflow run, compares the claims, then continues the *same Guardian experiment* in the Alexa+ web simulation. The browser makes real Streamable HTTP MCP calls. Question selection is deterministic; this is not a live Alexa+ or Bedrock LLM integration.

The product checks whether the available research claims, code version, and run evidence are present and consistent. It does not prove scientific truth, read every changed line in the merge request, or let an autonomous Alexa+ agent select tools. The React simulation selects Guardian MCP tools in its event handlers. In this linked review, it does not call Bedrock. A separate *new note or transcript* path can use Bedrock for structured extraction if live access is enabled; the current repeatable judging setup uses the mock extractor.

**Main story:** human intent → GitLab merge-request head commit → MLflow run → pinned evidence snapshot → deterministic findings → MCP-guided correction → approval → re-audit and report.

The draft is a **test claim**, not a statement about the real run. The linked run is the source of truth for seed, learning rate, and dataset version. An unlogged baseline and unavailable artifact listing remain unresolved. Guardian never treats an unavailable listing as proof that files are absent.

## Last verified source check

The connected scenario uses [the Iris merge request](https://gitlab.com/miko-keng/data-science-ci-example/-/merge_requests/1) and MLflow run `e9cf4088-1ebe-44c5-bdcf-9c79007cad1f`. The button requires `MLFLOW_TRACKING_URL` and valid server-side access. On 21 October 2026, the deployed app's **read-only source check** fetched the public MR and private MLflow run through its configured token. It returned commit `2d95c4d7e9136ea70946b6cd4cca2d8edb141729`, seed `42`, learning rate `0.1`, dataset version `sklearn-iris`, and artifact listing `unavailable`. The complete create-review and MCP path passed against simulated source responses in a disposable database; a live review has not been created by this verification. Read deployed findings before narrating exact counts. If external access fails, use the independent ResNet fixture in [Scenario question and answer guide](JUDGE_SCENARIOS.md).

## How one review stays linked

The merge request URL and run ID are external evidence. **Launch connected judge demo** supplies the sample `experiment-guardian.json` path automatically, creates a Guardian experiment UUID, saves a pinned snapshot, and opens `/experiments/<id>`. **Discuss this run in the Alexa lab** opens `/lab?experiment=<same-id>`. **Start session** creates a separate session ID associated with that experiment. Observations and approved corrections update the *same review*. The top navigation **Alexa+ Lab** opens an independent session, so use the detail-page link.

The stored draft is [here](../examples/demo/iris-composite-draft.txt): seed `7`, learning rate `0.01`, dataset version `v2`, and no split. The previously observed run recorded seed `42`, learning rate `0.1`, dataset version `sklearn-iris`, commit `2d95c4d7e9136ea70946b6cd4cca2d8edb141729`, and accuracy about `0.8947`. Live evidence can change.

## Pre-recording check

1. Open [Experiment Guardian](https://experiment-guardian.onrender.com) and sign in before capturing the screen. Do not show credentials, connector tokens, or environment settings in the video.
2. Open **Experiments** and confirm **Launch connected judge demo** is visible.
3. Rehearse **Launch connected judge demo** and confirm the linked evidence loads. Read the displayed MR head commit, run ID, seed, learning rate, and dataset version. The documented values are a previously observed snapshot; live sources can change.
4. Keep [iris-review-note.txt](../examples/demo/iris-review-note.txt) ready, or use **Load Iris review example note** in the linked lab.
5. Use **Discuss this run in the Alexa lab** from the experiment detail page. The top navigation lab starts an independent session.
6. Rehearse the approvals and report once. Allow loading time, then trim the recording to under three minutes.

## What happens at each click

| Researcher action | Application behavior | Point to explain |
| --- | --- | --- |
| **Launch connected judge demo** | REST asks the backend to fetch the MR, its current head SHA, the selected JSON training file at that SHA, and the selected MLflow run. The backend creates a Guardian experiment UUID and stores a pinned evidence snapshot. | The SHA is a Git *commit*, not a comment. The review records the code version it inspected. This reads the selected file, not the full merge-request diff. |
| Inspect **Linked GitLab and MLflow evidence** | The page displays source links and the observed run values. Deterministic rules compare those values with the deliberately inaccurate draft. | MLflow records the run; the note is a claim. Missing artifact evidence remains unknown, not absent. |
| **Discuss this run in the Alexa lab → Start session** | The detail-page link carries the experiment UUID. The browser MCP client calls `start_experiment_session`, then `ask_next_reproducibility_question`; the new session ID points to the same experiment. | **Actual MCP activity** shows real tool calls. The browser simulation chooses which tool to call; this is not live Amazon Alexa+ routing. |
| Send the seed answer | `add_experiment_observation` saves the answer and makes a proposed revision for `training.randomSeed`. The experiment field is not changed yet. | A researcher's answer becomes a reviewable proposal. It does not override the pinned MLflow snapshot. |
| **Approve and re-audit** | `confirm_experiment_action` applies the stored proposal, records revision history in SQLite, and runs deterministic rules again. **Reject** leaves the experiment field unchanged. | Human approval separates conversation from record mutation. |
| **Import document**, preview, **Send to Alexa+** | REST extracts document text and returns a preview. Sending the reviewed text calls MCP `add_experiment_observation` with source provenance, proposing train/test split fields. | The document joins the existing review; it does not create a second experiment. If the researcher edits the preview, the provenance records that difference. |
| **Finish & report** | `finish_experiment_session` runs the final audit and generates a report with the current findings and history. | The report keeps unresolved baseline and artifact questions visible. |

The Research Decision Observatory visualizes session and tool events produced by this workflow. The tool timeline is the clearer proof of the MCP boundary; the observatory itself does not choose tools or run the audit.

## Video script: under three minutes

| Time | Click or action | Say briefly | What it proves |
| --- | --- | --- | --- |
| 0:00–0:20 | Show **Review an existing ML run**; click **Launch connected judge demo**. | “A researcher brings a draft note to a real code review and ML run.” | One entry point creates a connected review. |
| 0:20–0:55 | Show **Linked GitLab and MLflow evidence** and **Deterministic Audit Findings**. Point at seed `7` vs `42`, rate `0.01` vs `0.1`, dataset `v2` vs `sklearn-iris`. | “Guardian checks the note against the exact run and pinned commit. It also shows missing or unverified evidence.” | Three draft conflicts plus split, baseline, and artifact gaps. |
| 0:55–1:15 | Click **Discuss this run in the Alexa lab → Start session**. Show the question and **Actual MCP activity**. | “This conversation stays attached to the same review and calls MCP tools.” | Session linkage and visible tool trace. |
| 1:15–1:40 | Send the seed answer below; click **Approve and re-audit**. | “The researcher confirms the run's value. Guardian asks permission before changing the draft.” | Governed correction and a new audit. |
| 1:40–2:10 | Click **Import document**, select `iris-review-note.txt`, check the preview, send it, then approve. | “A meeting note adds the split and its rationale to the same review.” | Document provenance and second approval. |
| 2:10–2:40 | Click **Finish & report**. Show the report and remaining findings. | “The report keeps what we fixed and what still needs evidence.” | Unresolved issues remain open. |
| 2:40–2:55 | Hold on **Actual MCP activity** and linked evidence. | “Code, run data, discussion, and audit have one traceable path.” | End before three minutes. |

## Exact conversation for the recording

After **Start session**, the expected first question for the previously observed run is:

> The draft note says seed 7, but the linked MLflow run says 42. Which seed belongs to this result?

**Type and send exactly:**

```text
The random seed was 42 because the linked MLflow run records 42.
```

Alexa asks: “I captured training.randomSeed: 7 to 42. Should I apply this change and rerun the audit?” **Click Approve and re-audit.** Expected reply: “I applied the approved changes and reran the deterministic audit.” The seed mismatch should clear; other issues remain. **Reject** leaves the draft unchanged.

**Import document** selects [iris-review-note.txt](../examples/demo/iris-review-note.txt). The lab previews:

```text
The Iris run used a 75/25 data split because we wanted to keep a separate test set. No baseline run ID was logged for this initial run. The run artifacts have not been verified, so their presence is still unknown.
```

**Click Send to Alexa+.** Alexa asks: “I captured dataset.trainSplit: null to \"75%\"; dataset.testSplit: null to \"25%\". Should I apply these changes and rerun the audit?” **Click Approve and re-audit.** The split warning should clear; learning rate and dataset version conflicts, baseline, and artifact availability remain. The note supplies the split to Guardian; the pinned public training script uses `test_size=0.25`, but the importer does not currently extract that code fact into the audit.

**Click Finish & report.** Alexa says: “I finished the session. The final audit has N open findings. I opened the detailed reproducibility report.” `N` is calculated from the current evidence; do not memorize a count if external data changes.

## Accurate technology and CI claims

- **Alexa+:** this is a web simulation that calls Guardian's real MCP Streamable HTTP endpoint. It is not the official Alexa+ client or a real LLM acting as an MCP client.
- **Bedrock:** live Bedrock extraction is implemented for creation from a new note or transcript when configured and available. The connected Iris session uses deterministic question selection and revision parsing; it does not invoke Bedrock to decide tool calls or answer questions.
- **GitLab/MLflow:** the backend really fetches the MR, pinned training file, and selected run. The run was logged locally to GitLab MLflow. GitLab-hosted CI for the demo fork was blocked by account identity verification.
- **Advisory CI:** [the example job](../examples/ci/gitlab-experiment-quality.yml) can compare a review snapshot with `CI_COMMIT_SHA` and report `PASS`, `WARN`, `FAIL`, `STALE`, `UNLINKED`, or `UNAVAILABLE`. It may post an MR note when configured. Do not show or claim a live CI result unless that job has actually run in the target project. Its status is advisory and does not block a merge.
- **Artifacts:** an unavailable listing means Guardian cannot verify the files. It is not evidence that the files do not exist.

## If the live source is unavailable

If the MR or run fetch fails, do not present a fixture as live data. Explain that the external source is unavailable and show the independent fixture described in [the scenario guide](JUDGE_SCENARIOS.md). If the source values have changed, use the values on the new snapshot and do not repeat the old scripted numbers. If a proposed correction is unsupported, click **Reject** to show that the field stays unchanged.

## If a judge continues

[Scenario question and answer guide](JUDGE_SCENARIOS.md) covers every next prompt: learning rate, dataset version, missing hash, split, baseline, artifact listing, rejection, and finish. Each entry gives the exact text or click and expected Alexa action. If a reply offers no supported correction, Alexa saves it and explains why the finding stays open. **Ask next question** asks again from current findings; **Finish & report** closes the session.

## Judge self-service access

Username: researcher
Password: Orbit7!Canvas#Kestrel42-Moon

1. Sign in; open **Experiments** and click **Launch connected judge demo**.
2. Follow the seed answer above and approve.
3. Import the sample note or click **Load Iris review example note**, then approve the split.
4. Click **Finish & report**; inspect the original draft, pinned evidence, audit history, and MCP activity.

**Audit meeting notes** handles work without a run ID. The top navigation **Alexa+ Lab** starts an independent session. This recording uses **Experiments → connected review → Discuss this run** throughout.
