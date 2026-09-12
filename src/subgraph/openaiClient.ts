// Lazy Gemini client (via Google's OpenAI-compatible endpoint) + MCP-tools-as-OpenAI-tools
// bridge for src/subgraph/nlAgent.ts.
//
// We talk to Gemini through Google's OpenAI-compatibility layer
// (https://ai.google.dev/gemini-api/docs/openai) rather than the native @google/genai SDK, so
// nlAgent.ts's tool-calling loop can stay in standard OpenAI chat-completions wire format.
//
// The point of routing tool selection through the model (rather than the old hardcoded keyword
// tables) is that the model sees the *real* tool schemas/descriptions live from the MCP server —
// see getMcpToolsAsOpenAiTools — instead of a subset we guessed at ahead of time.

import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { getMcpClient } from './mcpClient.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

// gemini-3.5-flash over the newer 3.6: free-tier request quota is tracked per model
// (GenerateRequestsPerDayPerProjectPerModel-FreeTier), and 3.6-flash's free-tier daily cap is
// far tighter (20/day) than 3.5-flash's, being the newer/preview model.
export const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash';

const clients = new Map<string, OpenAI>();

/**
 * Returns a client for the Gemini API key in `apiKeyEnvVar` (default GEMINI_API_KEY), memoized per
 * env var. Callers that need a separate free-tier quota bucket per use case (see nlAgent.ts's
 * per-category API keys) pass a different env var name; each gets its own client/quota.
 */
export function getOpenAiClient(apiKeyEnvVar: string = 'GEMINI_API_KEY'): OpenAI {
  let client = clients.get(apiKeyEnvVar);
  if (!client) {
    const apiKey = process.env[apiKeyEnvVar];
    if (!apiKey) {
      throw new Error(`${apiKeyEnvVar} environment variable is required to run the natural-language MCP agent`);
    }
    client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
    clients.set(apiKeyEnvVar, client);
  }
  return client;
}

let toolsPromise: Promise<ChatCompletionTool[]> | null = null;

/** Fetches the MCP server's live tool list once and maps it into OpenAI's function-tool shape. */
export function getMcpToolsAsOpenAiTools(): Promise<ChatCompletionTool[]> {
  if (!toolsPromise) {
    toolsPromise = (async () => {
      const mcp = await getMcpClient();
      const { tools } = await mcp.listTools();
      return tools.map((tool): ChatCompletionTool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description ?? '',
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      }));
    })().catch((err) => {
      toolsPromise = null;
      throw err;
    });
  }
  return toolsPromise;
}
