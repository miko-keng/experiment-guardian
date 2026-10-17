# Public deployment

Experiment Guardian is packaged as one container. In production, Express serves the compiled React application, the REST API, and the Streamable HTTP MCP endpoint from one HTTPS origin.

## Deploy on Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render reads `render.yaml`, builds `Dockerfile`, and creates a free web service.
4. Set `FRONTEND_ORIGIN` to the final Render URL, for example `https://experiment-guardian.onrender.com`.
5. Deploy and verify:
   - `/` opens the React application.
   - `/api/v1/health` reports service readiness.
   - `/mcp` is the Alexa+ Streamable HTTP endpoint.

The default Blueprint uses the deterministic extractor and disables unavailable external integrations. This makes the judging demo repeatable without requiring a payment card.

The free service stores SQLite under `/tmp`. Render can erase that filesystem during a restart or redeploy, so experiment history may reset. That is acceptable for a judge demonstration: use one of the built-in demo scenarios whenever a fresh state is needed.

For durable SQLite storage, use `render.persistent.yaml` and a paid Render disk. A longer-lived production deployment should use a managed PostgreSQL database instead.

## Optional live AWS configuration

Set these variables only in the hosting provider's secret manager. Never commit credentials.

```env
ALLOW_MOCK_AI=false
AWS_REGION=ap-southeast-2
BEDROCK_MODEL_ID=<model available to the AWS account>
AWS_ACCESS_KEY_ID=<deployment IAM access key>
AWS_SECRET_ACCESS_KEY=<deployment IAM secret>

TRANSCRIBE_ENABLED=true
TRANSCRIBE_INPUT_BUCKET=<private bucket in the same region>
TRANSCRIBE_LANGUAGE_CODE=en-US
```

The deployment identity needs Bedrock invocation permission and, for audio, S3 object write/delete plus Amazon Transcribe start/get permissions. Organization Service Control Policies must also permit those actions.

## Connect Alexa+

After deployment, use the Alexa AI CLI with the public MCP URL:

```bash
alexa-ai configure
alexa-ai new mcp \
  --name "Experiment Guardian" \
  --mcp-server-url "https://YOUR-SERVICE.onrender.com/mcp"
alexa-ai deploy
alexa-ai test
```

The repository includes the MCP server implementation and `agent-skill/SKILL.md`. The web experience remains a clearly labeled Alexa+ simulation for repeatable judging.

## Production security note

The hackathon deployment is designed for a private judging URL and a single demonstration dataset. Before opening it to general users, add OAuth 2.1 account linking, bearer-token validation, per-user database ownership, retention controls, and rate limits.
