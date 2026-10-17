# Alexa+ add-on package

This package connects Alexa+'s language model to the public Streamable HTTP MCP endpoint at `https://experiment-guardian.onrender.com/mcp`.

Alexa+ interprets the researcher's request, chooses an MCP tool, supplies structured arguments, speaks the result, and asks for confirmation when a tool returns a pending approval. Experiment Guardian stores evidence, runs deterministic audits, creates revisions, and applies only explicitly approved changes.

## Optional official deployment

1. Confirm all URLs in `addon-package/addon.json` return successfully.
2. Install the Alexa AI CLI with `npm install -g @alexa-ai/cli`.
3. Authenticate with `alexa-ai login`.
4. Validate and deploy from this directory using the commands exposed by the enabled CLI version.
5. Test the deployed add-on in the official Alexa+ web simulator.

The CLI package returned npm `E404 Not Found` on October 17, 2026. The hackathon permits the included web simulator path, which now calls the same public MCP protocol directly. Official deployment remains optional and requires an Amazon developer account with add-on access.
