import { callSubgraphTool } from './mcpClient.js';

// Chain isn't enforced server-side: search_subgraphs_by_keyword (the only discovery tool that
// doesn't require a contract address) matches on display name only, with no network filter.
// It's kept here for callers/output only — see getWalletData.
export type Chain = string;

export interface WalletQueryOptions {
  /** Max rows fetched per matched address field, per subgraph (default 100). */
  limit?: number;
  /** How many subgraphs to try per individual keyword (default 1). */
  perKeywordLimit?: number;
  /** Overrides the default keyword(s) used to search for this category's subgraphs. */
  keywords?: string[];
  /** How many levels of nested object fields (transaction, pool, token0, ...) to expand (default 2). */
  selectionDepth?: number;
}

interface ResultSource {
  subgraphId: string;
  displayName: string;
  ipfsHash: string;
}

export interface TokenBalance {
  owner: string;
  amount: string | undefined;
  source: ResultSource;
  raw: Record<string, unknown>;
}

export interface TokenTransfer {
  id: string;
  from: string;
  to: string;
  amount: string | undefined;
  timestamp: string | undefined;
  transactionHash: string | undefined;
  /** transaction.from — the wallet that initiated + paid gas, which can differ from `from` above. */
  feePayer: string | undefined;
  source: ResultSource;
  raw: Record<string, unknown>;
}

export interface SwapActivity {
  id: string;
  wallet: string;
  matchedField: string;
  amount0: string | undefined;
  amount1: string | undefined;
  amount0In: string | undefined;
  amount0Out: string | undefined;
  amount1In: string | undefined;
  amount1Out: string | undefined;
  sqrtPriceX96: string | undefined;
  tick: string | undefined;
  logIndex: string | undefined;
  timestamp: string | undefined;
  transactionHash: string | undefined;
  feePayer: string | undefined;
  source: ResultSource;
  raw: Record<string, unknown>;
}

export interface NftOwnership {
  id: string;
  owner: string;
  tokenId: string | undefined;
  from: string | undefined;
  to: string | undefined;
  seller: string | undefined;
  buyer: string | undefined;
  priceUSD: string | undefined;
  timestamp: string | undefined;
  transactionHash: string | undefined;
  feePayer: string | undefined;
  source: ResultSource;
  raw: Record<string, unknown>;
}

export interface LendingActivity {
  id: string;
  wallet: string;
  matchedField: string;
  action: string; // the matched query field name, e.g. "deposits", "borrows", "liquidationCalls"
  amount: string | undefined;
  timestamp: string | undefined;
  transactionHash: string | undefined;
  feePayer: string | undefined;
  source: ResultSource;
  raw: Record<string, unknown>;
}

export interface WalletData {
  walletAddress: string;
  chain: Chain;
  balances: TokenBalance[];
  transfers: TokenTransfer[];
  swaps: SwapActivity[];
  nftOwnerships: NftOwnership[];
  lending: LendingActivity[];
}

type Category = 'balances' | 'transfers' | 'swaps' | 'nftOwnerships' | 'lending';

const DEFAULT_LIMIT = 100;
const DEFAULT_PER_KEYWORD_LIMIT = 1;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Search keywords match subgraph *display names* (see search_subgraphs_by_keyword_internal in
// graphops/subgraph-mcp). Named protocols surface far more relevant, wallet-scoped subgraphs
// than generic terms like "token"/"swap" (which mostly matched unrelated/wrong-chain results).
const DEFAULT_KEYWORDS: Record<Category, string[]> = {
  balances: ['token'],
  transfers: ['erc20', 'token transfer', 'transfer'],
  swaps: ['uniswap', 'sushiswap', 'curve', '1inch', 'swap'],
  nftOwnerships: ['opensea', 'blur', 'nft'],
  lending: ['aave', 'compound', 'lending'],
};

// Query-root collection field names (e.g. "transfers") are matched against these.
const CATEGORY_FIELD_KEYWORDS: Record<Category, string[]> = {
  balances: ['balance', 'holder', 'holding', 'position'],
  transfers: ['transfer'],
  swaps: ['swap', 'trade'],
  nftOwnerships: ['ownership', 'nft', 'token'],
  lending: ['deposit', 'borrow', 'repay', 'liquidat', 'withdraw', 'supply'],
};

const ADDRESS_FIELD_CANDIDATES: Record<Category, string[]> = {
  balances: ['owner', 'account', 'holder', 'user', 'address'],
  transfers: ['from', 'to', 'sender', 'receiver'],
  swaps: ['sender', 'recipient', 'origin', 'user', 'trader', 'account'],
  nftOwnerships: ['owner', 'account', 'holder', 'to', 'seller', 'buyer'],
  lending: ['user', 'account', 'borrower', 'depositor', 'onbehalfof', 'caller'],
};

const DEFAULT_SELECTION_DEPTH = 2;

export function isValidWalletAddress(address: string): boolean {
  return ADDRESS_RE.test(address);
}

function normalizeAddress(address: string): string {
  if (!ADDRESS_RE.test(address)) {
    throw new Error(`Invalid EVM address: ${address}`);
  }
  return address.toLowerCase();
}

// --- Subgraph discovery (by keyword, not by contract) --------------------------------------

const searchCache = new Map<string, ResultSource[]>();

/** Searches subgraphs by display-name keyword, ranked by signal (see search_subgraphs_by_keyword_internal). */
async function searchSubgraphs(keyword: string): Promise<ResultSource[]> {
  const cached = searchCache.get(keyword);
  if (cached) return cached;

  const result = await callSubgraphTool('search_subgraphs_by_keyword', { keyword });
  const parsed = typeof result === 'string' ? JSON.parse(result) : result;
  const list = Array.isArray((parsed as any)?.subgraphs) ? (parsed as any).subgraphs : [];

  const sources: ResultSource[] = list
    .map((s: any) => ({
      subgraphId: String(s?.id ?? ''),
      displayName: String(s?.metadata?.displayName ?? ''),
      ipfsHash: s?.currentVersion?.subgraphDeployment?.ipfsHash,
    }))
    .filter((s: ResultSource) => typeof s.ipfsHash === 'string' && s.ipfsHash.length > 0);

  searchCache.set(keyword, sources);
  return sources;
}

/** Searches every keyword individually and takes the top `perKeywordLimit` distinct subgraphs from each. */
async function findCandidateSources(keywords: string[], perKeywordLimit: number): Promise<ResultSource[]> {
  const seen = new Set<string>();
  const candidates: ResultSource[] = [];

  const resultsPerKeyword = await Promise.all(keywords.map((kw) => searchSubgraphs(kw)));
  for (const results of resultsPerKeyword) {
    let taken = 0;
    for (const source of results) {
      if (taken >= perKeywordLimit) break;
      if (seen.has(source.ipfsHash)) continue;
      seen.add(source.ipfsHash);
      candidates.push(source);
      taken++;
    }
  }
  return candidates;
}

// --- GraphQL execution + introspection ------------------------------------------------------

interface IntrospectionTypeRef {
  kind: string;
  name: string | null;
  ofType?: IntrospectionTypeRef | null;
}

interface IntrospectionField {
  name: string;
  args: Array<{ name: string }>;
  type: IntrospectionTypeRef;
}

function unwrapType(type: IntrospectionTypeRef): { kind: string; name: string | null; isList: boolean } {
  let t: IntrospectionTypeRef | undefined = type;
  let isList = false;
  while (t && (t.kind === 'NON_NULL' || t.kind === 'LIST')) {
    if (t.kind === 'LIST') isList = true;
    t = t.ofType ?? undefined;
  }
  return { kind: t?.kind ?? 'SCALAR', name: t?.name ?? null, isList };
}

async function executeQuery(ipfsHash: string, query: string): Promise<Record<string, any>> {
  const result = await callSubgraphTool('execute_query_by_ipfs_hash', {
    ipfs_hash: ipfsHash,
    query,
  });
  const parsed = typeof result === 'string' ? JSON.parse(result) : result;
  const body: { data?: Record<string, any> } =
    parsed && typeof parsed === 'object' && 'data' in (parsed as object) ? (parsed as any) : { data: parsed };
  return body.data ?? {};
}

const FIELD_INTROSPECTION = `
  name
  args { name }
  type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
`;

const queryFieldsCache = new Map<string, IntrospectionField[]>();

async function getQueryFields(ipfsHash: string): Promise<IntrospectionField[]> {
  const cached = queryFieldsCache.get(ipfsHash);
  if (cached) return cached;

  const data = await executeQuery(ipfsHash, `{ __schema { queryType { fields { ${FIELD_INTROSPECTION} } } } }`);
  const fields: IntrospectionField[] = data.__schema?.queryType?.fields ?? [];
  queryFieldsCache.set(ipfsHash, fields);
  return fields;
}

const typeFieldsCache = new Map<string, IntrospectionField[]>();

async function getTypeFields(ipfsHash: string, typeName: string): Promise<IntrospectionField[]> {
  const cacheKey = `${ipfsHash}:${typeName}`;
  const cached = typeFieldsCache.get(cacheKey);
  if (cached) return cached;

  const data = await executeQuery(ipfsHash, `{ __type(name: "${typeName}") { fields { ${FIELD_INTROSPECTION} } } }`);
  const fields: IntrospectionField[] = data.__type?.fields ?? [];
  typeFieldsCache.set(cacheKey, fields);
  return fields;
}

/** Picks the query-root collection field (e.g. "transfers") whose name best matches the category, if any. */
function pickCollectionField(
  fields: IntrospectionField[],
  category: Category,
): { field: IntrospectionField; typeName: string } | undefined {
  const candidates = fields
    .map((f) => ({ f, unwrapped: unwrapType(f.type) }))
    .filter((c) => c.unwrapped.isList && c.unwrapped.kind === 'OBJECT' && c.f.args.some((a) => a.name === 'where'));

  const keywords = CATEGORY_FIELD_KEYWORDS[category];
  const scored = candidates
    .map((c) => ({ ...c, score: keywords.reduce((s, kw) => s + (c.f.name.toLowerCase().includes(kw) ? 1 : 0), 0) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return undefined;
  return { field: scored[0].f, typeName: scored[0].unwrapped.name! };
}

/**
 * Selects every field the type exposes — leaf fields (scalars, enums, lists of either) as-is;
 * *singular* entity/interface-typed fields are expanded recursively up to `depth` levels (via
 * introspection of the referenced type, not guessed field names) so things like
 * `transaction { blockNumber gasUsed from ... }` or `pool { token0 { symbol decimals } }` come
 * back with real detail instead of just `{ id }`. Once `depth` is exhausted, remaining singular
 * refs fall back to `{ id }`.
 *
 * List-typed entity relations (e.g. `pool.swaps`) are dropped entirely rather than expanded —
 * nested in a selection they get no `first` bound, and expanding one (e.g. a pool's full swap
 * history) is exactly what caused indexer timeouts when this was tried unbounded.
 */
async function buildSelection(ipfsHash: string, fields: IntrospectionField[], depth: number): Promise<string> {
  const parts: string[] = [];
  for (const f of fields) {
    const u = unwrapType(f.type);
    const isRef = u.kind === 'OBJECT' || u.kind === 'INTERFACE';

    if (isRef && u.isList) continue; // unbounded relation list — never safe to expand here
    if (!isRef) {
      parts.push(f.name);
      continue;
    }
    if (depth <= 0 || !u.name) {
      parts.push(`${f.name} { id }`);
      continue;
    }
    const nestedFields = await getTypeFields(ipfsHash, u.name);
    const nestedSelection = await buildSelection(ipfsHash, nestedFields, depth - 1);
    parts.push(`${f.name} { ${nestedSelection} }`);
  }
  if (!parts.some((p) => p === 'id')) parts.unshift('id');
  return parts.join('\n      ');
}

function findAddressFields(fields: IntrospectionField[], candidates: string[]): string[] {
  const names = new Set(fields.map((f) => f.name.toLowerCase()));
  return candidates.filter((c) => names.has(c.toLowerCase()));
}

interface CategoryRow {
  row: Record<string, unknown>;
  source: ResultSource;
  matchedAddressFields: string[];
  queryField: string;
}

/**
 * Searches for subgraphs matching `category`'s keywords (every keyword individually — not just
 * the first one), and for each candidate (via introspection, not schema guessing) resolves the
 * real collection query field and queries it for every matching wallet-address field, merging +
 * de-duping across all candidate subgraphs. A candidate that doesn't fit the category, or whose
 * query fails, is skipped rather than failing the whole category — coverage is inherently
 * best-effort since we're searching by keyword rather than a known contract.
 */
async function fetchCategory(
  category: Category,
  wallet: string,
  options: WalletQueryOptions,
): Promise<{ rows: CategoryRow[]; sourcesSearched: ResultSource[] }> {
  const keywords = options.keywords ?? DEFAULT_KEYWORDS[category];
  const perKeywordLimit = options.perKeywordLimit ?? DEFAULT_PER_KEYWORD_LIMIT;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const selectionDepth = options.selectionDepth ?? DEFAULT_SELECTION_DEPTH;

  const candidates = await findCandidateSources(keywords, perKeywordLimit);
  const rowsById = new Map<string, CategoryRow>();

  for (const source of candidates) {
    try {
      const queryFields = await getQueryFields(source.ipfsHash);
      const picked = pickCollectionField(queryFields, category);
      if (!picked) continue;

      const entityFields = await getTypeFields(source.ipfsHash, picked.typeName);
      const matched = findAddressFields(entityFields, ADDRESS_FIELD_CANDIDATES[category]);
      if (!matched.length) continue;

      const selection = await buildSelection(source.ipfsHash, entityFields, selectionDepth);

      for (const candidateField of matched) {
        const actualField = entityFields.find((f) => f.name.toLowerCase() === candidateField.toLowerCase())!.name;
        const query = `{
          ${picked.field.name}(first: ${limit}, where: { ${actualField}: "${wallet}" }) {
            ${selection}
          }
        }`;
        const data = await executeQuery(source.ipfsHash, query);
        const rows: Array<Record<string, unknown>> = data[picked.field.name] ?? [];
        for (const row of rows) {
          const key = `${source.ipfsHash}:${row.id ?? JSON.stringify(row)}`;
          rowsById.set(key, { row, source, matchedAddressFields: matched, queryField: picked.field.name });
        }
      }
    } catch (err) {
      console.warn(
        `[dataRetrival] skipping "${source.displayName}" (${source.ipfsHash}) for category "${category}": ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  return { rows: Array.from(rowsById.values()), sourcesSearched: candidates };
}

function extractRef(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).id);
  }
  return String(value);
}

function firstDefined(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

/**
 * The wallet that initiated + paid gas for the transaction — read from the (now recursively
 * expanded) nested `transaction`/`tx` block. This can differ from the entity's own from/sender
 * field, e.g. when a router or another contract executes on the wallet's behalf.
 */
function feePayerFrom(row: Record<string, unknown>): string | undefined {
  const tx = firstDefined(row, ['transaction', 'tx']);
  if (!tx || typeof tx !== 'object') return undefined;
  return extractRef(firstDefined(tx as Record<string, unknown>, ['from', 'sender', 'signer']));
}

// --- Public API -------------------------------------------------------------------------------

/** GET balances → current token holdings for `walletAddress`, across subgraphs matched by keyword. */
export async function getWalletBalances(
  walletAddress: string,
  options: WalletQueryOptions = {},
): Promise<TokenBalance[]> {
  const wallet = normalizeAddress(walletAddress);
  const { rows } = await fetchCategory('balances', wallet, options);
  return rows.map(({ row, source }) => ({
    owner: wallet,
    amount: firstDefined(row, ['amount', 'balance', 'value']) as string | undefined,
    source,
    raw: row,
  }));
}

/** GET transfers → transfer history involving `walletAddress`, as either sender or receiver. */
export async function getWalletTransfers(
  walletAddress: string,
  options: WalletQueryOptions = {},
): Promise<TokenTransfer[]> {
  const wallet = normalizeAddress(walletAddress);
  const { rows } = await fetchCategory('transfers', wallet, options);
  return rows.map(({ row, source }) => ({
    id: String(row.id),
    from: extractRef(firstDefined(row, ['from', 'sender'])) ?? '',
    to: extractRef(firstDefined(row, ['to', 'receiver'])) ?? '',
    amount: firstDefined(row, ['amount', 'value']) as string | undefined,
    timestamp: firstDefined(row, ['timestamp', 'blockTimestamp']) as string | undefined,
    transactionHash: extractRef(firstDefined(row, ['transactionHash', 'transaction', 'txHash'])),
    feePayer: feePayerFrom(row),
    source,
    raw: row,
  }));
}

/** GET swaps → swap activity involving `walletAddress` in any sender/recipient/origin role. */
export async function getWalletSwaps(
  walletAddress: string,
  options: WalletQueryOptions = {},
): Promise<SwapActivity[]> {
  const wallet = normalizeAddress(walletAddress);
  const { rows } = await fetchCategory('swaps', wallet, options);
  return rows.map(({ row, source, matchedAddressFields }) => ({
    id: String(row.id),
    wallet,
    matchedField: matchedAddressFields.find((f) => row[f] !== undefined) ?? matchedAddressFields[0],
    amount0: firstDefined(row, ['amount0']) as string | undefined,
    amount1: firstDefined(row, ['amount1']) as string | undefined,
    amount0In: firstDefined(row, ['amount0In', 'amountIn']) as string | undefined,
    amount0Out: firstDefined(row, ['amount0Out']) as string | undefined,
    amount1In: firstDefined(row, ['amount1In']) as string | undefined,
    amount1Out: firstDefined(row, ['amount1Out', 'amountOut']) as string | undefined,
    sqrtPriceX96: firstDefined(row, ['sqrtPriceX96']) as string | undefined,
    tick: firstDefined(row, ['tick']) as string | undefined,
    logIndex: firstDefined(row, ['logIndex']) as string | undefined,
    timestamp: firstDefined(row, ['timestamp', 'blockTimestamp']) as string | undefined,
    transactionHash: extractRef(firstDefined(row, ['transactionHash', 'transaction', 'txHash'])),
    feePayer: feePayerFrom(row),
    source,
    raw: row,
  }));
}

/** GET nft/ownerships → NFTs currently (or historically, per schema) owned by `walletAddress`. */
export async function getWalletNftOwnerships(
  walletAddress: string,
  options: WalletQueryOptions = {},
): Promise<NftOwnership[]> {
  const wallet = normalizeAddress(walletAddress);
  const { rows } = await fetchCategory('nftOwnerships', wallet, options);
  return rows.map(({ row, source }) => ({
    id: String(row.id),
    owner: extractRef(firstDefined(row, ['owner', 'account', 'holder'])) ?? wallet,
    tokenId: firstDefined(row, ['tokenId', 'identifier']) as string | undefined,
    from: extractRef(firstDefined(row, ['from', 'sender'])),
    to: extractRef(firstDefined(row, ['to', 'receiver'])),
    seller: extractRef(firstDefined(row, ['seller'])),
    buyer: extractRef(firstDefined(row, ['buyer'])),
    priceUSD: firstDefined(row, ['priceUSD', 'priceETH', 'price']) as string | undefined,
    timestamp: firstDefined(row, ['timestamp', 'blockTimestamp']) as string | undefined,
    transactionHash: extractRef(firstDefined(row, ['transactionHash', 'transaction', 'txHash'])),
    feePayer: feePayerFrom(row),
    source,
    raw: row,
  }));
}

/** GET lending → lending-protocol activity (deposits/borrows/repayments/liquidations/...) involving `walletAddress`. */
export async function getWalletLending(
  walletAddress: string,
  options: WalletQueryOptions = {},
): Promise<LendingActivity[]> {
  const wallet = normalizeAddress(walletAddress);
  const { rows } = await fetchCategory('lending', wallet, options);
  return rows.map(({ row, source, matchedAddressFields, queryField }) => ({
    id: String(row.id),
    wallet,
    matchedField: matchedAddressFields.find((f) => row[f] !== undefined) ?? matchedAddressFields[0],
    action: queryField,
    amount: firstDefined(row, ['amount', 'value', 'amountUSD']) as string | undefined,
    timestamp: firstDefined(row, ['timestamp', 'blockTimestamp']) as string | undefined,
    transactionHash: extractRef(firstDefined(row, ['transactionHash', 'transaction', 'txHash'])),
    feePayer: feePayerFrom(row),
    source,
    raw: row,
  }));
}

/** Fetches every category in parallel for `walletAddress`, via keyword-discovered subgraphs. */
export async function getWalletData(
  walletAddress: string,
  chain: Chain,
  options: WalletQueryOptions = {},
): Promise<WalletData> {
  const wallet = normalizeAddress(walletAddress);

  const [balances, transfers, swaps, nftOwnerships, lending] = await Promise.all([
    getWalletBalances(wallet, options),
    getWalletTransfers(wallet, options),
    getWalletSwaps(wallet, options),
    getWalletNftOwnerships(wallet, options),
    getWalletLending(wallet, options),
  ]);

  return { walletAddress: wallet, chain, balances, transfers, swaps, nftOwnerships, lending };
}
