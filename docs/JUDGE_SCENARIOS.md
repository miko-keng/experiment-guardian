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

The deployed app's read-only source check successfully fetched the public GitLab MR and private MLflow run on 21 October 2026. It returned seed `42`, rate `0.1`, version `sklearn-iris`, and artifact listing `unavailable`. A disposable-database integration run with simulated source responses produced the first three conflict questions and completed the approval/report flow. The read-only deployed check created no review record.

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

For all other deterministic question templates and supported value patterns, continue to the [general reference below](#general-question-templates-and-supported-answers). Unknown values should be recorded as unknown; do not type a guessed value just to turn a finding green.

## General question templates and supported answers

The scenarios above are the judge’s exact fixture routes. The following reference covers other finding types and the value patterns accepted by the deterministic session parser. A free-form question is not handled by a general-purpose LLM in the submitted demo.

## How to read the table

Question priority is: first critical finding, otherwise a finding about seed, commit, dataset version, framework version, or evaluation procedure, otherwise the first open finding. The exact finding and order can change when source evidence changes. Text in `{braces}` is filled from the current finding. A typed answer only proposes a correction when it matches one of the supported value patterns below. A proposal requires **Approve and re-audit**; simply answering does not silently change the record.

| When this finding is selected | Exact question or template | Safe example user input or action | Expected behavior |
| --- | --- | --- | --- |
| Seed missing (`training.randomSeed`) | “What random seed did you use? Without it, another training run may differ.” | `The random seed was 42 because we wanted a reproducible comparison.` | Proposes `training.randomSeed` to `42`; asks for approval. After approval, the audit reruns. Use the **actual** run seed. |
| Commit missing (`evaluation.codeCommit`) | “What code commit produced this result? This ties the result to exact code.” | `The code commit is a81c93f because that revision produced the run.` | Proposes `evaluation.codeCommit = "a81c93f"`; asks for approval. Use the actual commit, not this example value. |
| Dataset version missing (`dataset.datasetVersion`) | “Which dataset version did you use?” | `The dataset version v2 was used because it was frozen for this run.` | Proposes `dataset.datasetVersion = "v2"`; asks for approval. Dataset content/hash still needs independent evidence. |
| Framework version missing (`training.frameworkVersion`) | “Which framework version did you use?” | `We used PyTorch 2.7 because that was the training environment.` | Proposes `training.frameworkVersion = "2.7"`; asks for approval. |
| Evaluation procedure missing (`evaluation.evaluationProcedure`) | “How exactly did you evaluate the final model?” | `We evaluated once on the held-out test set.` | Records the observation. **Current chat parsing does not update the structured evaluation procedure**; the same question may reappear. A separate approved revision/evidence update is needed. |
| Split missing (`dataset.trainSplit`) | “What training and test data split did you use?” | `We used an 80/20 data split because the test set was held out.` | Proposes `dataset.trainSplit = "80%"` and `dataset.testSplit = "20%"`; asks for approval. The [video scenario](JUDGE_DEMO.md) uses the actual Iris `75/25` split instead. |
| Seed differs from run manifest (`SEED_MISMATCH`) | “The note says seed {previousValue}, but the stored run says {currentValue}. Which run produced this result?” | Inspect the manifest and run first. If the recorded claim is wrong, type `The random seed was 7 because the manifest for this run says 7.` | Proposes a correction to the claimed seed and asks for approval. If the manifest is wrong, attach the correct manifest instead. Never invent a number to clear the warning. |
| Draft seed differs from linked MLflow run (`LINKED_SEED_MISMATCH`) | “The draft note says seed {previousValue}, but the linked MLflow run says {currentValue}. Which seed belongs to this result?” | For the documented Iris run, type `The random seed was 42 because the linked MLflow run records 42.` | Proposes seed 42; approval reruns the audit. |
| Draft learning rate differs from linked run (`LINKED_LEARNING_RATE_MISMATCH`) | “The note says learning rate {previousValue}, but the linked run says {currentValue}. Which value produced this result?” | Type `The learning rate was 0.1 because the linked MLflow run records 0.1.` | Proposes rate 0.1; approval reruns the audit. |
| Draft dataset version differs from linked run (`LINKED_DATASET_VERSION_MISMATCH`) | “The note says dataset version {previousValue}, but the linked run says {currentValue}. Which version produced this result?” | Type `The dataset version sklearn-iris was used because the linked run records sklearn-iris.` | Proposes literal version `sklearn-iris`; approval reruns the audit. |
| Dataset differs from manifest (`DATASET_VERSION_MISMATCH`) | “The note and stored dataset manifest disagree. Which dataset version and hash were used?” | Check the manifest. If the record's version is wrong, type `The dataset version v1 was used because the manifest identifies v1.` | Can propose a version change. **The chat does not set the dataset hash**, so a hash conflict may remain. Correct the evidence or propose a separate approved identifier change. |
| Result artifact missing (`MISSING_RESULT_ARTIFACT`) | “Can you attach the evaluation output that supports the reported accuracy?” | Attach the real evaluation output in the experiment's artifact controls. | Typing “yes” does not attach a file or clear the finding. Re-audit after adding evidence. |
| Evaluation script missing (`MISSING_EVALUATION_SCRIPT`) | “Can you attach the evaluation script used for this result?” | Attach the actual evaluation script in the experiment's artifact controls. | Text alone does not verify a script. |
| Checkpoint missing (`MISSING_MODEL_CHECKPOINT`) | “Can you attach the model checkpoint for this result?” | Attach the actual checkpoint in the experiment's artifact controls. | Text alone does not verify a checkpoint. |
| Any other open finding, including an unlogged baseline or unavailable linked artifact listing | “Can you clarify: {finding title}?” | State the known context, then inspect the linked source or correct its metadata. | Alexa saves the observation and explains that the finding remains open. For a missing baseline, log `baseline_run_id` in MLflow and refresh evidence. For unavailable artifact listing, investigate the linked run; artifact presence remains unknown. |
| No open findings | “The current audit has no follow-up question.” | No answer required. | Continue or finish the session. |

In the lab, a judge can also type `Why was this flagged?` (or click the matching button) while an experiment is active. Alexa replies with the selected finding's rule ID, stored description, and recommendation. This is a deterministic, read-only answer rather than a general-purpose LLM response.

## Other recognized observation patterns

These can be typed during an active session even when Alexa+ asks a different question. They create **proposals only when the value differs** from the current record. Use values observed in the real run.

| Input pattern | Example | Proposed field(s) |
| --- | --- | --- |
| `seed 42` / `random seed was 42` | `The random seed was 42.` | `training.randomSeed` |
| `learning rate 0.001` | `The learning rate was 0.001.` | `training.learningRate` |
| `batch size 32` | `The batch size was 32.` | `training.batchSize` |
| `20 epochs` | `We trained for 20 epochs.` | `training.epochs` |
| `PyTorch 2.7` / `TensorFlow 2.16` | `We used PyTorch 2.7.` | `training.frameworkVersion` |
| `commit a81c93f` | `The code commit is a81c93f.` | `evaluation.codeCommit` |
| `dataset version v2` | `The dataset version v2 was used.` | `dataset.datasetVersion` |
| `75/25 data split` | `We used a 75/25 data split.` | `dataset.trainSplit` and `dataset.testSplit` |

Adding `because`, `since`, `chose`, or `decided` to an observation also stores a research-decision statement. This does not prove the statement is true; the audit compares structured claims to available evidence.

## Approval and finish: exact responses

When one or more values differ, Alexa+ says:

> I captured {field}: {old value} to {new value}. Should I apply this change and rerun the audit?

For multiple fields, it lists them separated by `;` and says **these changes**. The researcher can click **Approve and re-audit** or type `yes`, `approve`, `confirm`, `apply`, or `go ahead`. Expected approval response:

> I applied the approved changes and reran the deterministic audit.

Click **Reject** or type `no`, `reject`, `cancel`, or `do not apply` to leave the experiment unchanged. Expected response:

> I rejected the proposed changes. The experiment record was not changed.

Click **Finish & report** to rerun the audit and generate the report. Response template:

> I finished the session. The final audit has {number} open findings. I opened the detailed reproducibility report.

The number comes from the current audit. The connected composite demo deliberately has more initial findings than the plain linked Iris review; the final count changes with the actual source evidence and approved corrections.

## Finding investigation chat

On an experiment detail page, **Investigate with Alexa+ Simulator** opens a conversation for a selected finding. The first comment is stored and the response repeats that finding's stored **description** and **recommendation**, ending with:

> I have not changed the experiment.

A follow-up beginning `Why`, `Explain`, `Show me the evidence`, or `What evidence` returns the deterministic rule ID, stored evidence, and recommendation. It is read-only. For example, on **Run artifacts could not be verified**, enter `Why is the artifact status unknown?` to see `LINKED_ARTIFACT_LIST_UNAVAILABLE` and the explanation that GitLab's artifact location could not be listed through a supported API. It does not claim that artifacts are absent.

Other follow-up text is treated as an observation. Only the value patterns above can produce a structured proposal; an arbitrary question is not handled by a general-purpose LLM in the public demo. With no proposal, Alexa saves the answer and explains that the finding remains open. **Ask next question** selects from current findings again. The owner should check evidence, attach files, or refresh the linked run rather than guess in chat.
