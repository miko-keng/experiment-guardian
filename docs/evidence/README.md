# MCP Inspector evidence

Run `npm run trace:mcp` from the repository root. The command builds the backend, starts an isolated local Streamable HTTP MCP server, checks the advertised inventory, invokes every advertised Experiment Guardian tool through the pinned official MCP Inspector CLI, and writes:

- `mcp-inspector-trace.json`: complete machine-readable requests and results.
- `mcp-inspector-trace.md`: concise reviewer summary.

The runner uses a temporary SQLite database and deletes it after the trace. It never changes demo or production records.

## How to interpret this evidence

The included Inspector trace was regenerated on **21 October 2026**. It contains 19 successful calls against the 19 tools advertised by the current local build, including the read-only `get_experiment_verification` tool. It uses a disposable database and mock extraction. It does **not** prove live GitLab/MLflow, Bedrock, or official Alexa+ routing.

A separate local linked-review integration test negotiated MCP protocol `2025-11-25` and exercised approval, rejection, and report generation against simulated source responses. A deployed read-only check listed 19 tools and called `list_experiments`. See [submission verification status](../SUBMISSION.md#implemented-versus-verified) for the distinctions.

The trace JSON contains isolated demonstration records and generated UUIDs. A scan found no AWS access key, GitHub or GitLab token, private key, or bearer header pattern. Do not substitute the trace for a live source or model-access check.
