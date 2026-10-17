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
