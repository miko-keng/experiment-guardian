# MCP Inspector evidence

Run `npm run trace:mcp` from the repository root. The command builds the backend, starts an isolated local Streamable HTTP MCP server, checks the advertised inventory, invokes every advertised Experiment Guardian tool through the pinned official MCP Inspector CLI, and writes:

- `mcp-inspector-trace.json`: complete machine-readable requests and results.
- `mcp-inspector-trace.md`: concise reviewer summary.

The runner uses a temporary SQLite database and deletes it after the trace. It never changes demo or production records.
