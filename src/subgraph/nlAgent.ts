// Runs one of the NL_TEMPLATES (src/subgraph/nlPrompts.ts) through an OpenAI tool-calling loop
// against the Subgraph MCP server's live tools, replacing the old hardcoded keyword/introspection
// pipeline that used to live in dataRetrival.ts. The model decides which MCP tools to call (which
// keyword to search, which subgraph/ipfs_hash to query, what GraphQL to run) instead of us.

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { callSubgraphTool } from './mcpClient.js';
import { getOpenAiClient, getMcpToolsAsOpenAiTools, DEFAULT_MODEL } from './openaiClient.js';
import { fillTemplate, type NlCategory } from './nlPrompts.js';

export interface NlCategoryResult {
    results?: unknown[];
    sourcesUsed?: Array<{ subgraphId?: string; displayName?: string }>;
    truncated?: true;
    error?: string;
    raw?: string;
}

// Kept deliberately low: each round is one Gemini call, and this runs once per category (5
// categories) per wallet search. At 8 this could burn up to 40 Gemini calls analyzing a single
// wallet, easily exhausting a free-tier daily quota in one search. 2 rounds is the minimum that
// still lets the model call a tool and then answer from its result; a category that genuinely
// needs more just reports "Exceeded max tool round-trips" for that category (handled as a
// per-category error, not a failure of the whole request — see analyseData.ts's dataGaps).
const MAX_TOOL_ROUNDTRIPS = 2;

const SYSTEM_PROMPT = `You are a blockchain data agent. You have tools to discover and query The
Graph subgraphs (search by keyword, introspect schema, execute GraphQL queries). Use them to
fulfil the user's instruction as precisely as possible: find the relevant subgraph(s), inspect
their schema if needed, and query for the wallet's data.

When you are done, respond with ONLY a single JSON object (no prose, no markdown fences) of the
shape:
{
  "results": [ ...one object per matching event/record, with exactly the fields the instruction asked for... ],
  "sourcesUsed": [ { "subgraphId": "...", "displayName": "..." } ]
}
If you find nothing, return "results": [].`;

function safeParseJson(text: string): { results?: unknown[]; sourcesUsed?: unknown[] } | undefined {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

export async function runNlCategory(category: NlCategory, chain: string, walletAddress: string): Promise<NlCategoryResult> {
    const openai = getOpenAiClient();
    const tools = await getMcpToolsAsOpenAiTools();
    const prompt = fillTemplate(category, chain, walletAddress);

    const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
    ];

    let lastText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
        const completion = await openai.chat.completions.create({
            model: DEFAULT_MODEL,
            messages,
            tools,
        });

        const choice = completion.choices[0];
        const message = choice?.message;
        if (!message) break;

        lastText = message.content ?? lastText;

        if (!message.tool_calls?.length) {
            const parsed = safeParseJson(message.content ?? '');
            if (parsed) {
                return {
                    results: Array.isArray(parsed.results) ? parsed.results : [],
                    sourcesUsed: Array.isArray(parsed.sourcesUsed) ? (parsed.sourcesUsed as NlCategoryResult['sourcesUsed']) : [],
                };
            }
            return { error: 'Model did not return valid JSON', raw: message.content ?? '' };
        }

        messages.push({ role: 'assistant', content: message.content, tool_calls: message.tool_calls });

        for (const toolCall of message.tool_calls) {
            if (toolCall.type !== 'function') continue;
            let toolResultText: string;
            try {
                const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
                const result = await callSubgraphTool(toolCall.function.name, args);
                toolResultText = typeof result === 'string' ? result : JSON.stringify(result);
            } catch (err) {
                toolResultText = `Error calling tool "${toolCall.function.name}": ${err instanceof Error ? err.message : err}`;
            }
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResultText });
        }
    }

    return { error: 'Exceeded max tool round-trips', raw: lastText, truncated: true };
}
