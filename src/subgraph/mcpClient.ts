import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const MCP_URL = process.env.SUBGRAPH_MCP_URL ?? 'https://subgraphs.mcp.thegraph.com/sse';

let clientPromise: Promise<Client> | null = null;

function authHeaders(): Record<string, string> {
  const apiKey = process.env.GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error('GATEWAY_API_KEY environment variable is required to connect to the Subgraph MCP server');
  }
  return { Authorization: `Bearer ${apiKey}` };
}

async function createClient(): Promise<Client> {
  const client = new Client({ name: 'chain-hound', version: '1.0.0' });
  const transport = new SSEClientTransport(new URL(MCP_URL), {
    // The initial SSE GET request bypasses `requestInit`, so headers for it must
    // be injected via a custom fetch instead (see SSEClientTransportOptions).
    eventSourceInit: {
      fetch: (url, init) =>
        fetch(url, { ...init, headers: { ...init.headers, ...authHeaders() } }),
    },
    requestInit: {
      headers: authHeaders(),
    },
  });
  await client.connect(transport);
  return client;
}

/** Lazily connects once and reuses the same MCP session for every subsequent call. */
export function getMcpClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createClient().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export async function closeMcpClient(): Promise<void> {
  if (!clientPromise) return;
  const client = await clientPromise;
  clientPromise = null;
  await client.close();
}

function extractText(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n');
}

/** Calls a tool on the Subgraph MCP server and returns its parsed JSON payload (or raw text if it isn't JSON). */
export async function callSubgraphTool<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const client = await getMcpClient();
  const result = await client.callTool({ name, arguments: args });
  const text = extractText(result);

  if (result.isError) {
    throw new Error(`Subgraph MCP tool "${name}" failed: ${text || 'unknown error'}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
