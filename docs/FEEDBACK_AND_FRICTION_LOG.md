# Product feedback and friction log

## Alexa+ and MCP

### What we used

We implemented Experiment Guardian as a Streamable HTTP MCP server with tools for starting and resuming research sessions, capturing observations, creating experiments, selecting audit questions, governing revisions, running audits, and generating reports. We also built a visual Alexa+ simulation so judges can see speech, tool activity, approvals, and report handoff in one place.

### What worked well

- MCP creates a clean separation between Alexa+'s conversation role and Experiment Guardian's domain logic.
- Tool schemas made actions and confirmation boundaries explicit.
- A single MCP server can support voice-only and visual clients.
- The Alexa AI CLI workflow provides a clear path from a remote MCP URL to development deployment.

### What needs work

- A complete end-to-end sample covering remote hosting, authentication metadata, account linking, tool calls, and a visual response would reduce onboarding time.
- Access requirements for Alexa+ developer testing should be visible before implementation begins.
- Local validation should explain exactly which MCP protocol and authentication requirement failed.

### Would we use it again?

Yes. MCP fits research workflows because Alexa+ can manage the conversation while deterministic tools preserve safety, evidence, and approval boundaries.

## Amazon Bedrock

### What we used

The Bedrock Converse API adapter accepts research transcripts and requests schema-constrained experiment extraction. The application validates and normalizes the response before any audit is run.

### What worked well

- The AWS SDK client and Converse request shape were straightforward to integrate.
- Keeping extraction separate from the audit engine allowed an offline deterministic mode without changing the product workflow.
- Structured errors made access problems visible without crashing the application.

### What needs work

- Model naming, regional availability, account eligibility, API-key behavior, and IAM permission requirements were difficult to distinguish during onboarding.
- The supplied account reported that the configured model was unavailable, while the IAM user separately lacked permission to list models.
- A console-generated, least-privilege policy for a selected model would simplify setup.

### Would we use it again?

Yes, with an account whose model access and organization policies are confirmed before development begins.

## Amazon Transcribe and S3

### What we used

The audio adapter uploads a recording to a private S3 prefix, starts a batch transcription job, polls its status, downloads the transcript, preserves speaker metadata, and deletes the temporary input object.

### What worked well

- S3 bucket creation, regional verification, upload, and cleanup worked correctly.
- The Transcribe API maps naturally to uploaded laboratory recordings.
- Failure responses identified the exact denied action and controlling policy.

### What needs work

- The supplied project account included an organization Service Control Policy that explicitly denied `transcribe:StartTranscriptionJob`.
- IAM policy changes cannot override an organization-level explicit deny, but this was discovered only during the first real job.
- Project account documentation should list services blocked by organization policy before users design an integration.

### Would we use it again?

Yes. It remains the preferred recorded-audio path when the account permits it. Browser speech recognition is the demonstration workaround.

## Bee

### What we used

The optional Bee adapter uses the official CLI to list conversations, retrieve transcripts, synchronize newer utterances, and attach evidence to experiment records.

### What worked well

- Conversation and transcript concepts align strongly with continuous research memory.
- The CLI offers a practical integration surface for a local prototype.

### What needs work

- Authentication required completed Bee device or Apple Watch onboarding.
- The available account required Bee Pro for the displayed QR connection path.
- A developer sandbox containing synthetic conversations would make integrations testable without hardware.

### Would we use it again?

Yes, when device access is available. Bee remains optional in this submission because live Bee data could not be obtained.

## Friction log

### 1. Amazon Transcribe organization denial

- **Task:** Transcribe an uploaded two-second WAV file.
- **Steps:** Created a private Sydney S3 bucket, configured a least-privilege IAM user, uploaded the file, and called `StartTranscriptionJob`.
- **Expected:** A batch transcription job would start.
- **Actual:** AWS returned an explicit deny from an organization Service Control Policy.
- **Severity:** Critical for uploaded audio.
- **Workaround:** Use live browser microphone transcription or import an existing written transcript.
- **Suggestion:** Show blocked services and relevant organization policies on the project account landing page.

### 2. Bedrock model access ambiguity

- **Task:** Extract experiment parameters with Bedrock Converse.
- **Steps:** Configured the provided Bedrock bearer token, region, and model ID, then sent a live extraction request.
- **Expected:** A schema-shaped extraction response.
- **Actual:** The model was reported unavailable for the account; the IAM user also lacked catalog-listing permission.
- **Severity:** Critical for live LLM extraction.
- **Workaround:** Use the deterministic local extractor while retaining the Bedrock adapter.
- **Suggestion:** Provide an account-specific command that returns usable model IDs and generates the matching IAM policy.

### 3. Bee onboarding dependency

- **Task:** Authenticate the Bee CLI and synchronize conversations.
- **Steps:** Opened the connection link and attempted QR/device onboarding.
- **Expected:** Developer authentication without hardware.
- **Actual:** The flow required Bee Pro or a connected Bee/Apple Watch path.
- **Severity:** High for a live Bee-track demonstration.
- **Workaround:** Keep the adapter optional and use meeting-note/demo sources.
- **Suggestion:** Offer a developer sandbox and sample live-data account.

### 4. Alexa AI CLI package access

- **Task:** Install the documented Alexa AI CLI and deploy the MCP add-on package.
- **Steps:** Followed the official QuickStart command, `npm install -g @alexa-ai/cli`, from the project machine.
- **Expected:** The CLI would install so the add-on could be created, validated, and deployed.
- **Actual:** npm returned `E404 Not Found` for the documented package, consistent with the Alexa+ add-on Private Preview access requirement.
- **Severity:** High for device and web-simulator validation; the public Streamable HTTP MCP server remains usable independently.
- **Workaround:** Prepared a complete add-on manifest, public assets, MCP endpoint, privacy policy, terms, and agent instructions in the repository for deployment as soon as the Amazon account is enabled.
- **Suggestion:** Make the package available before the QuickStart page is visible, or show an entitlement-specific error with an access-request link.
