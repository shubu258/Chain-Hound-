# Chain-Hound-
ChainHound is an AI-powered blockchain investigation and fund-tracing engine.

## How to run
npm run dev      : tsx watch, auto-restarts on file changes
 or: npm run build && npm start

curl -X POST localhost:3000/api/wallet \
  -H 'content-type: application/json' \
  -d '{"walletAddress":"0xYourWalletHere"}'

## Frontend

The API runs on **port 3000** by default; the Next.js frontend (`web/`) runs on **port 3001** by
default specifically so the two never collide. Run both, in separate terminals:

```
npm run dev              # API — repo root, port 3000
cd web && npm run dev    # frontend — port 3001
```

Then open http://localhost:3001. The frontend proxies its `/api/*` calls to the API (see
`web/next.config.ts`) — if you run the API on a different port, set `CHAINHOUND_API_URL` before
starting the frontend, e.g. `CHAINHOUND_API_URL=http://localhost:4100 npm run dev`.

## ENS wallet naming (ENSv2, Sepolia)

ChainHound doesn't just name the searched wallet — it names every wallet in its immediate
transaction network, creating a readable map of related addresses instead of a list of raw hex
strings. This makes wallet clusters and fund flows human-identifiable at a glance.

Every `POST /api/wallet` call registers a real ENSv2 subname (on Sepolia) for the searched wallet,
plus one for every counterparty found in its transaction history (every `to` it sent to, every
`from` it received from). The naming is hierarchical and deterministic:

- Root wallet: `<address>.<parentName>` (e.g. `d8dabf...045.chainhound.eth`)
- Each counterparty: `<address>.<rootAddress>.<parentName>` — nested under the root's own
  subregistry, so the ENS hierarchy itself reflects "main wallet + everything it touched"
- The same wallet always gets the same leftmost label wherever it shows up, so it's instantly
  recognizable whether it's the root of one search or a counterparty in another

The response includes an `ensNetwork` field:

```json
{
  "ensNetwork": {
    "root": { "wallet": "0xd8da...045", "ensName": "d8da...045.chainhound.eth" },
    "counterparties": [
      { "wallet": "0xaaaa...111", "ensName": "aaaa...111.d8da...045.chainhound.eth" },
      { "wallet": "0xbbbb...222", "ensName": "bbbb...222.d8da...045.chainhound.eth" }
    ]
  }
}
```

so the frontend can print every node in the graph with a name instead of a raw address.

### One-time setup

1. Set `SEPOLIA_RPC_URL` and `ENS_PRIVATE_KEY` (a Sepolia account funded with a small amount of
   test ETH for gas) in `.env`.
2. Register the parent name once:
   ```
   PARENT_ENS_LABEL=chainhound npm run setup:ens
   ```
   This registers `<label>.eth` on Sepolia via ENSv2's real `ETHRegistrar` (paying the
   registration fee in a free-mint Sepolia test token it mints itself — no real funds beyond gas),
   deploys its subregistry (holds root-wallet-level names) and a shared resolver, and prints the
   three values to add to `.env`: `PARENT_ENS_NAME`, `PARENT_SUBREGISTRY_ADDRESS`,
   `PARENT_RESOLVER_ADDRESS`.
3. Every `/api/wallet` call from then on registers real subnames directly into that subregistry —
   no further payment token or commit-reveal involved, since it's a registry we control.

If `ENS_PRIVATE_KEY`/`SEPOLIA_RPC_URL` aren't configured, `/api/wallet` still works — `ensNetwork`
is returned with an `error` field instead of names.

 


