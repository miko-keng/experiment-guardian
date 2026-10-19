# Demo video script — under three minutes

## 0:00–0:20 — Problem and promise

“Research decisions are often trapped in meetings, voice notes, and memory. Experiment Guardian is an Alexa+ reproducibility copilot that turns those conversations into traceable experiment records while the work is happening.”

Show the Alexa+ Lab Copilot home and the Research Decision Observatory.

## 0:20–0:55 — Capture the experiment

Start a session and say or paste:

> We trained a ResNet classifier on dataset version two. We used batch size 32 and learning rate 0.001 for 20 epochs. Accuracy improved to 91 percent.

Show the MCP timeline while `create_experiment_from_transcript` runs. Point out that Alexa+ coordinates the workflow and Experiment Guardian keeps the structured evidence.

## 0:55–1:25 — Proactive reproducibility audit

Show the resulting audit and Alexa+'s follow-up question about the missing random seed or code commit.

Answer:

> The random seed was 42 because we wanted an exact comparison with the baseline.

Show the captured rationale and proposed revision.

## 1:25–1:55 — Safe approval

Show the approval card. Explain that Alexa+ cannot silently change the experiment record. Select **Approve and re-audit** and show the immutable revision plus new audit result.

## 1:55–2:25 — Report and evidence

Finish the session. Show the generated reproducibility report, audit history, source evidence, and tool activity.

## 2:25–2:45 — Input choices

Briefly show browser microphone input and the document import control. Mention that the code also contains Amazon Bedrock, Amazon Transcribe/S3, and Bee adapters, while this repeatable judging build uses browser voice and deterministic extraction because the supplied accounts blocked the live services.

## 2:45–2:58 — Close

“Experiment Guardian gives Alexa+ an important research role: listen continuously, recover missing context, govern changes, and leave behind evidence another researcher can actually reproduce.”

End on the report and MCP activity view.

## Evidence-focused alternative (under three minutes)

1. Load **Demo A · Stored configuration conflict**. Open its experiment page and show the note's seed 42 and dataset v2 beside the stored run's seed 7 and dataset v1. Point to the three deterministic rule IDs and the `block` gate.
2. Load **Demo B · Missing result evidence**. Show the 91% claim and the absent evaluation script, result artifact, and checkpoint. Explain that a claim is not automatically verified.
3. Attach a relevant file or approve a proposed correction, then show the new audit run and the earlier finding retained in history. State that fixture metadata remains `user_confirmed`; uploaded file bytes can be hash-verified.
4. Open the Alexa+ Lab Copilot session and MCP timeline. State clearly that the web experience simulates Alexa+ while making real MCP calls, and that Bedrock extraction is in mock mode unless a live model is configured.

## Connected ML review alternative

1. Open [the demo merge request](https://gitlab.com/miko-keng/data-science-ci-example/-/merge_requests/1) and show commit `2d95c4d7` and `experiment-guardian.json` with seed 42 and learning rate 0.1.
2. Show the locally logged GitLab MLflow run `e9cf4088-1ebe-44c5-bdcf-9c79007cad1f`, its accuracy metric, parameters, and matching commit tag. State that GitLab-hosted CI required account verification, so this run was executed locally and sent to GitLab through the MLflow API.
3. In Guardian, paste the MR URL and run ID into **Review an existing ML run**. Show the pinned evidence snapshot, deterministic comparison, and any missing-artifact findings. Record the review status as observed; do not imply a passing gate if findings remain.
4. Open **Discuss this run in the Alexa lab** to show the MCP-backed conversational follow-up and approval flow. Finish with the report and evidence history.
