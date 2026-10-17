import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let clientPromise: Promise<Client> | null = null;

async function connectedClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new Client(
        { name: "experiment-guardian-web-simulator", version: "0.2.0" },
        { capabilities: {} },
      );
      await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", window.location.origin)));
      return client;
    })().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export async function callMcpTool<T = any>(name: string, args: Record<string, unknown> = {}) {
  const result = await (await connectedClient()).callTool({ name, arguments: args });
  if (result.isError) {
    const message = Array.isArray(result.content)
      ? result.content.map((item: any) => item.text || "").join(" ")
      : `MCP tool ${name} failed`;
    throw new Error(message);
  }
  return result.structuredContent as T;
}
