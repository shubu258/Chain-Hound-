// Client for The Graph's Token API (https://thegraph.com/docs/en/token-api/quick-start/).
//
// This is architecturally SEPARATE from src/subgraph/{mcpClient,dataRetrival}.ts, which talk to
// the Subgraph MCP server instead. Token API gives fast, wallet-indexed, cross-token history
// (exactly what a wallet's fund-flow needs) — something no single subgraph can do, since
// subgraphs are indexed per-contract/protocol, not per-wallet. Subgraph MCP is kept for
// protocol-level enrichment (swap mechanics, DeFi positions, etc.) that Token API doesn't cover.
// Do not merge these two pipelines — see Routes/dataFetching.ts for how their results are kept
// as separately labeled "source" blocks in the API response.
//
// Auth: a JWT access token issued via The Graph Market, not the GATEWAY_API_KEY used by the
// Subgraph MCP client — a different credential for a different product.

const TOKEN_API_BASE_URL = process.env.TOKEN_API_BASE_URL ?? 'https://token-api.thegraph.com';

function getAccessToken(): string {
  const token = process.env.TOKEN_API_ACCESS_TOKEN;
  if (!token) {
    throw new Error('TOKEN_API_ACCESS_TOKEN environment variable is required to call The Graph Token API');
  }
  return token;
}

export interface TokenApiTransfer {
  block_num: number;
  datetime: string;
  timestamp: number;
  transaction_id: string;
  log_index: number;
  contract: string;
  type: string;
  from: string;
  to: string;
  name: string;
  symbol: string;
  decimals: number;
  amount: string;
  value: number;
  network: string;
}

interface TokenApiEnvelope<T> {
  data: T[];
}

export interface TokenApiTransfersParams {
  network: string;
  from_address?: string;
  to_address?: string;
  contract?: string;
  limit?: number;
  page?: number;
  [key: string]: string | number | undefined;
}

/** Low-level authenticated GET against the Token API, returning the parsed `data` array. */
async function tokenApiGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T[]> {
  const url = new URL(path, TOKEN_API_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
  } catch (err) {
    throw new Error(`Token API request to ${path} failed: ${err instanceof Error ? err.message : err}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Token API request to ${path} failed (${response.status} ${response.statusText}): ${body}`);
  }

  const json = (await response.json()) as TokenApiEnvelope<T>;
  return Array.isArray(json.data) ? json.data : [];
}

/** GET /v1/evm/transfers — one page of ERC-20/native transfers matching `params`. */
export function getTransfersPage(params: TokenApiTransfersParams): Promise<TokenApiTransfer[]> {
  return tokenApiGet<TokenApiTransfer>('/v1/evm/transfers', params);
}
