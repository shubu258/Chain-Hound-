// Runs ONE combined instruction (src/subgraph/nlPrompts.ts) through an OpenAI tool-calling loop
// against the Subgraph MCP server's live tools — covering all 5 wallet-investigation categories
// in a single Gemini conversation instead of 5 separate ones (see nlPrompts.ts for why). The model
// decides which MCP tools to call (which keyword to search, which subgraph/ipfs_hash to query,
// what GraphQL to run) instead of us.

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { callSubgraphTool } from './mcpClient.js';
import { getOpenAiClient, getMcpToolsAsOpenAiTools, DEFAULT_MODEL } from './openaiClient.js';
import { withGeminiRetry } from './geminiRetry.js';
import { fillCombinedTemplate, NL_CATEGORIES, type NlCategory } from './nlPrompts.js';
import { noopProgress, type ProgressEmitter } from '../progress.js';

export interface NlCategoryResult {
    results?: unknown[];
    sourcesUsed?: Array<{ subgraphId?: string; displayName?: string }>;
    truncated?: true;
    error?: string;
    raw?: string;
}

// One round is one Gemini call. Covering all 5 categories in a single conversation genuinely
// needs more rounds than one category alone did (discovery + several category-specific queries +
// the final answer, across up to 5 different protocols) — 6 was cutting it off mid-investigation
// in practice. Gemini's free-tier limiter tracks requests per minute, not (mainly) per day, so
// more rounds costs burst headroom rather than daily quota; withGeminiRetry absorbs the resulting
// 429s. A wallet that genuinely needs more than this just reports "Exceeded max tool round-trips"
// — handled as a per-category error below, not a failure of the whole request (see
// analyseData.ts's dataGaps).
const MAX_TOOL_ROUNDTRIPS = 10;

const SYSTEM_PROMPT = `You are a blockchain data agent. You have tools to discover and query The
Graph subgraphs (search by keyword, introspect schema, execute GraphQL queries). Use them to
fulfil the user's instruction as precisely as possible: find the relevant subgraph(s), inspect
their schema if needed, and query for the wallet's data across every category asked for.`;

function allError(message: string, raw?: string): Record<NlCategory, NlCategoryResult> {
    const entry: NlCategoryResult = raw !== undefined ? { error: message, raw, truncated: true } : { error: message };
    return Object.fromEntries(NL_CATEGORIES.map((category) => [category, entry])) as Record<NlCategory, NlCategoryResult>;
}

function parseCombinedResult(text: string): Record<NlCategory, NlCategoryResult> | undefined {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== 'object') return undefined;

    const obj = parsed as Record<string, unknown>;
    const result = {} as Record<NlCategory, NlCategoryResult>;
    for (const category of NL_CATEGORIES) {
        const entry = obj[category];
        if (entry && typeof entry === 'object') {
            const e = entry as Record<string, unknown>;
            result[category] = {
                results: Array.isArray(e.results) ? e.results : [],
                sourcesUsed: Array.isArray(e.sourcesUsed) ? (e.sourcesUsed as NlCategoryResult['sourcesUsed']) : [],
            };
        } else {
            result[category] = { error: `Model response was missing the "${category}" key` };
        }
    }
    return result;
}

/**
 * Runs the combined 5-category instruction for `walletAddress` through a single Gemini
 * tool-calling loop, returning a per-category result keyed the same way the old 5-separate-calls
 * version did (so dataRetrival.ts doesn't need to know the difference).
 */
export async function runCombinedCategories(
    chain: string,
    walletAddress: string,
    onProgress: ProgressEmitter = noopProgress,
): Promise<Record<NlCategory, NlCategoryResult>> {
    const step = 'subgraph';
    const label = 'Checking wallet activity (swaps, lending, nft, bridge, fullSweep)';

    // Everything here — including a 429 that survives withGeminiRetry's retries — is caught and
    // turned into a per-category error result rather than thrown. This is now ONE shared
    // conversation for all 5 categories (see nlPrompts.ts), so a failure partway through
    // legitimately means all 5 categories are unanswered — but it must NOT take down fundFlow,
    // risk analysis, or ENS naming too, the way an unhandled rejection out of getWalletData would
    // (analyzeWallet.ts throws whole-request on a rejected Subgraph MCP fetch).
    try {
        return await runConversation(chain, walletAddress, step, label, onProgress);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onProgress({ step, label, status: 'error', detail: message });
        return allError(message);
    }
}

async function runConversation(
    chain: string,
    walletAddress: string,
    step: string,
    label: string,
    onProgress: ProgressEmitter,
): Promise<Record<NlCategory, NlCategoryResult>> {
    const openai = getOpenAiClient();
    const tools = await getMcpToolsAsOpenAiTools();
    const prompt = fillCombinedTemplate(chain, walletAddress);

    onProgress({ step, label, status: 'start' });

    const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
    ];

    let lastText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
        const completion = await withGeminiRetry(
            () => openai.chat.completions.create({ model: DEFAULT_MODEL, messages, tools }),
            (waitMs) =>
                onProgress({
                    step,
                    label,
                    status: 'start',
                    detail: `Rate limited — retrying in ${Math.round(waitMs / 1000)}s`,
                }),
        );

        const choice = completion.choices[0];
        const message = choice?.message;
        if (!message) break;

        lastText = message.content ?? lastText;

        if (!message.tool_calls?.length) {
            const parsed = parseCombinedResult(message.content ?? '');
            if (parsed) {
                onProgress({ step, label, status: 'done' });
                return parsed;
            }
            onProgress({ step, label, status: 'error', detail: 'Model did not return valid JSON' });
            return allError('Model did not return valid JSON', message.content ?? '');
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

    onProgress({ step, label, status: 'error', detail: 'Exceeded max tool round-trips' });
    return allError('Exceeded max tool round-trips', lastText);
}
