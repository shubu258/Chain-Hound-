// Runs two independent, prescribed single-category conversations (src/subgraph/nlPrompts.ts)
// through an OpenAI tool-calling loop against the Subgraph MCP server's live tools — one for
// swaps (Uniswap V3), one for lending (Aave V3) — each using its own Gemini API key, so one
// category's free-tier quota exhaustion doesn't affect the other. Each instruction hardcodes the
// exact subgraph and GraphQL query; the model still makes the actual MCP tool call and summarizes
// the results in natural language (this stays MCP-driven, not a bypassed direct fetch), but it's
// exactly ONE prescribed tool call per category instead of the model searching/introspecting/
// querying across many protocols on its own.

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { callSubgraphTool } from './mcpClient.js';
import { getOpenAiClient, getMcpToolsAsOpenAiTools, DEFAULT_MODEL } from './openaiClient.js';
import { withGeminiRetry } from './geminiRetry.js';
import { fillCategoryTemplate, NL_CATEGORIES, type NlCategory } from './nlPrompts.js';
import { noopProgress, type ProgressEmitter } from '../progress.js';

export interface NlCategoryResult {
    results?: unknown[];
    sourcesUsed?: Array<{ subgraphId?: string; displayName?: string }>;
    truncated?: true;
    error?: string;
    raw?: string;
}

// One round is one Gemini call. Each prescribed instruction needs exactly 2 in the ideal case: the
// model calls the one hardcoded tool, then returns the final JSON. One extra round is slack for a
// retry/correction. A category that genuinely needs more than this just reports "Exceeded max tool
// round-trips" — handled as an error for that category only, not a failure of the whole request
// (see analyseData.ts's dataGaps).
const MAX_TOOL_ROUNDTRIPS = 3;

const SYSTEM_PROMPT = `You are a blockchain data agent. The user instruction prescribes an exact
tool call (name, ipfs_hash, query, variables) — call it exactly once with exactly those arguments,
then summarize the results as instructed. Do not search for or query any other subgraph.`;

// Each category's hardcoded subgraph query targets Ethereum mainnet specifically.
function isSupportedChain(chain: string): boolean {
    return chain.toLowerCase() === 'mainnet';
}

// Which Gemini API key each category uses — separate accounts/keys mean separate free-tier daily
// quota buckets, so one category running dry doesn't block the other.
const CATEGORY_API_KEY_ENV_VAR: Record<NlCategory, string> = {
    swaps: 'GEMINI_API_KEY',
    lending: 'GEMINI_API_KEY_LENDING',
};

const CATEGORY_LABEL: Record<NlCategory, string> = {
    swaps: 'Checking swaps (Uniswap V3)',
    lending: 'Checking lending (Aave V3)',
};

function emptyResult(note?: string): NlCategoryResult {
    return note ? { results: [], error: note } : { results: [] };
}

function parseCategoryResult(text: string): NlCategoryResult | undefined {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== 'object') return undefined;

    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.results)) return undefined;
    return {
        results: obj.results,
        sourcesUsed: Array.isArray(obj.sourcesUsed) ? (obj.sourcesUsed as NlCategoryResult['sourcesUsed']) : [],
    };
}

/**
 * Runs both categories' prescribed single-query instructions in parallel, each on its own Gemini
 * API key, returning a per-category result keyed the same way the old 5-separate-calls version
 * did (so dataRetrival.ts doesn't need to know the difference).
 */
export async function runCombinedCategories(
    chain: string,
    walletAddress: string,
    onProgress: ProgressEmitter = noopProgress,
): Promise<Record<NlCategory, NlCategoryResult>> {
    if (!isSupportedChain(chain)) {
        const note = `Only mainnet is supported for these lookups (got "${chain}")`;
        for (const category of NL_CATEGORIES) {
            onProgress({ step: `subgraph:${category}`, label: CATEGORY_LABEL[category], status: 'error', detail: note });
        }
        return Object.fromEntries(NL_CATEGORIES.map((c) => [c, emptyResult(note)])) as Record<NlCategory, NlCategoryResult>;
    }

    const entries = await Promise.all(
        NL_CATEGORIES.map(async (category): Promise<[NlCategory, NlCategoryResult]> => {
            const step = `subgraph:${category}`;
            const label = CATEGORY_LABEL[category];
            // A failure in one category (including a 429 that survives withGeminiRetry's retries) is
            // caught and turned into an error result for THAT category only — it must not take down
            // the other category, fundFlow, risk analysis, or ENS naming.
            try {
                return [category, await runCategoryConversation(category, walletAddress, step, label, onProgress)];
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                onProgress({ step, label, status: 'error', detail: message });
                return [category, { error: message }];
            }
        }),
    );

    return Object.fromEntries(entries) as Record<NlCategory, NlCategoryResult>;
}

async function runCategoryConversation(
    category: NlCategory,
    walletAddress: string,
    step: string,
    label: string,
    onProgress: ProgressEmitter,
): Promise<NlCategoryResult> {
    const openai = getOpenAiClient(CATEGORY_API_KEY_ENV_VAR[category]);
    const tools = await getMcpToolsAsOpenAiTools();
    const prompt = fillCategoryTemplate(category, walletAddress);

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
            const parsed = parseCategoryResult(message.content ?? '');
            if (parsed) {
                onProgress({ step, label, status: 'done' });
                return parsed;
            }
            onProgress({ step, label, status: 'error', detail: 'Model did not return valid JSON' });
            return { error: 'Model did not return valid JSON', raw: message.content ?? '', truncated: true };
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
    return { error: 'Exceeded max tool round-trips', raw: lastText, truncated: true };
}
