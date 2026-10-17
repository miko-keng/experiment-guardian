# Experiment Guardian

**Alexa+ research memory and reproducibility copilot**  
*Alexa+ hackathon project with optional AWS and Bee adapters*

Experiment Guardian converts informal research conversations and meeting notes into structured experiment records, detects confounding variables and missing experimental controls, and preserves immutable audit evidence before researchers trust or reproduce results.

---

## Architecture Overview

```
                  USER
                   │
                   ▼
         React + TypeScript + Tailwind (Vite)
            Frontend / UI (Port 5173)
                   │
           REST API (/api/v1)
                   │
                   ▼
          Express + TypeScript
           Backend (Port 3001)
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
Transcript    Experiment       Audit
 Extractor      Service       Engine
     │             │             │
     ▼             ▼             ▼
AWS Bedrock     SQLite      Audit Rules
(Converse API) (Persistent) (Deterministic)
                   ▲
                   │
              Bee Adapter
          (Disabled / Phase 3)
```

---

## Prerequisites

- **Node.js**: v20+ or v24+
- **npm**: v10+
- **AWS Bedrock**: (Optional for local testing with `ALLOW_MOCK_AI=true`, required for live extraction)

---

## Installation & Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Configure your `.env` settings:
   ```env
   NODE_ENV=development
   PORT=3001

   DATABASE_PATH=./data/experiment-guardian.sqlite

   AWS_REGION=ap-southeast-2
   BEDROCK_MODEL_ID=anthropic.claude-haiku-5-5
   AWS_BEARER_TOKEN_BEDROCK=your-bedrock-token-or-key
   BEDROCK_MAX_TOKENS=2048
   BEDROCK_TIMEOUT_MS=30000
   BEDROCK_TEMPERATURE=0

   # Set to true for offline testing or local development
   ALLOW_MOCK_AI=false

   PERSIST_TRANSCRIPTS=true
   MAX_TRANSCRIPT_CHARACTERS=50000

   BEE_ENABLED=false
   FRONTEND_ORIGIN=http://localhost:5173
   ```

---

## Running the Application

### 1. Start Both Backend and Frontend Concurrently:
```bash
npm run dev
```
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/v1/health

### 2. Start Services Independently:
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

---

## Running Tests

Run the full automated test suite (backend unit & integration tests + frontend contract tests):
```bash
npm test
```

### Run specific workspace test suites:
```bash
# Backend tests (Unit, Schema, Database, Audit Rules, E2E vertical slice)
npm run test:backend

# Frontend tests (API client and request handling)
npm run test:frontend
```

---

## Live AWS Bedrock vs. Mock Mode

- **Live Bedrock Extraction (`ALLOW_MOCK_AI=false`):** Calls AWS Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) using `ConverseCommand` and your configured Bearer Token / AWS IAM credentials.
- **Mock Extraction (`ALLOW_MOCK_AI=true`):** Uses the deterministic rule-based extractor for local offline testing and CI workflows.
- **Note on AWS Account Verification:** If your AWS account is currently undergoing verification or model access grant, AWS Bedrock will return `AccessDeniedException`. The backend catches and formats this into a structured `PERMISSION_DENIED` error without leaking credentials or crashing. Set `ALLOW_MOCK_AI=true` in `.env` to test the vertical slice locally while AWS verification completes.

---

## Implemented API Endpoints (`/api/v1`)

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/health` | `GET` | Health status and configuration indicators |
| `/api/v1/experiments/audit` | `POST` | Ingests transcript, extracts parameters, persists to SQLite, and runs audit |
| `/api/v1/experiments` | `GET` | Paginated listing of recorded experiments |
| `/api/v1/experiments/:id` | `GET` | Full experiment details, baseline summary, and findings |
| `/api/v1/experiments/:id/audit` | `GET` | Audit findings for a specific experiment |
| `/api/v1/audits/:findingId` | `PATCH` | Updates finding status (`resolved`, `accepted`, `dismissed`) with notes |
| `/api/v1/bee/status` | `GET` | Bee wearable AI integration readiness status |

---

## Alexa+ Lab Copilot

The current primary hackathon experience is an Alexa+ Lab Copilot simulation backed by a real Streamable HTTP MCP server. Alexa+ acts as the hands-free session conductor while Experiment Guardian provides structured extraction, deterministic auditing, evidence, governed revisions, and reports.

Open `http://localhost:5173/` after starting the application. The main workflow supports:

- browser microphone transcription with editable text,
- pasted research observations,
- TXT, Markdown, PDF, and DOCX meeting-note imports,
- optional recorded audio through Amazon Transcribe,
- clearly labeled deterministic demo scenarios,
- proactive questions selected from audit findings,
- exact approval or rejection of proposed revisions,
- pause and resume with persisted experiment context,
- actual tool invocation history and processing events,
- evidence-linked Markdown reports,
- optional Bee conversation import.

The web experience is a visual companion and standards-based Alexa+ simulation. External clients can use the same tool capabilities through `POST /mcp`, `GET /mcp`, and `DELETE /mcp`.

## Public deployment

The repository includes a production `Dockerfile` and a no-card `render.yaml` for a free judge demo. The cloud container serves the React application, REST API, and Streamable HTTP MCP endpoint from one HTTPS origin. Free deployments use temporary SQLite storage; `render.persistent.yaml` is available for paid durable storage.

See [Public deployment](docs/DEPLOYMENT.md) for the Render and Alexa AI CLI steps.

## Submission materials

- [Project description](docs/SUBMISSION.md)
- [Three-minute demo script](docs/DEMO_SCRIPT.md)
- [Product feedback and friction log](docs/FEEDBACK_AND_FRICTION_LOG.md)
- [Public deployment guide](docs/DEPLOYMENT.md)

## Demonstration configuration

The repeatable judge build uses browser speech recognition and the deterministic local extractor. The Amazon Bedrock, Amazon Transcribe/S3, and Bee adapters remain in the source and can be enabled through environment variables when the connected accounts permit them. Current account-level blockers and tested workarounds are documented in the feedback and friction log.

### Alexa+ Agent Skill

The packaged skill is at [`agent-skill/SKILL.md`](agent-skill/SKILL.md). It describes session control, proactive follow-up, safe confirmation, tool use, interruption handling, and visual handoff.

### Optional Amazon Transcribe

Recorded audio is disabled until configured:

```env
TRANSCRIBE_ENABLED=true
TRANSCRIBE_LANGUAGE_CODE=en-US
TRANSCRIBE_INPUT_BUCKET=your-private-input-bucket
TRANSCRIBE_OUTPUT_BUCKET=your-private-output-bucket
TRANSCRIBE_JOB_TIMEOUT_MS=120000
MAX_AUDIO_BYTES=25000000
```

The AWS identity running the backend needs the least-privilege S3 permissions for the configured buckets and permissions for starting and reading Amazon Transcribe jobs. Uploaded input audio is deleted after the job finishes or fails.

### New integration endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/mcp` | `POST`, `GET`, `DELETE` | MCP Streamable HTTP transport |
| `/api/v1/capabilities` | `GET` | Bedrock, MCP, voice, document, Transcribe, and Bee readiness |
| `/api/v1/alexa/sessions` | `GET` | Recent persisted Alexa+ sessions |
| `/api/v1/alexa/sessions/start` | `POST` | Start a hands-free research session |
| `/api/v1/alexa/sessions/:id/observations` | `POST` | Add an idempotent research observation |
| `/api/v1/alexa/sessions/:id/events` | `GET` | Live Server-Sent Events for tools and workflow state |
| `/api/v1/alexa/sessions/:id/confirm` | `POST` | Resolve the exact pending approval |
| `/api/v1/alexa/sessions/:id/pause` | `POST` | Pause while preserving context |
| `/api/v1/alexa/sessions/:id/resume` | `POST` | Resume persisted context |
| `/api/v1/alexa/sessions/:id/finish` | `POST` | Final audit and report generation |
| `/api/v1/sources/text` | `POST` | Store confirmed text with provenance |
| `/api/v1/sources/files` | `POST` | Extract text from TXT, Markdown, PDF, or DOCX |
| `/api/v1/sources/audio` | `POST` | Transcribe configured audio through Amazon Transcribe |
| `/api/v1/sources/demo` | `GET` | List clearly labeled demo scenarios |
| `/api/v1/reports/:id` | `GET` | Retrieve a generated reproducibility report |
