# Experiment Guardian — User Story Engineering Specification

**Status:** Proposed for approval  
**Primary track:** Alexa+  
**Mini-challenge:** AWS Builder  
**Optional integration:** Bee  
**Purpose:** Translate the approved product direction into implementable user journeys, acceptance criteria, states, APIs, and demo scenarios.

---

## 1. Product Promise

> Speak, upload, or paste your research discussion. Experiment Guardian turns it into an evidence-linked experiment record, audits whether it can be reproduced, and helps you resolve the gaps through conversation.

The product reduces the work required to turn informal research discussions into a traceable experiment record. It does not replace scientific judgment. Bedrock extracts and explains, MCP exposes capabilities, and the deterministic audit engine decides which reproducibility checks pass or fail.

## 2. Actors

### 2.1 Researcher

Creates experiments, submits research material, reviews extraction, discusses audit findings, and approves or rejects revisions.

### 2.2 Collaborator

Participates in recorded discussions and may provide missing information. Collaboration permissions beyond a single local user are outside the first release.

### 2.3 Conversational Agent

Uses Experiment Guardian MCP tools to create, retrieve, audit, explain, and propose changes. It cannot bypass approval controls.

### 2.4 External MCP Client

An Alexa-style or other compatible client that discovers and invokes the same tools used by the first-party web assistant.

### 2.5 Optional Source Provider

Bee, browser speech recognition, document extraction, or Amazon Transcribe supplies source text with provenance.

## 3. Core User Journey

```text
Choose a source
  -> capture/import/paste
  -> review transcript or extracted text
  -> create structured experiment
  -> run deterministic audit
  -> inspect score, gaps, and evidence
  -> discuss findings with assistant
  -> propose missing values or corrections
  -> approve or reject revisions
  -> rerun audit
  -> generate evidence-linked report
```

Every entry path converges on the same experiment, evidence, audit, revision, and report services.

## 4. Experience States

A source moves through:

```text
draft -> processing -> ready_for_review -> confirmed -> extraction_running
      -> experiment_created -> audit_running -> audited
```

A session moves through:

```text
active -> waiting_for_tool -> waiting_for_approval -> active -> completed
```

A revision moves through:

```text
proposed -> approved -> applied
         -> rejected
         -> stale
```

The UI must present these states in human language and expose recovery actions for failures.

---

## 5. Epic A — Choose How to Start

### US-A1: View intake choices

**As a researcher, I want to see clear ways to submit my research discussion so that I can use material I already have or capture a new conversation.**

Acceptance criteria:

1. The Create screen shows **Start live capture**, **Import meeting or notes**, and **Paste transcript** as primary choices.
2. **Import from Bee** appears as optional and communicates connection status.
3. **Load demo scenario** is available and clearly labeled.
4. No path requires Bee authentication.
5. Each choice explains what data it expects and what happens next.

Frontend:

- `CreateExperimentSourcePage`
- `SourceMethodCard`
- provider status badges

Backend:

- `GET /api/v1/capabilities`
- returns microphone mode, supported file types, Transcribe status, Bee status, Bedrock status, and MCP status

Telemetry/events:

- `source.method_selected`

### US-A2: Resume an existing experiment

**As a researcher, I want to reopen an experiment and continue the conversation so that later details can improve the record without recreating it.**

Acceptance criteria:

1. The dashboard exposes **Discuss this experiment**.
2. A session can be created with an existing experiment ID.
3. The assistant retrieves current experiment state before responding to change requests.
4. Any changed field becomes a revision proposal.

---

## 6. Epic B — Live Microphone Capture

### US-B1: Start and stop browser capture

**As a researcher, I want to speak a research discussion into the browser so that I do not need to type meeting details.**

Acceptance criteria:

1. Capture starts only after an explicit click.
2. The UI shows a visible recording state and stop control.
3. Interim transcription is visually distinguished from confirmed text.
4. Stopping capture produces an editable transcript.
5. The user can cancel and discard the draft.
6. Denied permission produces instructions and keeps paste/upload available.
7. Unsupported browsers show an actionable fallback.
8. No experiment is created from interim text.

Frontend:

- `LiveCapturePanel`
- `MicrophonePermissionState`
- `TranscriptEditor`
- browser speech adapter behind an interface

Backend:

- no raw microphone stream required in the first version
- confirmed transcript submitted through `POST /api/v1/sources/text`
- source type `browser_voice`

### US-B2: Confirm captured transcript

**As a researcher, I want to correct the transcript before analysis so that speech-recognition mistakes do not become experiment evidence.**

Acceptance criteria:

1. The full transcript is editable.
2. The UI labels it as unconfirmed until submission.
3. **Finish and analyze** creates a source artifact and starts extraction.
4. The submitted version is content-hashed.
5. Later edits create a new source artifact or revision rather than changing stored evidence silently.

---

## 7. Epic C — Import Existing Material

### US-C1: Paste text

**As a researcher, I want to paste meeting notes or a transcript so that I can create an experiment without uploading a file.**

Acceptance criteria:

1. Empty and whitespace-only input is rejected locally and by the API.
2. Configured length limits are shown before submission.
3. The user can identify the material as transcript, meeting notes, or lab notes.
4. A review step precedes experiment creation.
5. The source type and original label are preserved.

### US-C2: Upload a document

**As a researcher, I want to upload meeting or lab documents so that Experiment Guardian can extract relevant experiment information.**

Initial formats:

- TXT
- Markdown
- PDF with extractable text
- DOCX

Acceptance criteria:

1. The file picker lists accepted formats and size limit.
2. The backend validates extension and content type.
3. Extracted text is shown before analysis.
4. Page or paragraph locators are retained where available.
5. Unsupported, encrypted, corrupt, or image-only files return actionable errors.
6. The user can edit the extracted text while the original extraction remains traceable.

Backend:

- `POST /api/v1/sources/files`
- `GET /api/v1/sources/:sourceId`
- document extractor interface returning text, locators, warnings, and metadata

### US-C3: Upload recorded audio

**As a researcher, I want to upload a meeting recording so that Amazon Transcribe can create a reviewable transcript.**

Acceptance criteria:

1. The feature appears only when Transcribe is configured, or appears disabled with setup status.
2. The backend validates file type and size.
3. The UI shows upload and transcription progress.
4. Completed text is editable before analysis.
5. Speaker and timestamp metadata are preserved when available.
6. Temporary audio follows the configured deletion policy.
7. Failed or timed-out jobs can be retried without duplicate experiments.

This story follows the core Alexa+/MCP workflow and is not required before browser voice and document import work.

---

## 8. Epic D — Create an Experiment from Conversation

### US-D1: Extract structured fields

**As a researcher, I want unstructured discussion converted into structured experiment fields so that I can inspect a reproducibility record quickly.**

Acceptance criteria:

1. Bedrock receives only confirmed source text within configured limits.
2. Output is validated against the experiment schema.
3. Invalid model output is rejected or repaired through a bounded retry.
4. Missing values remain null or absent rather than invented.
5. Each extracted value links to a source excerpt when possible.
6. The resulting experiment records extraction model metadata.

MCP tool:

- `create_experiment_from_transcript`

### US-D2: Observe processing

**As a researcher, I want to see which stage and tool is running so that I understand what the assistant is doing.**

Acceptance criteria:

1. The UI receives real events from the session event stream.
2. It shows transcription, extraction, audit, and report stages.
3. Tool names and user-friendly labels are visible.
4. Failures identify the failed stage and a recovery action.
5. Animation does not claim progress not represented by an event.
6. Reduced-motion mode uses static transitions.

---

## 9. Epic E — Audit Reproducibility

### US-E1: Run deterministic audit

**As a researcher, I want the record checked by deterministic rules so that results do not depend on an LLM's opinion.**

Acceptance criteria:

1. The assistant calls `audit_experiment` through MCP.
2. Each run creates an immutable audit record.
3. Findings include rule ID, severity, affected fields, description, and evidence.
4. The score/status is derived from the deterministic rules.
5. Re-running without changes produces semantically consistent findings.
6. Rule version is stored.

### US-E2: Inspect evidence

**As a researcher, I want to see where a value or finding came from so that I can verify the system's reasoning.**

Acceptance criteria:

1. Clicking an experiment field opens its evidence.
2. Evidence shows a source excerpt and source type.
3. Page, speaker, and timestamp appear when known.
4. Inferred or user-provided values are labeled distinctly.
5. Missing evidence is stated explicitly.

### US-E3: Ask whether the experiment is reproducible

**As a researcher, I want a plain-language explanation of the audit so that I can understand and act on the gaps.**

Acceptance criteria:

1. The assistant retrieves the current audit before answering.
2. The answer cites relevant finding identifiers or links.
3. It distinguishes blocking gaps from recommendations.
4. It does not change the deterministic result.
5. It asks at most the necessary targeted follow-up questions.

MCP tools:

- `get_audit_report`
- `explain_audit_finding`

---

## 10. Epic F — Resolve Gaps Conversationally

### US-F1: Provide missing information

**As a researcher, I want to state missing values naturally so that I do not need to locate individual form fields.**

Example:

> The seed was 42, we used PyTorch 2.7, and the commit was a81c93f.

Acceptance criteria:

1. The agent reads the current experiment before comparing values.
2. Each changed field becomes a separate or clearly grouped proposal.
3. The proposal includes old value, new value, reason, actor, and evidence.
4. The experiment remains unchanged while approval is pending.
5. Unsupported field paths are rejected.

### US-F2: Approve a revision

**As a researcher, I want to approve an exact proposed change so that updates are intentional and traceable.**

Acceptance criteria:

1. The UI displays old and proposed values.
2. It displays the evidence and reason.
3. Approval references the exact approval and revision identifiers.
4. The backend verifies pending status and identity match.
5. Applying a revision creates immutable history.
6. A new audit runs automatically.
7. The assistant summarizes the actual result.

### US-F3: Reject a revision

**As a researcher, I want to reject an incorrect suggestion so that it cannot alter the record.**

Acceptance criteria:

1. Rejection optionally records a reason.
2. The proposal remains visible in history as rejected.
3. Rejected proposals cannot later be applied without a new proposal.
4. The current experiment is unchanged.

### US-F4: Handle stale proposals

**As a researcher, I want conflicting old proposals detected so that approving one does not overwrite newer work.**

Acceptance criteria:

1. The backend compares the proposal's expected current value/version.
2. A mismatch marks or returns the proposal as stale.
3. The UI offers to regenerate the proposal from current state.

---

## 11. Epic G — Research Decisions and History

### US-G1: Record a research decision

**As a researcher, I want to preserve why a parameter or method was chosen so that future collaborators understand the experiment.**

Acceptance criteria:

1. A decision can include rationale, alternatives, actor, and evidence.
2. Decisions appear in chronological order.
3. Decisions are separate from extracted facts.
4. Later contradictions are surfaced without deleting history.

### US-G2: Compare versions

**As a researcher, I want to compare experiment versions so that I can see what changed and how reproducibility was affected.**

Acceptance criteria:

1. The user can select two versions or audit runs.
2. Changed fields, decisions, score, and findings are summarized.
3. The comparison uses stored history rather than regenerated guesses.

---

## 12. Epic H — Generate and Export Report

### US-H1: Generate reproducibility report

**As a researcher, I want an evidence-linked report so that I can share the experiment's current reproducibility state.**

Acceptance criteria:

1. The report identifies the experiment and audit run.
2. It includes structured parameters, score, findings, evidence, decisions, and revision history.
3. It distinguishes resolved and unresolved issues.
4. It includes generation timestamp and rule version.
5. The assistant cannot omit deterministic blocking findings.
6. Initial output supports JSON and Markdown.

MCP tool:

- `generate_reproducibility_report`

---

## 13. Epic I — External MCP and Alexa-Style Use

### US-I1: Discover tools

**As an external MCP client, I want to discover Experiment Guardian tools so that I can guide a researcher through the workflow.**

Acceptance criteria:

1. Streamable HTTP initialization succeeds.
2. Tool names, descriptions, and JSON schemas are returned.
3. Tools are classified as read, compute, create, propose, or governed mutation.
4. No Bee dependency is required.

### US-I2: Complete workflow through MCP

**As an Alexa-style client, I want to create, audit, discuss, revise, and report an experiment through tools so that the capability works outside the first-party UI.**

Acceptance criteria:

1. The client can create an experiment from transcript text.
2. It can retrieve and audit the record.
3. It can propose missing information.
4. It cannot apply a proposal without explicit approval.
5. It can retrieve the post-approval audit and final report.

### US-I3: Use the Agent Skill

**As a compatible agent, I want packaged workflow guidance so that I use Experiment Guardian safely and consistently.**

Acceptance criteria:

1. The skill describes when to call each MCP tool.
2. It instructs the agent to ground claims in tool results.
3. It instructs the agent to ask targeted questions.
4. It documents approval and error recovery.
5. It includes at least one complete example workflow.

---

## 14. Epic J — Optional Bee Research Memory

### US-J1: Connect Bee

**As a Bee user, I want to connect the CLI so that I can import captured research conversations.**

Acceptance criteria:

1. Status distinguishes disabled, CLI missing, authentication required, and ready.
2. Setup requirements are accurate and do not imply Bee access is free or hardware-independent.
3. Failure never blocks other intake paths.

### US-J2: Import a Bee conversation

**As a Bee user, I want to review a conversation before import so that private or irrelevant discussions are not analyzed accidentally.**

Acceptance criteria:

1. Conversation metadata loads before full transcript selection.
2. The user reviews transcript content.
3. Import requires an explicit action.
4. Source references use Bee conversation identifiers.
5. Imported material follows the standard extraction and audit pipeline.

### US-J3: Synchronize later discussion

**As a Bee user, I want new utterances synchronized so that later research decisions can propose updates.**

Acceptance criteria:

1. Synchronization uses the latest stored timestamp/cursor.
2. Duplicate utterances are ignored.
3. New statements create proposals rather than direct mutations.
4. The user approves or rejects proposed changes.

---

## 15. Epic K — Demo and Judge Experience

### US-K1: Load a deterministic demo

**As a judge, I want a complete scenario immediately so that I can evaluate the product without configuring accounts or hardware.**

Acceptance criteria:

1. Demo mode is one click from the Create or Research Assistant page.
2. It is visibly labeled **Demo scenario**.
3. Fixtures contain no private data.
4. The demo invokes real MCP tools and domain services.
5. It generates real audit, revision, event, and report records.
6. The demo can be reset without affecting user-created experiments.

### US-K2: Understand agent activity

**As a judge, I want to see the agent's actual tool activity so that the Alexa+ MCP integration is credible.**

Acceptance criteria:

1. The timeline shows tool name, state, and duration.
2. Selecting an item shows a safe structured summary.
3. The visualization responds to backend events.
4. An MCP status indicator is visible.
5. Bedrock and optional Bee/Transcribe provider status are distinguishable.

---

## 16. Screen Specification

### 16.1 Research Assistant

Purpose: default conversational workspace.

Regions:

- session title and active experiment
- conversation transcript
- microphone, text, and attachment composer
- current agent state
- Research Decision Observatory
- tool activity timeline
- pending approval cards
- evidence drawer

Empty state actions:

- Start live capture
- Import meeting or notes
- Paste transcript
- Load demo scenario

### 16.2 Source Review

Purpose: confirm extracted or transcribed text before analysis.

Required controls:

- original source name/type
- warnings
- editable text
- locator availability summary
- cancel
- save draft
- Finish and analyze

### 16.3 Experiment Workspace

Tabs:

- Overview
- Audit
- Evidence
- Decisions
- Revisions
- Conversation
- Report

Persistent header:

- experiment title
- reproducibility status/score
- source type
- latest audit time
- Discuss this experiment

### 16.4 Provider Settings

Show independently:

- Bedrock configured/available
- MCP server ready
- Browser microphone capability
- Amazon Transcribe configured/disabled
- Bee disabled/CLI missing/authentication required/ready

Do not represent optional provider failure as total application failure.

---

## 17. Five-Minute Demonstration Script

### 0:00–0:30 — Problem and input

Open Research Assistant and explain that research details disappear across informal discussions and notes. Select **Load demo scenario** or use browser voice.

Say or load:

> We fine-tuned ResNet-50 on CIFAR-10 for 20 epochs using Adam at a learning rate of 0.001. Test accuracy was 91.4 percent.

### 0:30–1:30 — Visible MCP workflow

Show events:

- source confirmed
- `create_experiment_from_transcript`
- Bedrock extraction
- `audit_experiment`

Show the graph populate with model, dataset, training settings, and result.

### 1:30–2:30 — Deterministic finding explanation

Ask:

> Can someone reproduce this experiment?

Show the assistant calling the report/explanation tools and identifying missing seed, dataset version, code commit, framework version, and evaluation procedure.

Open one evidence link.

### 2:30–3:45 — Governed correction

Say:

> The random seed was 42, the framework was PyTorch 2.7, and the commit was a81c93f.

Show revision proposals. Approve them. Show the new audit run and improved score.

### 3:45–4:30 — Report

Ask for the reproducibility report. Show parameters, evidence, revisions, resolved findings, remaining gap, and MCP invocation history.

### 4:30–5:00 — Architecture and optional Bee

Show that the same MCP server can be used by an external Alexa-style agent. Mention Bedrock as the extraction and conversational reasoning layer. Show Bee as an optional continuous-memory source when the account meets its prerequisites.

---

## 18. Nonfunctional Acceptance Criteria

### Accessibility

- All workflows work with keyboard navigation.
- Microphone controls have text labels and state announcements.
- Color is not the only indicator of severity or status.
- Reduced-motion preference disables nonessential 3D motion.
- A 2D fallback provides equivalent information.

### Privacy

- Capture requires an explicit user action.
- The user reviews source text before analysis.
- Secrets and raw private payloads are excluded from event streams and logs.
- Raw audio retention is disabled by default.
- Bee transcript import requires explicit selection.

### Reliability

- Message submission is idempotent through `clientMessageId`.
- Tool invocations have timeouts and terminal states.
- Approval is enforced server-side.
- Audit runs and applied revisions are immutable.
- Optional provider failures are isolated.

### Performance targets

- Local UI reaction to recording and input: under 100 ms where practical.
- Session/message acknowledgement: under 1 second before long work begins.
- Tool-start event: emitted immediately after validated selection.
- SSE reconnect: automatic with bounded backoff.
- Large extraction and transcription operations: asynchronous when request deadlines would be exceeded.

---

## 19. Implementation Traceability Matrix

| User story | Frontend | Backend/API | MCP/AWS |
|---|---|---|---|
| A1 | source selector | capabilities | provider status |
| B1–B2 | live capture, editor | text source | optional Transcribe later |
| C1–C2 | paste/upload/review | source endpoints, extractors | Bedrock after confirmation |
| C3 | audio progress | audio job | Amazon Transcribe |
| D1–D2 | processing observatory | extraction, SSE | Bedrock, MCP create tool |
| E1–E3 | audit/evidence/chat | audit services | MCP audit/explain tools |
| F1–F4 | proposal cards | approval enforcement | MCP revision tools |
| G1–G2 | history/compare | decision/revision history | MCP decision/compare tools |
| H1 | report tab | report service | MCP report tool |
| I1–I3 | MCP status | `/mcp` | Streamable HTTP, Agent Skill |
| J1–J3 | Bee workspace | Bee service | Bee CLI |
| K1–K2 | demo controls/timeline | fixture provider/events | real MCP path |

## 20. Approval Gate Before Implementation

Implementation begins only after the user approves this specification and the corresponding extensions in:

- `EXPERIMENT_GUARDIAN_ENGINEERING_SPEC.md`
- `EXPERIMENT_GUARDIAN_API_INTEGRATION_SPEC.md`

After approval, implement in this order:

1. track-independent demo fixtures and capability status,
2. MCP server and core tools,
3. assistant sessions and text conversation,
4. governed conversational revisions,
5. browser voice and document intake,
6. observable frontend and accessible visualization,
7. Agent Skill and submission packaging,
8. Amazon Transcribe enhancement,
9. Bee live verification when access becomes available.

---

## 21. Alexa+ Primary Experience Amendment

### 21.1 Precedence

This amendment strengthens Epics B, D, E, F, I, and K. Alexa+ is the primary session conductor. The web application is an Alexa+ Lab Copilot simulation and visual companion. Experiment Guardian remains the MCP-backed audit and evidence system.

### US-L1: Start a hands-free research session

**As a researcher working with equipment or results, I want Alexa+ to start documenting an experiment so that I can preserve details without stopping to complete a form.**

Acceptance criteria:

1. The researcher can say or type a natural start command.
2. Alexa+ creates a persisted session before accepting observations.
3. The interface clearly shows listening state and active session.
4. If no experiment exists, the first meaningful observation creates one through MCP.
5. The agent acknowledges what it captured without reading a long field list.

### US-L2: Add observations to the active experiment

**As a researcher, I want follow-up statements to apply to the active experiment so that I can speak naturally across multiple turns.**

Acceptance criteria:

1. Alexa+ maintains one explicit active experiment per session.
2. Observations include idempotency identifiers.
3. The agent retrieves current state before proposing changed values.
4. New facts retain their source utterance as evidence.
5. Ambiguous experiment context triggers clarification.

### US-L3: Receive a proactive reproducibility question

**As a researcher, I want Alexa+ to ask for the most important missing detail while the work is fresh so that reproducibility gaps are resolved early.**

Acceptance criteria:

1. The question is linked to a deterministic audit finding.
2. Only one focused question is asked at a time.
3. Critical and high-severity blockers take priority.
4. Alexa+ explains briefly why the detail matters.
5. “I don’t know” is accepted and stored as unresolved.
6. Previously answered or dismissed questions are not repeated in the same session.

### US-L4: Preserve research rationale

**As a researcher, I want Alexa+ to recognize why we accepted or rejected an approach so that future collaborators understand the decision.**

Acceptance criteria:

1. Statements containing a choice and reason can create a research decision.
2. Selected option, rejected alternative, and rationale are stored separately.
3. Alexa+ reads back a concise decision summary.
4. The decision links to the source observation.

### US-L5: Confirm an exact change by voice

**As a researcher, I want Alexa+ to read back a proposed change and ask for confirmation so that voice interaction remains safe and traceable.**

Acceptance criteria:

1. Alexa+ states the affected fields and proposed values.
2. One pending approval is bound to the session and exact revisions.
3. Only the immediate confirmation turn can resolve it by voice.
4. Ambiguous answers produce a clarification request.
5. Expired or unrelated confirmation cannot apply a change.
6. Visual Approve and Reject controls remain available.
7. Approved changes trigger a new audit and spoken result summary.

### US-L6: Pause and resume laboratory work

**As a researcher, I want to pause and later resume the session so that documentation matches the interrupted nature of laboratory work.**

Acceptance criteria:

1. Pause persists the active experiment, latest completed step, unresolved question, and pending approval.
2. Resume by exact session restores context.
3. Resume by natural phrase asks the user to choose when multiple sessions match.
4. Alexa+ summarizes where the researcher stopped.
5. Retried operations do not duplicate observations or revisions.

### US-L7: Receive a voice-to-visual handoff

**As a researcher, I want Alexa+ to open detailed evidence on the companion screen so that spoken interaction remains concise while complex information stays inspectable.**

Acceptance criteria:

1. Alexa+ responses return structured visual targets.
2. The companion opens or highlights the correct finding, approval, experiment, or report.
3. The UI does not parse prose to determine the target.
4. Evidence and revisions remain navigable by keyboard.
5. The spoken response summarizes rather than recites the full report.

### US-L8: Finish the experiment session

**As a researcher, I want Alexa+ to finish the session, run the final audit, and prepare the report so that the documentation workflow ends cleanly.**

Acceptance criteria:

1. Finish triggers a final deterministic audit.
2. A report is generated from stored state.
3. Alexa+ states the current reproducibility status and most important unresolved gap.
4. The detailed report opens in the visual companion.
5. The completed session remains resumable only through explicit action.

## 22. Revised Alexa+ Demo Acceptance Scenario

Given no Bee account or device is connected:

1. The judge opens **Alexa+ Lab Copilot Simulation**.
2. The researcher says, “Alexa, start documenting our image-classification experiment.”
3. The researcher describes the model, dataset, learning rate, epochs, and result.
4. Alexa+ invokes actual Experiment Guardian MCP tools and the timeline displays them.
5. The deterministic audit finds a missing seed and code commit.
6. Alexa+ proactively asks for the random seed and explains why it matters.
7. The researcher answers, “The seed was 42. We rejected seed zero because it matched an earlier exploratory run.”
8. Alexa+ records the rationale and reads back the proposed field change.
9. The researcher explicitly approves the pending action.
10. The backend applies the exact revision and reruns the audit.
11. The session is paused and resumed, retaining active experiment context.
12. The researcher asks Alexa+ to finish and prepare the report.
13. Alexa+ summarizes the result and hands off to the detailed visual report.

The scenario passes only if the workflow uses persisted session state, real MCP tool calls, deterministic audit findings, governed approval, and structured visual handoff.

## 23. Updated Implementation Priority

After approval, implement in this order:

1. Alexa session state and observation model,
2. Alexa-oriented MCP tools,
3. deterministic proactive question selection,
4. bound confirmation and approval flow,
5. Alexa+ Lab Copilot text simulation,
6. browser microphone input,
7. pause/resume and visual handoff,
8. document import,
9. Agent Skill package,
10. Amazon Transcribe enhancement,
11. optional Bee live verification.
