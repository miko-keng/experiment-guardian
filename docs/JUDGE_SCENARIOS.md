# Judge scenario inputs and expected Alexa actions

This guide covers **every built-in demo card** and every follow-up question that can arise from the recommended connected Iris review. The Alexa+ Lab is a simulator that calls Guardian's real MCP endpoint. Its question selection and structured corrections are deterministic. Typed values are proposals; no experiment field changes until **Approve and re-audit** is clicked. After an approval, click **Ask next question** to continue through open findings. **Finish & report** is always available when an experiment exists.

The exact question depends on the current stored evidence. The prompts below are the expected sequence from the documented fixture or previously observed Iris run. If the live run changes, trust the linked run snapshot and use its displayed values rather than repeating an outdated answer.

## Connected composite Iris demo — recommended video

Start from **Experiments → Launch connected judge demo → Discuss this run in the Alexa lab → Start session**. The source is a deliberately flawed [draft note](../examples/demo/iris-composite-draft.txt), compared with a real MR and MLflow run. The first question is automatic. The table gives the text to type if a judge clicks **Ask next question** after each approval.

| Alexa question or situation | Judge types or clicks | Expected Alexa action |
| --- | --- | --- |
| “The draft note says seed 7, but the linked MLflow run says 42. Which seed belongs to this result?” | `The random seed was 42 because the linked MLflow run records 42.` | Proposes `training.randomSeed: 7 → 42`; asks for approval. **Approve and re-audit** clears only the draft seed conflict. |
| “The note says learning rate 0.01, but the linked run says 0.1. Which value produced this result?” | `The learning rate was 0.1 because the linked MLflow run records 0.1.` | Proposes `training.learningRate: 0.01 → 0.1`; approval clears that conflict. |
| “The note says dataset version v2, but the linked run says sklearn-iris. Which version produced this result?” | `The dataset version sklearn-iris was used because the linked run records sklearn-iris.` | Proposes `dataset.datasetVersion: "v2" → "sklearn-iris"`; approval clears that conflict. |
| “What training and test data split did you use?” | Import [iris-review-note.txt](../examples/demo/iris-review-note.txt) and send it, or type `We used a 75/25 data split because we kept a separate test set.` | Proposes train `75%` and test `25%`; approval clears the missing-split finding. The pinned training script uses `test_size=0.25`; Guardian does not yet parse it automatically. |
| “Can you clarify: Dataset hash missing from linked evidence?” — only if the run snapshot lacks a hash | `The linked run does not record a dataset hash. I will add the actual hash to MLflow and refresh evidence.` | Saves the note and explains the finding remains open; no hash is invented. Add the true hash at the source and refresh the linked snapshot. |
| “Can you clarify: Baseline run not logged?” | `No baseline run ID was logged for this initial run. We will log a real baseline run ID if we compare models.` | Saves the note and explains the finding remains open. A baseline ID must come from an actual MLflow run. |
| “Can you clarify: Run artifacts could not be verified?” | `The artifact listing is unavailable, so I cannot confirm whether the files are present. I will inspect the run.` | Saves the note; presence stays **unknown**. The app does not claim the files are missing. |
| A training config, run commit, or other source value is missing | `I will add the missing value to the source run or pinned commit and refresh evidence.` | Saves the note; the finding stays open. Correct the source, then use **Refresh evidence** on the experiment. |
| Alexa asks for approval after any proposed correction | Click **Approve and re-audit**, or click **Reject**. | Approval changes the Guardian record and reruns rules; rejection changes no experiment field. |
| No more questions are desired | Click **Finish & report**. | Reruns audit, generates report, and states the **current** number of open findings. |

The previously observed Iris run showed seed `42`, rate `0.1`, version `sklearn-iris`, and no logged baseline. The public GitLab MR, commit, and config were read successfully on 21 October 2026; the MLflow endpoint returned HTTP 401 without a token. A disposable-database integration run with simulated MLflow responses produced the first three conflict questions. Verify the token-backed run after deployment.

## Linked Iris walkthrough card

This card appears inside a linked experiment's lab and loads the same [Iris review note](../examples/demo/iris-review-note.txt). It does **not** create a new experiment. On a normal linked review, **Start session** typically asks “What training and test data split did you use?” Select **Load Iris review example note**, inspect its preview, then **Send to Alexa+**. Alexa proposes train `75%` and test `25%`; **Approve and re-audit** clears the split finding if the claim is correct. Baseline and artifact-listing questions use the answers in the composite table above.

## Independent built-in demo cards

Open the top navigation **Alexa+ Lab** without a linked experiment. Each card displays its first question, answer, and expected action. These local examples are fixtures; they do not claim to be the real Iris run.

### Demo A · Stored configuration conflict

**Automatic question:** “The note says seed 42, but the stored run says 7. Which run produced this result?”
**Type:** `The random seed was 7 because the stored run manifest records 7.`
**Alexa:** proposes seed `42 → 7`; **Approve and re-audit** clears the seed mismatch. Then click **Ask next question**.

**Next question:** “The note and stored dataset manifest disagree. Which dataset version and hash were used?”
**Type:** `The dataset version v1 was used because the stored manifest identifies v1.`
**Alexa:** proposes version `v2 → v1`; approval may leave the dataset-hash disagreement open. The fixture manifest hash is `sha256:dataset-v1-demo`; correct the identifier through the experiment's evidence/revision controls rather than claiming a chat message changed the hash.

**Remaining training-parameter question:** “Can you clarify: Missing training parameter?” or the finding title currently shown.
**Type:** `The stored training configuration has no learning rate. I will attach the correct config for this run.`
**Alexa:** saves the note and says the finding remains open. Text cannot manufacture the missing configuration.

### Demo B · Missing result evidence

**Automatic question:** “Can you attach the evaluation script used for this result?”
**Type:** `The evaluation script was not saved for this run. I will attach the real file when it is available.`
**Alexa:** saves the answer and explains the script finding remains open. Use the experiment detail page's artifact controls to attach an actual file. **Ask next question** will repeat the highest-priority open item until supporting evidence is added.

After an actual script is attached and the audit reruns, Alexa may ask “Can you attach the evaluation output that supports the reported accuracy?” or “Can you attach the model checkpoint for this result?” Upload the **actual** evaluation output or checkpoint in the experiment detail page. A typed “yes” never verifies an artifact. If unavailable, type `That file is not available for this run; I will locate it before resolving the finding.` Alexa saves the note and leaves the finding open.

### ResNet-50 reproducibility review

**Automatic question:** “What random seed did you use? Without it, another training run may differ.”
**Type:** `The random seed was 42 because we wanted a reproducible comparison.`
**Alexa:** proposes seed `42`; approve, then click **Ask next question**.

**Next question:** “Which dataset version did you use?”
**Type:** `The dataset version v1 was used because that is the frozen fixture version.`
**Alexa:** proposes `dataset.datasetVersion = "v1"`; approve. The fixture has no independent dataset hash.

**Next question:** “What training and test data split did you use?”
**Type:** `We used an 80/20 data split because the test set was held out.`
**Alexa:** proposes train `80%` and test `20%`; approve. **Finish & report** generates the final fixture report.

### Conflicting learning-rate discussion

The mock extractor now recognizes the explicitly stated **final** learning rate `0.001`, instead of the exploratory `0.01`. This fixture does not have a separate learning-rate conflict rule because no persisted final-run manifest is linked. Its audit asks for the missing reproducibility controls:

1. **Alexa:** “What random seed did you use? Without it, another training run may differ.” **Type:** `The random seed was 42 because we fixed it for the final run.` **Expected:** proposes seed `42`; approve.
2. **Alexa:** “Which dataset version did you use?” **Type:** `The dataset version v1 was used because the fixture dataset was frozen.` **Expected:** proposes version `v1`; approve.
3. **Alexa:** “What training and test data split did you use?” **Type:** `We used an 80/20 data split because the test set was held out.` **Expected:** proposes both splits; approve.

Click **Ask next question** after each approval. **Finish & report** closes the fixture. The connected Iris demo is the stronger example of a **real linked learning-rate conflict** between a draft claim and run evidence.

### Well-documented transformer experiment

The mock extractor captures IMDB dataset version `v1.0`, seed `42`, final learning rate `0.00002`, PyTorch version `2.7`, commit `a81c93f`, and the reported accuracy. It does not infer a numeric split from the phrase “fixed IMDB test split.”

**Automatic question:** “What training and test data split did you use?”
**Type:** `We used an 80/20 data split because the test set was held out.`
**Alexa:** proposes train `80%` and test `20%`; approve. **Ask next question** then returns “The current audit has no follow-up question.” **Finish & report** creates the report. The numeric split here is an illustrative fixture answer, not a claim about a real IMDB run.

## Shared controls and exact responses

| Action | Expected Alexa response |
| --- | --- |
| Type `Why was this flagged?` or click **Why was this flagged?** during any demo | “Rule [rule ID]: [stored description] Next: [stored recommendation].” This is a read-only, source-grounded answer about the currently selected finding; it does not propose a revision. |
| Approve any pending proposal | “I applied the approved changes and reran the deterministic audit.” |
| Reject a pending proposal | “I rejected the proposed changes. The experiment record was not changed.” |
| Send an observation that does not propose a supported field change | “I saved your answer. [Finding title] remains open. [Stored recommendation]” The exact title and recommendation come from the selected audit finding. |
| Click **Ask next question** with no open finding | “The current audit has no follow-up question.” |
| Click **Finish & report** | “I finished the session. The final audit has N open findings. I opened the detailed reproducibility report.” `N` is calculated, not hardcoded. |

For all other deterministic question templates and supported value patterns, see [Alexa+ question reference](ALEXA_QA_REFERENCE.md). Unknown values should be recorded as unknown; do not type a guessed value just to turn a finding green.
