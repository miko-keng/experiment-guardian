# Judge demo: one connected Iris review

**Record this scenario.** Guardian starts from an intentionally inaccurate draft research note, fetches a real GitLab merge request and MLflow run, compares the claims, then continues the *same Guardian experiment* in the Alexa+ web simulation. The browser makes real Streamable HTTP MCP calls. Question selection is deterministic; this is not a live Alexa+ or Bedrock LLM integration.

The draft is a **test claim**, not a statement about the real run. The linked run is the source of truth for seed, learning rate, and dataset version. An unlogged baseline and unavailable artifact listing remain unresolved. Guardian never treats an unavailable listing as proof that files are absent.

## Prepare

1. Open [Experiment Guardian](https://experiment-guardian.onrender.com) and sign in before recording. Keep the sign-in screen out of the video.
2. In **Experiments → Review an existing ML run**, click **Launch connected judge demo**. Guardian fetches [the Iris merge request](https://gitlab.com/miko-keng/data-science-ci-example/-/merge_requests/1) and MLflow run `e9cf4088-1ebe-44c5-bdcf-9c79007cad1f` using the server's configured access.
3. Have [iris-review-note.txt](../examples/demo/iris-review-note.txt) available for **Import document**, or use **Load Iris review example note** in the lab.

The button requires `MLFLOW_TRACKING_URL` and valid server-side access. On 21 October 2026, the deployed app's **read-only source check** fetched the public MR and private MLflow run through its configured token. It returned commit `2d95c4d7e9136ea70946b6cd4cca2d8edb141729`, seed `42`, learning rate `0.1`, dataset version `sklearn-iris`, and artifact listing `unavailable`. The complete create-review and MCP path passed against simulated source responses in a disposable database; a live review has not been created by this verification. Read deployed findings before narrating exact counts. If external access fails, use the independent ResNet fixture in [Scenario question and answer guide](JUDGE_SCENARIOS.md).

## How one review stays linked

The merge request URL and run ID are external evidence. **Launch connected judge demo** creates a Guardian experiment UUID, saves a pinned snapshot, and opens `/experiments/<id>`. **Discuss this run in the Alexa lab** opens `/lab?experiment=<same-id>`. **Start session** creates a separate session ID associated with that experiment. Observations and approved corrections update the *same review*. The top navigation **Alexa+ Lab** opens an independent session, so use the detail-page link.

The stored draft is [here](../examples/demo/iris-composite-draft.txt): seed `7`, learning rate `0.01`, dataset version `v2`, and no split. The previously observed run recorded seed `42`, learning rate `0.1`, dataset version `sklearn-iris`, commit `2d95c4d7e9136ea70946b6cd4cca2d8edb141729`, and accuracy about `0.8947`. Live evidence can change.

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
