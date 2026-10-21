# Experiment Guardian — hackathon submission

## Project description

Experiment Guardian helps ML researchers compare what they *said* they ran with the code and run that actually produced a result. A researcher can link a GitLab merge request and an MLflow run, or start from a meeting note, document, or browser microphone transcript. Guardian creates a structured experiment record, keeps source links and evidence snapshots, and runs deterministic reproducibility checks. It asks focused follow-up questions and requires approval before a proposed correction changes the record. The final report retains open findings rather than making an unsupported result look complete.

The strongest demonstration starts from a deliberately inaccurate Iris draft note. Guardian reads a real GitLab merge request and the linked MLflow run, pins the merge request head commit and run metadata, then flags the draft seed, learning rate, and dataset version against the recorded run. The researcher opens the *same experiment* in the Alexa+ web simulation, answers a question, approves a correction, imports a split note, and produces a report.

The browser simulation uses the official MCP TypeScript SDK to call Guardian's self-hosted Streamable HTTP MCP server at `/mcp`. It displays actual tool activity, approvals, and audit history. The simulation selects tools through deterministic client code; it is **not** the official Amazon Alexa+ client or an LLM that autonomously chooses tools. The connected Iris conversation does not call Bedrock. A separate new-note extraction path can call Amazon Bedrock when live model access is configured; the current deployed demo uses the deterministic mock extractor.

## Submission fields and status

| Field | Submission answer |
| --- | --- |
| Primary track | **Alexa+**: working self-hosted MCP server over Streamable HTTP, with negotiated MCP protocol `2025-11-25`; web simulation shows the interaction. |
| Mini challenges | **None claimed in the current demo.** The submitted demo has not demonstrated a successful live AWS service call; Bedrock and Transcribe calls were blocked during this build. The public MIT repository alone is not an Open Source contribution URL. |
| Code repository | [miko-keng/experiment-guardian](https://github.com/miko-keng/experiment-guardian), public, with [MIT LICENSE](../LICENSE). |
| Demonstration video | **Still to provide:** insert a public YouTube or Vimeo URL in the submission form. Keep the video under three minutes and show the functioning web application. |
| Runtime technology hook | The browser imports and calls the MCP SDK in [`frontend/src/api/mcp.ts`](../frontend/src/api/mcp.ts); the backend exposes [`/mcp`](../backend/src/mcp/server.ts). The [judge guide](JUDGE_DEMO.md) gives the exact route and inputs. |
| Open Source mini challenge | **Not claimed.** If entering later, add an eligible contribution URL, project URL, GitHub username, and the contribution's effect to the submission form. |
| Pre-hackathon work | If any part of this project predates the submission window, state the prior scope and identify the features built during the window. Do not imply an unverified start date. |

The repository includes application source, assets, a root README, environment examples, deployment instructions, a license, MCP entry point, and sample inputs. The [connected workflow guide](CONNECTED_ML_WORKFLOW.md) explains the optional connector configuration. No private connector token is needed in the browser.

## How the product works

1. **Link evidence.** The researcher supplies the merge request URL, MLflow run ID, and repository-relative JSON config path. Guardian reads the merge request, its head commit, the selected file at that commit, and the selected MLflow run's parameters, metrics, metadata, and artifact references.
2. **Save a snapshot.** The backend stores the fetched evidence and source links in SQLite. Refreshing creates another snapshot; the existing review retains its earlier evidence.
3. **Audit claims.** Deterministic rules compare the experiment record with the pinned source values and label missing or conflicting evidence. An unavailable artifact listing remains *unknown*.
4. **Discuss the same review.** The experiment-detail link passes its experiment ID into the Alexa+ lab. The browser calls Guardian MCP tools to start a session, ask the next question, capture observations, and request approval.
5. **Approve, reject, and re-audit.** Supported values become proposed revisions. Approval applies the exact proposal and reruns the audit; rejection does not change the experiment field.
6. **Report.** The report includes the linked sources, revisions, audit history, and remaining findings. The optional GitLab CI example is advisory; it was not run successfully on the demo fork because GitLab required account identity verification.

## Implemented versus verified

| Capability | Current evidence and limit |
| --- | --- |
| MCP server and tools | Implemented at `/mcp`. On **21 October 2026**, the pinned official MCP Inspector invoked **19/19 currently advertised tools** against an isolated local database. A separate local SDK integration negotiated `2025-11-25` and exercised the linked review, question, approval, rejection, and report flow with simulated source responses. The deployed read-only MCP check listed 19 tools and called `list_experiments`. |
| GitLab + MLflow source read | On **21 October 2026**, the deployed read-only source check fetched the real MR and private MLflow run through server-side access. It returned commit `2d95c4d7e9136ea70946b6cd4cca2d8edb141729`, seed `42`, learning rate `0.1`, dataset version `sklearn-iris`, and artifact listing `unavailable`. The check created no production review. |
| Full linked-review flow | Passed in a disposable local SQLite database using simulated GitLab/MLflow responses. A production review and approval against the live run were not executed in that verification. |
| Bedrock extraction | Adapter implemented. Live Converse invocation was denied for the tested Anthropic model; the deployed judging path uses the mock extractor. Do not describe the linked Alexa+ chat as Bedrock-powered. |
| Uploaded audio | S3 and Transcribe adapters implemented. The attempted Transcribe job was blocked by an organization policy; browser speech and document import are the demo paths. |
| Bee | Optional adapter only. No live Bee device or Apple Watch data was available; **Bee track is not claimed**. |
| GitLab CI | Advisory job and MR-note script implemented. GitLab identity verification blocked the demo fork's pipeline; no live CI success is claimed. |

## Product feedback

The entries below distinguish APIs used successfully from optional integrations that were attempted but blocked. “Would use again” is a product judgment, not a claim that every service ran in the public demo.

| Tool, API, or SDK and use | Onboarding and what worked | What needs work | Would use again? |
| --- | --- | --- | --- |
| **MCP TypeScript SDK and Streamable HTTP** — browser-to-Guardian tool calls and local Inspector checks | Tool schemas and the client/server boundary were clear. Local initialization, `tools/list`, and `tools/call` worked against the self-hosted server. | More end-to-end guidance for hosting, authentication, and protocol-version troubleshooting would shorten onboarding. | **Yes**: explicit tools and approval boundaries suit an auditable workflow. |
| **Alexa+ developer tooling** — add-on packaging and intended client integration | The add-on model suggested a useful conversational entry point. The web simulation made the workflow reviewable without a device. | The attempted `@alexa-ai/cli` install returned npm 404 in the available account; official Alexa+ routing could not be tested. Access requirements should appear before the QuickStart. | **Yes, if access is available**: a real client would make the research workflow more natural. |
| **GitLab REST API** — MR, commit, and pinned training-file read | Public MR and commit data were accessible and easy to link. | The demo fork required identity verification before hosted CI could run. The permission needed for CI and experiment tracking should be clearer. | **Yes**: versioned code evidence is central to reproducibility. |
| **GitLab MLflow-compatible API / MLflow client** — log and read the Iris run | A local training script logged a real run; the deployed backend later read its private run with a server-side token. | Without that token the run returned HTTP 401. Artifact listing was unavailable for this run. A clearer permissions and artifact-status diagnostic would help. | **Yes**: run parameters and metrics complement the code commit. |
| **Amazon Bedrock Converse via AWS SDK** — optional structured extraction from new notes | The adapter and error handling were straightforward to implement. Keeping extraction separate from rules preserved an offline demo path. | The tested Anthropic model returned `AccessDeniedException` / “not available for this account”; availability, agreement, entitlement, and IAM status were difficult to distinguish. | **Yes, conditionally**: when model access is confirmed, it can help extract claims; deterministic rules must remain the authority for audits. |
| **Amazon S3 via AWS SDK** — private input storage for optional audio upload | Bucket creation and regional checks worked. The adapter can clean up temporary inputs. | An end-to-end recording path depends on Transcribe access. Make lifecycle and cost defaults clearer. | **Yes**: private object storage fits batch input. |
| **Amazon Transcribe via AWS SDK** — optional recorded-audio transcription | The job API maps well to uploaded meetings and returned a clear denial. | `StartTranscriptionJob` was denied by an organization Service Control Policy, which IAM grants could not override. Show inherited restrictions earlier. | **Yes, conditionally**: use it when the account permits jobs. |
| **Bee CLI** — optional research-conversation source | The conversation and transcript model fits continuous research memory. | The available account could not finish Bee Pro/device onboarding, so no live data was demonstrated. A synthetic developer sandbox would help. | **Yes, with device access**; not part of this track submission. |
| **React** — experiment and Alexa+ simulation interface | Component state made the linked review and approval flow easy to show. | Dense evidence screens need continued accessibility and small-screen work. | **Yes** for the interface. |
| **Vite** — local frontend build and bundling | Fast local feedback and a straightforward production build. | The bundle-size warning suggests code splitting before a larger rollout. | **Yes**. |
| **Tailwind CSS** — review UI styling | Utility classes helped build consistent status and evidence views quickly. | Long class lists can make page components harder to maintain. | **Yes**, with shared components. |
| **Express** — REST and MCP HTTP hosting | One backend serves uploads, page data, and MCP. | Add stronger per-user authorization before team deployment. | **Yes** for this prototype. |
| **TypeScript and Zod** — typed tool/API boundaries and input validation | Types and schemas made invalid arguments and revisions easier to constrain. | Shared frontend/backend schemas could reduce duplication. | **Yes**. |
| **SQLite / better-sqlite3** — experiment, audit, revision, and source history | Local transactions and a disposable test database made the workflow repeatable. | A hosted multi-user deployment needs durable managed storage and migration operations. | **Yes** for a demo; use a managed database for teams. |
| **Browser SpeechRecognition** — microphone fallback | A researcher can dictate without a separate cloud transcription setup. | Browser support and recognition behavior vary; uploaded audio still needs a service. | **Yes as a fallback**. |
| **Mammoth, pdf-parse, and Multer** — DOCX/PDF text extraction and document upload | Imported text can be previewed before it becomes an observation. | Complex document layouts may lose structure; keep the preview and provenance. | **Yes**, with limits shown to users. |
| **Vitest and Supertest** — local backend and frontend verification | Isolated tests covered MCP calls, approval, rejection, and audit outcomes. | Live external-source checks still require separate credentials and cannot be inferred from fixtures. | **Yes**. |
| **Render** — public HTTPS demo hosting | One service could serve the UI, REST, and MCP endpoint. | Free-instance startup and ephemeral SQLite limit repeatability of stored demo records. | **Yes for judging**; use persistent storage for a team app. |

## Friction log

Each entry records an issue actually encountered. Severity describes its effect on this project.

| Task and steps | Expected | Actual result | Severity and workaround | Actionable suggestion |
| --- | --- | --- | --- | --- |
| **Transcribe a short WAV:** create private Sydney S3 bucket, upload audio, call `StartTranscriptionJob`. | A batch job starts. | AWS reported an explicit organization Service Control Policy deny. | **Critical for uploaded audio.** Use browser speech or import a written transcript. | Show blocked services and controlling organization policies in the account console before integration starts. |
| **Invoke Bedrock:** select a Sydney Anthropic model and call `Converse` after granting IAM permissions. | A structured model response. | `AccessDeniedException` reported the model unavailable for this account; model availability showed authorization and entitlement but agreement not available. | **High for live LLM extraction.** Keep the deterministic mock extraction path and document the limit. | Provide an account-specific model readiness check with the exact missing agreement, entitlement, or permission and a link to resolve it. |
| **Run GitLab CI:** push a demo branch, open an MR, request a pipeline. | The advisory job runs. | GitLab required additional identity or credit-card verification. | **High for CI demonstration.** Log the real MLflow run locally and keep the CI job as an unverified advisory example. | Offer a no-card developer verification route or a clear preflight warning before pipeline setup. |
| **Read private GitLab MLflow run:** call its tracking endpoint without a token. | The linked run is returned. | HTTP 401. | **Medium.** Configure `MLFLOW_TOKEN` only on the backend; use the read-only source-check endpoint before a review. | Document token scope and error meaning beside the MLflow endpoint instructions. |
| **Verify run artifacts:** request the linked run's artifact listing. | Paths and file metadata are listed. | Listing was unavailable although run parameters and metrics were readable. | **Medium.** Keep artifact presence unknown and leave the finding open. | Return a distinct permissions/unsupported-location diagnostic and a supported listing path. |
| **Onboard Bee:** open connection QR and attempt CLI authorization. | A developer account connects to sample conversations. | The available path required Bee Pro or completed device/Apple Watch onboarding. | **High for Bee track.** Do not claim Bee; use note fixtures for the Alexa+ demo. | Offer sandbox conversations and a test-device path. |
| **Install Alexa AI CLI:** follow the published package install command. | CLI installs for add-on validation. | npm returned 404 for the package in this account. | **High for official Alexa+ validation.** Use the self-hosted MCP server and web simulation. | Make preview entitlement clear and return an access-specific install error. |

## Optional feature requests

| Request | Why it matters | Priority |
| --- | --- | --- |
| Bedrock model readiness diagnostic | Separates region, agreement, entitlement, IAM, and organization restrictions before a project chooses a model. | **Important** |
| GitLab MLflow artifact-status explanation | Prevents users from confusing “unavailable listing” with “no artifacts.” | **Important** |
| Alexa+ developer sandbox with test routing | Lets builders validate a real agent-to-MCP tool path without partner-only access. | **Important** |
| Bee synthetic conversation sandbox | Enables integration development before hardware purchase or device setup. | **Nice-to-have** |

## Judge resources

- [Three-minute connected Iris recording guide](JUDGE_DEMO.md)
- [All scenario questions, answers, and expected actions](JUDGE_SCENARIOS.md)
- [GitLab and MLflow setup and advisory CI details](CONNECTED_ML_WORKFLOW.md)
- [Dated MCP Inspector trace and its limits](evidence/README.md)
- [Deployment instructions](DEPLOYMENT.md)

Before submission, add the public video URL, confirm the deployed app still reads the linked run, and copy the track selection and feedback into the Devpost form. The documentation is a submission draft; it cannot replace the required form fields.
