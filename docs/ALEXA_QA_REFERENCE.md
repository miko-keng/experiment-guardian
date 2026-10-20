# Alexa+ simulation: questions, supported answers, and expected behavior

This documents **every question shape selected by the current deterministic follow-up code** in `backend/src/services/alexa-session-service.ts`, plus the finding-investigation chat in `backend/src/services/finding-investigation-service.ts`. It is a judge reference, not a claim that a live Alexa+ or LLM client is running. The web simulation makes real MCP tool calls; its question selection and example corrections are rule-based. Use [the single recommended Iris demo](JUDGE_DEMO.md) for the video.

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
| Dataset differs from manifest (`DATASET_VERSION_MISMATCH`) | “The note and stored dataset manifest disagree. Which dataset version and hash were used?” | Check the manifest. If the record's version is wrong, type `The dataset version v1 was used because the manifest identifies v1.` | Can propose a version change. **The chat does not set the dataset hash**, so a hash conflict may remain. Correct the evidence or propose a separate approved identifier change. |
| Result artifact missing (`MISSING_RESULT_ARTIFACT`) | “Can you attach the evaluation output that supports the reported accuracy?” | Attach the real evaluation output in the experiment's artifact controls. | Typing “yes” does not attach a file or clear the finding. Re-audit after adding evidence. |
| Evaluation script missing (`MISSING_EVALUATION_SCRIPT`) | “Can you attach the evaluation script used for this result?” | Attach the actual evaluation script in the experiment's artifact controls. | Text alone does not verify a script. |
| Checkpoint missing (`MISSING_MODEL_CHECKPOINT`) | “Can you attach the model checkpoint for this result?” | Attach the actual checkpoint in the experiment's artifact controls. | Text alone does not verify a checkpoint. |
| Any other open finding, including an unlogged baseline or unavailable linked artifact listing | “Can you clarify: {finding title}?” | State the known context, then inspect the linked source or correct its metadata. | The observation is saved; the same finding can be asked again if no supporting structured evidence changed. For a missing baseline, log `baseline_run_id` in MLflow and refresh evidence. For unavailable artifact listing, investigate the linked run; artifact presence remains unknown. |
| No open findings | “The current audit has no follow-up question.” | No answer required. | Continue or finish the session. |

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

The number comes from the current audit. It is **2** in the recommended Iris video only when the three documented starting findings are present and the `75/25` split revision is approved.

## Finding investigation chat

On an experiment detail page, **Investigate with Alexa+ Simulator** opens a conversation for a selected finding. The first comment is stored and the response repeats that finding's stored **description** and **recommendation**, ending with:

> I have not changed the experiment.

A follow-up beginning `Why`, `Explain`, `Show me the evidence`, or `What evidence` returns the deterministic rule ID, stored evidence, and recommendation. It is read-only. For example, on **Run artifacts could not be verified**, enter `Why is the artifact status unknown?` to see `LINKED_ARTIFACT_LIST_UNAVAILABLE` and the explanation that GitLab's artifact location could not be listed through a supported API. It does not claim that artifacts are absent.

Other follow-up text is treated as an observation. Only the value patterns above can produce a structured proposal; an arbitrary question is not handled by a general-purpose LLM in the current public demo. If an observation does not resolve the selected finding, the same question can reappear. The owner should answer by checking evidence, attaching files, or refreshing the linked run rather than repeatedly guessing in chat.
