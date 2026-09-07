# ChainHound — Project Master Document

> **The address-trust layer machines can query — and the only fund tracer that shows its working.**

**Event:** ETHOnline 2026 (ETHGlobal) · Sept 4–16, 2026 · Submissions close **Sept 13, 12:00pm EDT**
**Prize page:** https://ethglobal.com/events/ethonline2026/prizes
**Status:** Greenfield — no existing repo, all tracks are *From Scratch* (not Continuity)
**Tracks targeted:** The Graph + ENS + Hedera (max 3 per project) — **$6,000 ceiling**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [What Already Exists (Prior Art)](#3-what-already-exists-prior-art)
4. [What Is NOT Built — Our Gap](#4-what-is-not-built--our-gap)
5. [Core Idea & Positioning](#5-core-idea--positioning)
6. [Research Foundation & Methodology](#6-research-foundation--methodology)
7. [The Two Doors — How It Gets Used](#7-the-two-doors--how-it-gets-used)
8. [High-Level Design & Pipeline](#8-high-level-design--pipeline)
9. [Architecture & Tech Stack](#9-architecture--tech-stack)
10. [Sponsor Tracks — Requirements & Fit](#10-sponsor-tracks--requirements--fit)
11. [Alternative Track Paths](#11-alternative-track-paths)
12. [Evolution From the Original ChainHound](#12-evolution-from-the-original-chainhound)
13. [Three New Things We Can Add to This Domain](#13-three-new-things-we-can-add-to-this-domain)
14. [Evaluation & Benchmark Plan](#14-evaluation--benchmark-plan)
15. [Repo Artifacts That Signal Research Depth](#15-repo-artifacts-that-signal-research-depth)
16. [Anti-Gimmick Kill List](#16-anti-gimmick-kill-list)
17. [Risks & Open Questions](#17-risks--open-questions)
18. [Demo Script](#18-demo-script)
19. [References](#19-references)

---

## 1. Executive Summary

### 1.1 One-liner

ChainHound follows stolen crypto, proves that several different wallets are secretly operated by **one** thief, keeps following the trail through swaps, mixers and bridges, tells you which exchange to phone before the money disappears — and answers the same question for *software* in one second for two cents.

### 1.2 The pitch in three sentences

- Every existing fund tracer is a **human dashboard behind an enterprise contract**, and none of them will tell you *how* they decided a wallet is dirty.
- ChainHound answers a **different, checkable question**: not "which coins are dirty" (unknowable after commingling) but **"who controls these wallets"** — provable via gas-funding fingerprints.
- Its output is **machine-readable and on-chain**, so a wallet app, exchange, protocol or AI agent can act on it automatically without a human, an account, or a sales call.

### 1.3 The one-line shift from the original idea

| | |
|---|---|
| **Original** | "An AI that reads wallets and explains what they've been doing." |
| **Problem** | Crowded. TRM and Chainalysis both shipped exactly this in March 2026. |
| **Now** | "A tracer that proves six wallets are one thief, shows its working, publishes its own error rate — and answers software in one second for two cents." |
| **Why it wins** | Nobody has built this, and the incumbents' business model is what *prevents* them from building it. |

---

## 2. The Problem

### 2.1 The real-world scenario

1. A protocol gets drained. $2M gone in under a minute.
2. The money starts moving immediately — split across wallets, swapped to other tokens, pushed through mixers, bridged to other chains.
3. **The recovery window is hours, not days.** Exchanges *can* freeze funds — but only if you reach them fast and can prove chain of custody.
4. The tools that could help are enterprise products behind logins and contracts. The victim protocol is a 3-person team at 3am.

### 2.2 Why current tools fail at the moment of need

| Failure | Consequence |
|---|---|
| Human dashboard only | Useless at 3am when a bot drains a protocol in 40 seconds |
| Method is a trade secret | Exchanges and lawyers can't verify the claim, so they act slowly or not at all |
| Enterprise pricing / sales cycle | Priced out of reach for exactly the small protocols that get hacked most |
| Trail dies at mixers | Silence at the exact moment the tool is most needed |
| No published accuracy | "Trust us" is the entire evidence base |

### 2.3 The deeper technical problem

**After stolen money mixes with clean money in one wallet, there is no physical fact about which coins are "the stolen ones."** Ethereum accounts are balances, not coins — nothing to point at. So every tool applies a *rule* to guess, and different rules give different answers. All of them hide which rule they used.

That makes their output **unfalsifiable** — a conclusion nobody can check.

---

## 3. What Already Exists (Prior Art)

### 3.1 Commercial fund-tracing platforms

1. **MetaSleuth** (BlockSec) — graph-based fund tracing across Ethereum/BNB/Polygon, proprietary laundering-path discovery, real-time suspicious-actor tagging, automatic shortest-path between any two addresses. *Closest match to the original ChainHound pitch.* — https://metasleuth.io/
2. **Arkham Intelligence** — multi-chain flow tracing, entity-level profiles for exchanges/institutions/public figures, community wallet labeling, plus a bounty marketplace for deanonymizing addresses.
3. **Breadcrumbs.app** — graph wallet visualization, built for presenting investigations to stakeholders.
4. **MistTrack** (SlowMist) — stolen-fund tracking; the de facto tool used publicly during live post-hack incidents.
5. **Chainalysis Reactor** — enterprise/law-enforcement tier, court-accepted reporting.
6. **TRM Forensics** — enterprise investigations platform.
7. **Elliptic / Crystal (Bitfury)** — compliance + investigations tier.
8. **Bubblemaps** — wallet-cluster relationship visualization.

### 3.2 The AI layer — taken in 2026

9. **TRM Labs "Co-Case Agent"** (Mar 25, 2026) — AI assistant embedded in TRM Forensics. Translates **natural language prompts into investigative actions**: tracing fund flow, auditing graph accuracy, suggesting next steps. Free to all TRM Forensics customers. **This is the original ChainHound pitch, shipped by the incumbent.**
10. **Chainalysis blockchain intelligence agents** (Mar 31, 2026) — AI agents for crypto crime investigation and fraud prevention.
11. **AnChain.AI** — AI-native crypto intelligence, LLM-powered explainable AML, fraud detection, sanctions screening, cross-chain analytics, agentic advisory.

### 3.3 Academic work

12. **LOCARD** — an agentic framework for blockchain forensics (arXiv 2604.04211).
13. **RiskTagger** — LLM-based agent for automatic annotation of Web3 crypto money-laundering behaviours (arXiv 2510.17848).
14. **TaintTrail** (TrailBit Labs) — open source, traces tainted coins with **four methodologies side by side**. *Bitcoin/UTXO only — no Ethereum equivalent exists.*
15. **Tutela** — open-source tool for assessing user privacy on Ethereum and Tornado Cash (arXiv 2201.06811).
16. **"Clustering Deposit and Withdrawal Activity in Tornado Cash: A Cross-Chain Analysis"** (arXiv 2510.09433) — the demixing heuristics we build on.

### 3.4 Hackathon prior art

17. **Assessment Agent** (ETHGlobal showcase) — AI scam detection, pattern recognition, risk-level assessment, real-time alerts, built on The Graph. **Judges have already seen this exact shape.**

### 3.5 Where the incumbents genuinely beat us — state this openly

Being honest about this is itself a research signal:

- **Far more data.** Years of labelled addresses, exchange attributions, off-chain intelligence, subpoena-derived records we will never have.
- **More chains, deeper history.**
- **Legal standing.** Chainalysis output is accepted in court. Ours is not.

**Therefore: do not compete on data — we lose.** Compete on being *checkable* and *machine-callable*. Their secrecy is the product they sell and their enterprise pricing is structural, so these are gaps they cannot close without damaging their own business.

---

## 4. What Is NOT Built — Our Gap

1. **A transparent taint model on Ethereum.** Every commercial tool picks one model (usually haircut) and hides it. TaintTrail does multi-model comparison but only for Bitcoin UTXOs. **Nobody does multi-model lot accounting on account-based chains.**
2. **Machine-readable address verdicts.** No agent can pay $0.02 and receive a structured verdict; no smart contract can read one. Every tool above is a human UI behind a login.
3. **A published accuracy benchmark.** Every tool asserts accuracy; none publishes measured recall against known incidents.
4. **Falsifiable output.** Commercial reports are assertions. None are pinned to a block height or cite a transaction hash per claim.
5. **Forensics as infrastructure.** Theirs is a destination you visit. Ours is a verdict other software consumes mid-transaction.
6. **Attribution-first output on Ethereum.** Commercial tools lead with "this wallet is X% dirty." Almost none lead with "these 14 addresses are one operator, here's the proof."

---

## 5. Core Idea & Positioning

### 5.1 The reframe

**Not** "AI blockchain investigator" (crowded — we lose on data depth vs Arkham, and TRM already shipped the AI layer).

**Instead:** *the machine-readable trust layer for addresses.*

- **Output is an on-chain attestation + ENS record**, not a webpage.
- **Access is x402 pay-per-query**, not a login.
- **The UI is the demo, not the product.**

### 5.2 The single most important design decision

> **Stop asking "which coins are dirty." Start asking "who controls these wallets."**

The first question is a legal fiction inherited from Bitcoin. The second has a real, checkable, hop-independent answer.

### 5.3 The positioning statement for judges

> Everyone else built a dashboard an investigator logs into. We built a trust oracle that software queries — it shows the method behind every verdict, cites a transaction hash for every claim, and publishes its own error rate against real hacks.

---

## 6. Research Foundation & Methodology

### 6.1 The three classic taint models (and why they're insufficient)

Stolen ₹1,000 mixes with clean ₹9,000 in one account. ₹1,000 is then withdrawn. Was it the stolen money?

| Model | Rule | Answer | Problem |
|---|---|---|---|
| **Poison** | Any output touched by tainted input is *fully* tainted | All ₹10,000 is dirty | Explodes past ~3 hops; everything becomes dirty |
| **Haircut** | Taint spreads proportionally to value share | Withdrawal is 10% dirty | Dilutes to meaningless noise on long trails. **Most chain-analysis firms use this.** |
| **FIFO** | First money in funds first money out | Yes, it was the stolen ₹1,000 | Lossless (traces backwards too). Basis: **Clayton's Case (1816)**, still the English common-law rule for commingled accounts |

**Key insight:** on Ethereum this requires **per-account balance-lot accounting**, because accounts commingle rather than holding discrete UTXOs. That difficulty is precisely why nobody has done it — and why it's our moat.

**Our use of them:** keep all three, but **demote them to a compatibility layer**. They let us (a) speak the language exchanges and courts already use, and (b) show a genuinely novel view — *where the three models disagree*. Agreement = high-confidence attribution. Disagreement = attribution-fragile, do not accuse.

### 6.2 Layer 1 — Attribution (the primary answer)

> **A thief can shuffle money endlessly, but they cannot avoid paying the fees.**

Every fresh wallet needs gas before it can transact, and that gas must come from somewhere — usually one wallet the attacker controls. That funding transaction is a fingerprint that survives any amount of money-shuffling.

**Heuristics:**
1. **Gas-funder clustering** *(primary — highest value on Ethereum)* — one address funding gas for many fresh wallets ⇒ same operator.
2. **Deposit-address reuse** — an address that both deposits to and withdraws from the same service.
3. **CREATE2 / deployer linkage** — contracts deployed by the same account.
4. **Behavioural fingerprinting** — operating hours, amount-structuring habits, venue preference, gas-price patterns.

**Output shape:** not `Wallet A is 40% dirty` but `Wallets A, B, C, F, G, H = 1 operator (evidence: 6 gas-funding txs)`.

**Why this is better:** taint confidence decays with every hop; attribution does not. It's the difference between a *fact* and an *insight*.

### 6.3 Layer 2 — Provable value bounds (replace guesses with ceilings)

Instead of inventing a dirtiness percentage, compute a **maximum**: across all paths in the transaction graph, *at most* how much stolen value could physically have reached this address?

- "At most 3 ETH could have arrived here" → provable, defensible.
- "At most all of it" → the trail is genuinely lost, and saying so is more useful than a fabricated number.

**Guesses can be wrong. Bounds cannot.**

### 6.4 Layer 3 — Mixer anonymity-set reduction (don't say "trail lost")

Mixers like Tornado Cash sever the on-chain link cryptographically — but **user behaviour leaks**. Published cross-chain research using three heuristics:

1. **Address reuse** — an address that deposited later also withdraws.
2. **Transactional linkage** — direct transfers (ETH / USDT / WETH) between depositor and withdrawer addresses.
3. **FIFO temporal matching** — order-based deposit↔withdrawal pairing.

**Measured results (arXiv 2510.09433):** address reuse + transactional linkage alone link **5.1–12.6%** of withdrawals; adding FIFO temporal matching adds a further **15–22 percentage points**, de-anonymising **up to 34.7%** of Tornado Cash transactions across Ethereum, BNB Chain and Polygon.

**Our output:** not `trail lost` but **`one of 40 candidate deposits — 3 of them are ours`**. A crowd of 5,000 reduced to 40 is a lead an investigator can work.

### 6.5 Making the trace terminate correctly

Naive BFS on Ethereum returns tens of thousands of addresses by hop 3 and flags half the chain as criminal. Required controls:

1. **Sink classification** — CEX deposit addresses, bridges, mixers and DEX routers are **terminal**. Annotate and stop; never recurse through them.
2. **Infrastructure allowlist** — curated routers, hot wallets, bridges, common contracts. *Flagging the Uniswap Universal Router as criminal is the classic demo-killing embarrassment.*
3. **Peel-chain detection** — large amount moves forward, small amount peels off each hop. Dominant laundering pattern with an obvious signature. Collapse 40 unreadable hops into one annotated edge: *"peeled 12 times, 8% shed, terminating at Binance deposit."*
4. **Relative value-threshold pruning** — relative to the original stolen amount, never absolute.
5. **Bridge continuation** — detect the bridge deposit, match the destination-chain withdrawal by amount + token + time window, resume the trace.

### 6.6 Evidence discipline (non-negotiable)

1. **Pin every investigation to a block height.** Same input + same block ⇒ byte-identical output, forever. Without this, on-chain verdicts are unanchored and reports aren't reproducible.
2. **Every sentence cites transaction hashes.** The LLM narrates over a structured evidence object and may never assert anything absent from it. *No hash, no sentence.*
3. **Scores are deterministic.** Hop distance from seeded known-bad, wallet age vs inflow size, fan-out ratio, sink contact. The LLM explains the arithmetic; it never produces the number.

> A security-literate judge will attack an LLM-generated risk score within 30 seconds, and they will be right to.

---

## 7. The Two Doors — How It Gets Used

**One engine, two entry points.**

| | Door 1 | Door 2 |
|---|---|---|
| **Interface** | Website | API |
| **User** | Human | Software |
| **When** | *After* money is stolen | *Before* money moves |
| **Question** | "Where did it go?" | "Is this money dirty?" |
| **Speed** | Minutes | < 1 second |
| **Cost** | Free / demo | ~$0.02 per query |

### 7.1 Door 1 — The human, after a hack

**Ravi runs a small DeFi protocol. $2M was drained last night. He has one thing: the attack transaction ID.**

**Step 1 — He pastes one thing.** Attack tx ID into chainhound.xyz. No setup, no configuration.

**Step 2 — ChainHound follows the money hop by hop.**

```
  THE HACK — $2,000,000
        │
    ┌───┴────────┬─────────────┐
    │            │             │
 $800k        $700k         $500k
 Wallet A     Wallet B      Wallet C
```

*(A block explorer could roughly do this much.)*

**Step 3 — It proves the wallets are one person.**

Every new wallet needs gas — like needing petrol before you can drive. ChainHound checks **who paid the petrol**. Same funder for A, B, C, and three more downstream:

```
  ⚠️ ONE OPERATOR — 6 wallets, same gas payer
     A, B, C, F, G, H
```

Ravi thought he was chasing six thieves. It's one person wearing six masks — and this holds regardless of how much they shuffle.

**Step 4 — It survives the three evasion tricks.**

| Trick | What the thief does | What ChainHound does |
|---|---|---|
| **Swap** | $700k ETH → Uniswap → $700k USDC. Different token, different amount, looks unrelated | Reads the trade receipt (pool, route, price impact) and knows the USDC *is* the ETH. **Trail continues.** |
| **Mixer** | Money joins a crowd of 5,000 identical exits | Uses behavioural leaks to narrow it: **"one of 40 exits, 3 are ours."** |
| **Bridge** | Moves to another blockchain | Matches amount + token + time window on the far side and resumes |

**Step 5 — It says where the money actually ended up.**

```
FINAL POSITIONS
  $800k → still sitting in Wallet A          (recoverable)
  $700k → deposited to Binance, 03:47 UTC    ← CALL THEM NOW
  $500k → mixer, narrowed to 40 candidates
```

**That Binance line is the money shot.** Exchanges can freeze funds — but only if reached fast and given provable chain of custody. ChainHound hands Ravi the deposit address, the timestamp, and the receipts. That's an email he can send in the next ten minutes.

**Step 6 — Every sentence has a receipt.**

> "Wallet A received $800,000 at 03:12 UTC *(tx: 0x4a2f…)* and has not moved since. Wallets A, B, C, F, G and H share a common gas funder *(txs: 0x91b2…, 0x7c4e…, …)*, indicating a single operator."

No claim without a transaction ID. Exchanges and lawyers can verify every line themselves. **That is the difference between a report and an accusation.**

**Step 7 — He publishes the verdict.**

One click. The six confirmed wallets are labelled on-chain — publicly, permanently, evidence attached. Anyone checking those addresses now sees the warning. Ravi didn't just chase his own money; he made the thief's wallets radioactive everywhere.

### 7.2 Door 2 — The software, before money moves

**Priya has never heard of ChainHound.** She just wants to withdraw $50,000 from a lending protocol. The protocol's automated safety layer does this in under a second:

```
1. Withdrawal request: $50,000
2. Ask ChainHound: "is this address clean?"   →  pays $0.02
3. ChainHound: "FLAGGED — 2 hops from the Euler hack.
                Confidence 87%. Evidence: ipfs://Qm…"
4. Protocol: hold withdrawal → alert human reviewer
```

No human. No signup. No dashboard. **Two cents, one second.**

**This is the part no existing tool can do.** Arkham and Chainalysis are websites a human logs into — useless when a bot is draining a protocol in 40 seconds.

**Who pays the two cents:**
- Wallet apps warning users before they send
- Exchanges screening deposits
- Protocols screening withdrawals
- AI agents checking counterparties before trading

---

## 8. High-Level Design & Pipeline

### 8.1 Full pipeline

```
   attack tx hash  /  suspicious address
         │
   ┌─────▼──────────────────────────────────────────┐
0. BOOTSTRAP     seed known-bad set · pin block height
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
1. DATA          full transfer history, any address       ◄── THE GRAPH
   │             live streaming during incident
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
2. ATTRIBUTION   gas-funder clustering · deposit reuse    ◄── (no sponsor)
   │             CREATE2 linkage · behavioural finger-
   │             printing  →  14 addresses = 1 operator
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
3. VALUE FLOW    max-flow ceiling · 3 taint models in
   │             parallel · divergence map · peel-chain
   │             collapse · sink stops · allowlist
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
4. OBFUSCATION   swaps → reconstruct pool/route/impact
   │             mixers → anonymity-set reduction
   │             bridges → cross-chain continuation
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
5. NARRATION     Claude over structured evidence only;
   │             every sentence cites a tx hash
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
6. PUBLISH       report → IPFS → attestation → named     ◄── ENS v2
   │             (confirmed entities only, batched)
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
7. ACCESS        x402 pay-per-verdict · agent identity   ◄── HEDERA
   └─────┬──────────────────────────────────────────┘
   ┌─────▼──────────────────────────────────────────┐
8. EVALUATION    replay real hacks · publish recall       ◄── (no sponsor)
   └────────────────────────────────────────────────┘
```

### 8.2 The structural argument for judges

> **The two stages carrying the real work — attribution (stage 2) and evaluation (stage 8) — have no sponsor attached.**

That asymmetry is the best defence against "this is a sponsor-bingo project": the core is unsponsored, and the three sponsors slot into a pipeline that would exist regardless.

### 8.3 Compressed flow (for slides)

```
attack tx
   ├─ 1. SEE        full history, live               ◄── THE GRAPH
   ├─ 2. ATTRIBUTE  who paid the gas? → 14 wallets, 1 operator
   ├─ 3. TRACE      max-flow bound · 3 models · peel chains
   │                swaps rebuilt · mixers → 40 candidates
   ├─ 4. JUDGE      evidence → IPFS → attestation → named  ◄── ENS v2
   ├─ 5. SELL       x402 verdict + verified agent identity ◄── HEDERA
   └─ 6. PROVE      7 real hacks replayed, recall published
```

---

## 9. Architecture & Tech Stack

### 9.1 Frontend
- **Next.js (React)** — dashboard + report rendering
- **Tailwind CSS**
- **React Flow or D3.js** — the investigation graph
- **Signature view: taint-model divergence overlay** — three models on one graph, wallets highlighted where they disagree. Visually unlike anything else at the event, and 10 seconds to explain.

### 9.2 Backend / orchestrator
- **Python (FastAPI)** preferred — analysis logic is Python-shaped
- Responsibilities: ingest → Graph queries → attribution → taint engine → obfuscation handling → narration → attestation → serve API

### 9.3 Analysis engine (the core IP)
- **Attribution module** — gas-funder clustering, deposit reuse, CREATE2 linkage, behavioural fingerprints
- **Taint engine** — per-account balance-lot accounting; poison / haircut / FIFO in parallel; divergence detection
- **Flow module** — max-flow ceiling computation over the transaction graph
- **Obfuscation module** — mixer anonymity-set reduction, bridge matching, swap reconstruction
- **Graph traversal** — BFS/DFS with sink classification, allowlist, peel-chain collapse, relative pruning
- **Scoring** — deterministic rules only

### 9.4 AI layer
- **Claude API (Sonnet)** — narration only, over a structured evidence object
- Hard constraint: **never generates scores, never asserts anything without a tx hash**

### 9.5 Data layer

| Need | Tool |
|---|---|
| Transfer history for *any* address | **The Graph — Token API** (native + ERC-20 balances, transfers with granular filters, holders, prices; MCP server available) |
| Live movement during an incident | **The Graph — Substreams** |
| Protocol-specific enrichment (swaps) | **Uniswap subgraph / API** |

### 9.6 Storage
- **PostgreSQL** — investigations, entity profiles, trace graphs (JSONB is sufficient; skip Neo4j)
- **In-memory cache** for Graph responses
- **IPFS** — full evidence reports (content-addressed, referenced by CID from the attestation)

### 9.7 On-chain layer
- **Solidity** — ENSv2 subregistry + registrar
- **Sepolia** — ENSv2 deployment target
- **Hedera Testnet** — x402 payment gate + ERC-8004 agent identity
- **Foundry or Hardhat**

### 9.8 Attestation design (do this properly)

The ENS text record must **not** be a bare boolean. Store:

| Field | Purpose |
|---|---|
| `evidenceCID` | IPFS hash of the full report |
| `confidence` | Deterministic score |
| `taintModel` | Which model produced this |
| `blockHeight` | Reproducibility anchor |
| `expiry` | Verdicts go stale |
| `schemaVersion` | Forward compatibility |
| `revocation` | Path to withdraw a wrong verdict |

**Separate the two identity concerns:**
- Verdicts about **addresses** → attestation-shaped (EAS semantics), with ENS as the human-readable retrieval layer
- ChainHound's **own agent identity** → **ERC-8004** (Identity / Reputation / Validation registries; ERC-721-based portable identity). Mainnet Jan 29, 2026; reference implementations live on **Hedera Testnet**, Base Sepolia, Linea Sepolia

> A bare `flagged: true` is an unfalsifiable public accusation with no recourse. That is exactly the gimmick to avoid.

---

## 10. Sponsor Tracks — Requirements & Fit

**Constraint: max 3 tracks per project.** Chosen for money **and** win-probability **and** narrative coherence.

### 10.1 Selected: The Graph — Best AI Tooling/Use Case (From Scratch)

- **Pool:** $5,000 · **1st: $2,500** / 2nd: $1,500 / 3rd: $1,000 (**3 payout slots**)
- **Requirements:**
  - Build net-new AI tools or agents using The Graph as data source
  - Consume **live** subgraph/Token API data — **not mock or static data**
  - Demonstrate meaningful *reasoning* with the data, not just display
  - Open-source repo + README + 2–4 min demo video
- **Why load-bearing:** The Token API is the only source of full transfer history for an *arbitrary* address across chains — the trace spine. **Stage 1 does not exist without it, and nothing downstream runs.** Substreams adds live mode, which matters because during a real incident the money is moving *while you watch*.
- **Fit:** ✅ Strong. Attribution + taint reasoning is unambiguously "meaningful work with data."

### 10.2 Selected: Hedera — AI & Agentic Payments

- **Pool:** $6,000 · **up to 3 teams @ $2,000 each** (**3 payout slots**)
- **Requirements:**
  - Host a **live x402-gated service on Hedera**
  - Build a platform/agent that consumes it with **real paid requests**
  - Demonstrate at least one genuine end-to-end paid request
- **Why load-bearing:** verdicts are worth cents, not dollars. A card payment's fee exceeds the payment itself — x402 micropayments are the *only* viable rail, which is the honest answer to "why Hedera." And **ERC-8004 reference implementations are already live on Hedera Testnet**, so a paying agent can verify *who it is buying from* before paying. Provider identity and micropayment settlement on the same chain.
- **Fit:** ✅ Strong. Door 2 *is* this track.

### 10.3 Selected: ENS — Best Use of ENSv2

- **Pool:** $4,500 · 1st: $1,500 / 2nd: $1,500 / 3rd: $1,000 / runner-up: $500 (**4 payout slots — highest slot count of any track we target**)
- **Requirements:**
  - Build on **ENSv2 (Sepolia)** — the new version specifically, not mainnet ENS
  - Feature hierarchical registry, subname management, **or AI agent namespaces**
  - Functional demo (not hardcoded names) + public GitHub + video
- **Critical mechanic:** in ENSv2 a parent name must have a **subregistry deployed** before any child can be registered. Sequence: own a name on Sepolia → deploy its subregistry → registrar mints subnames.
- **Why load-bearing:** a verdict nobody can look up is worthless. ENS is the address book for verdicts — `<entity>.chainhound.eth` resolves to the evidence CID, confidence, model, block height and expiry. Every wallet and dApp already knows how to resolve ENS, so the risk signal propagates with **zero integration work** on their side. Additionally the agent-identity angle (`chainhound.eth`) is explicitly named in their track brief and ties ENS → Hedera.
- **Design constraint:** register **only confirmed entities**, **batched**, **user-triggered**. Auto-registering every wallet the trace touches is (a) slow and gas-heavy enough to stall the demo and (b) publishing permanent public accusations against possibly-innocent people.
- **Fit:** ✅ Strong, provided the subregistry work is real rather than a lookup call.

### 10.4 Why not the others

| Track | Max | Reason for exclusion |
|---|---|---|
| **Uniswap** — Best Stack Contribution | $1,000 | Requirement is wide open ("build on or integrate any part of Uniswap"), so it will be the most crowded room at the event, for the lowest ceiling of the candidates |
| **Bazantic** — Agentify a New API | $500 | Packaging, not product. Would burn a full slot for the smallest prize |
| **Bazantic** — Best Recipe using sponsor APIs | $500 | Same |
| **Chainlink** — Confidential Workflow | $1,000 | Requires TEE handler + CRE workflow deploy in unfamiliar tooling, for half of Hedera's payout |
| **Arc/Circle** — Agentic Economy | $1,667 | Bolted-on unless we genuinely ship a pay-to-unlock-deeper-trace feature |
| **World**, **Privy**, **1inch Aqua** | — | No natural fit for an investigation tool |

### 10.5 Dropping a track ≠ dropping a feature

**Uniswap swap reconstruction stays in the build.** Without it, both the token *and* the amount change through a swap (100 ETH in → 380,000 USDC out) and the trace **dies at every DEX**. We just don't submit it as a track — it appears in the demo as capability rather than as a sponsor logo, which reads better anyway.

Likewise, the x402 endpoint built for Hedera is already agent-callable, so we get the "machines can buy this" story without spending Bazantic's slot.

### 10.6 The three-track narrative

> **The Graph — how it sees.** Live transfer history for any address, across chains.
> **ENS — how it answers.** The verdict published where any wallet, dApp or contract can look it up.
> **Hedera — how machines buy it.** Pay-per-verdict, agent to agent, no human, no account.

**Sense → judge → sell.** A complete product loop with no filler.

---

## 11. Alternative Track Paths

If a chosen track turns out to be blocked, over-subscribed, or technically infeasible, these are the fallbacks — with the reasoning attached.

### Path A — Recommended (current plan)
**The Graph + ENS + Hedera** — $6,000 ceiling, 10 combined payout slots, cleanest narrative.

### Path B — Maximum breadth
**The Graph + Hedera + Uniswap** — $5,500. Swap reconstruction is genuinely load-bearing, but the Uniswap track is the most crowded and pays least. Take this only if ENSv2 Sepolia tooling proves unworkable.

### Path C — Privacy angle
**The Graph + ENS + Chainlink (Confidential Workflow)** — $5,000. Conceptually elegant: publish a trustworthy flagged/not-flagged verdict on-chain **without revealing the detection heuristics**, so exchanges can consume it without us leaking our method to the attackers we're chasing. Requires a TEE handler and a CRE workflow that causes a real state change — "showing data in a frontend is explicitly NOT enough."

### Path D — Abuse-prevention angle
**The Graph + ENS + World (Selfie Check)** — $5,166. World's track asks for a realistic Selfie Check flow for *"risk, eligibility, or abuse prevention."* Genuine fit: **gate the right to publish an on-chain accusation behind proof-of-personhood**, so ChainHound's attestation registry can't be spammed by bots making false accusations. This is a real anti-abuse mechanism for a real abuse vector, not a bolted-on identity check. Requires their feedback document.

### Path E — Hardware-secured attestations
**The Graph + Hedera + Ledger (AI Agents x Ledger)** — $6,000. Ledger's track wants agents using **device-backed secrets** via the Ledger Agent Stack / Key Ring CLI. Fit: the key that signs ChainHound's verdicts is the most security-critical secret in the system — if it leaks, anyone can forge accusations. Holding it in hardware is a defensible design decision, not decoration. Equal ceiling to Path A; swap in only if ENSv2 blocks.

### Stretch: The Graph's second track
**Best Use of Composable/Standardized Graph Products** — $5,000 pool, 1st $2,500. Requires composing multiple Graph products / standardized schemas. We already use **Token API + Uniswap subgraph + MCP together**, which is exactly what it asks for. *Only viable if the 3-track cap counts per project rather than per sponsor — verify with organisers.*

### Tracks explicitly ruled out
1inch Aqua/SwapVM · Privy (B2B financial product) · Hedera Tokenization Studio · Arc Launch-to-Mainnet · all Continuity tracks (we have no pre-existing repo).

---

## 12. Evolution From the Original ChainHound

### 12.1 What the original was

- **Wallet Intelligence** — enter a wallet, AI analyses history, behaviour, token activity, contract interactions, suspicious patterns
- **Fund Tracing** — enter a suspicious tx or hacker wallet, follow transfers/splitting/swaps/new wallets
- Combined: auto-analyse every wallet encountered, assign AI suspicion scores, render one investigation graph
- 5 tracks: The Graph, ENS, Chainlink, Bazantic, Uniswap

### 12.2 The eight changes and why

**1. The AI no longer decides who's guilty.**
*Was:* Claude looks at a wallet and assigns a suspicion score.
*Now:* the score comes from countable facts (hops from theft, wallet age, fan-out rate, sink contact). Claude only *explains* them.
*Why:* a judge asks "why is this 73%?" and "the AI decided" ends the conversation. Now it's arithmetic anyone can recheck.

**2. New core question: who *owns* the wallets, not which coins are dirty.**
*Was:* follow the money, flag what it touches.
*Now:* gas-funder clustering proves six wallets are one operator.
*Why:* this is the highest-value idea in the project and it **wasn't in the original at all**. "Money went to 6 wallets" is a fact; "6 wallets, 1 thief" is an insight — and unlike taint, it doesn't decay with distance.

**3. Mixers no longer end the trail.**
*Was:* not mentioned — so in practice the trace would simply die there.
*Now:* narrow 5,000 candidates to 40, with published research backing the method.
*Why:* every serious thief uses a mixer. A tracer that stops at one fails at the exact moment it's needed.

**4. The trace now knows when to stop.**
*Was:* BFS/DFS outward, forever.
*Now:* sinks, infrastructure allowlist, peel-chain collapse, relative pruning.
*Why:* **this would have killed the live demo.** Without sink handling the trace hits a Uniswap router at hop 3, follows it, and returns 40,000 addresses — half of Ethereum, flagged as criminal.

**5. We can now prove it works.**
*Was:* no way to tell if the output was right.
*Now:* seven historical hacks with published answers, and our score on each.
*Why:* turns "our AI is smart" into "here are our marks." Single biggest credibility upgrade in the project.

**6. Every sentence carries a receipt.**
*Was:* AI-written narrative reports.
*Now:* no claim without a tx hash; whole investigation frozen at a block height and re-runnable.
*Why:* an AI-written accusation with no sources is a rumour. This makes it evidence.

**7. ENS went from decoration to the product.**
*Was:* show `hacker.eth` instead of `0x8f3a…` (nicer to read); auto-register a subname for every flagged wallet.
*Now:* the name carries verdict + evidence CID + confidence + expiry + revocation; only confirmed entities, batched, user-approved.
*Why:* the original was cosmetic and judges spot cosmetic instantly. Worse, auto-naming every wallet touched means publishing permanent public accusations against possibly-innocent people.

**8. Fixed a technical error that would have blocked everything.**
*Was:* pull wallet history through "Subgraph MCP across 15,000+ subgraphs."
*Now:* The Graph's **Token API**.
*Why:* **subgraphs are indexed per-protocol — there is no subgraph that returns "all transfers for an arbitrary address."** The original data source did not exist. Token API does exactly this job.

**Plus:** five tracks → three. Three integrations that are load-bearing beat five that look sprinkled on.

### 12.3 What stayed exactly the same

The original instincts were right on the big things:
- ✅ Trace stolen funds through splits and swaps
- ✅ Analyse every wallet encountered along the way
- ✅ Render it as one investigation graph
- ✅ AI explains what the transactions *mean*
- ✅ "Not another block explorer"

---

## 13. Three New Things We Can Add to This Domain

These are genuine unsolved gaps — each converts ChainHound from a one-shot demo into a product with a real roadmap.

### 13.1 Reverse tracing — "where did this money come from?"

**The gap:** every tool in the category traces **forward** from a known theft. But the question people actually ask every day is the reverse: *money just arrived — what is its history?* Forward tracing serves victims after the fact; reverse tracing serves **everyone, before the fact.**

**Why it's newly possible:** FIFO is **lossless**, so unlike haircut it can run backwards. Start from any address and reconstruct its funding ancestry.

**What it unlocks:**
- Turns ChainHound from an incident tool into a **daily-use tool**
- Makes Door 2 far more valuable: "is this incoming money clean?" is a question asked millions of times a day, versus "trace this hack" a few times a month
- Freelancers, merchants, DAOs, and exchanges all want provenance-on-receipt

**Status in the market:** essentially unserved at the retail/API level.

### 13.2 Pre-attack staging detection — catch it before it fires

**The gap:** the entire domain is **retrospective**. Everyone traces after the money is gone. But attackers must *prepare*, and preparation is visible on-chain:

- Fresh wallet created
- Funded with gas — often from a mixer withdrawal or a fresh exchange withdrawal
- Attack contract deployed
- Sometimes a small probe transaction against the target first
- Unusual approval patterns against a specific protocol

**The product:** protocols subscribe to a watch on their own contracts. ChainHound alerts *before* the exploit fires:

> "An address funded 6 minutes ago from a Tornado withdrawal has just deployed a contract that calls your admin function. No prior history."

**Why it's differentiated:** it inverts the whole category from forensics to **prevention**. It reuses the exact same attribution engine (fresh-wallet + gas-funder + behavioural signals) pointed forward in time instead of backward. And it's the natural extension of Door 2 from a *query* into a *subscription*.

**Honest caveat:** false positives matter enormously here. Ship it with an explicit precision score, not as a certainty.

### 13.3 Counter-forensics stress testing — publish our own breaking point

**The gap:** **nobody in this industry publishes how easily they can be fooled.** Every vendor publishes capabilities; none publish limits.

**The product:** an *evader simulator* that generates deliberate laundering strategies against our own tracer —
- peel chains of increasing length
- dust-splitting fan-outs of increasing width
- cross-chain hop counts
- timing delays and dormancy periods
- mixer round-trips

— then measures **at exactly what point the trace breaks**, and publishes it:

> "We hold attribution through 14 peel hops and 2 bridges. We lose it at 3+ sequential mixer round-trips, or fan-outs wider than 200 addresses."

**Why it's powerful:**
- It's the natural partner to the accuracy benchmark: one measures what we catch, the other measures what defeats us
- It's a *research contribution*, not just a feature — a reusable adversarial benchmark for the whole field
- It is a very strong signal of genuine, unhurried work, because it is the opposite of what a hackathon project normally does

### 13.4 Further ideas worth noting (not in the core three)

1. **Dispute / appeal mechanism** — a wrongly-flagged address can contest a verdict; verdicts carry expiry and revocation by design. Publishing accusations without recourse is an ethical hole, and demonstrating you thought about it is a credibility marker.
2. **Federated attestations** — multiple independent investigators attest to the same entity; reputation-weighted consensus rather than a single oracle. Natural fit with ERC-8004's Reputation and Validation registries.
3. **Time-to-freeze optimisation** — rank which exchange to contact first by expected recoverable value and historical response time, since recovery is a race and effort should go where it pays.
4. **Whitehat negotiation channel** — a structured on-chain message to the attacker offering a bounty-for-return, since a large share of recovered funds come back via negotiation, not law enforcement.

---

## 14. Evaluation & Benchmark Plan

> **This is the single most convincing artifact in the repo.**

### 14.1 Method

1. Select 7 documented hacks with published post-mortems where the fund flow is public record — candidates: **Euler, Ronin, Nomad, Wormhole, Curve, KyberSwap, Radiant**.
2. Feed ChainHound only the attack transaction.
3. Compare its output against the published trail.
4. Report **recall per incident, per taint model**, including failures.

### 14.2 Output format

```
BENCHMARK RESULTS
  Euler     found  9 / 11 wallets     ✅   model: FIFO
  Ronin     found 14 / 15 wallets     ✅   model: FIFO
  Nomad     found  6 / 12 wallets     ❌   lost at bridge — cause documented
  ...
```

### 14.3 Why this wins

- Converts "trust my LLM" into **measured recall against known ground truth**
- Publishing the misses is *more* credible than claiming perfection — no commercial vendor will do it, and no hackathon project ever does
- Gives every judge conversation a concrete, verifiable anchor

### 14.4 Reproducibility

`make reproduce` re-runs the Euler trace and produces **byte-identical output**, because everything is pinned to a block height. Reproducibility is a thing nobody else demos.

---

## 15. Repo Artifacts That Signal Research Depth

Judges cannot see effort — only the artifacts effort produces. Ship all of these:

| File | Contents | Why it lands |
|---|---|---|
| **`BENCHMARK.md`** | Recall per hack, per taint model, **including failures** | Most credible thing in the repo; nobody else does it |
| **`METHODOLOGY.md`** | Real citations: Clayton's Case (1816), Tornado clustering (arXiv 2510.09433), Tutela (arXiv 2201.06811), taint analysis (arXiv 1906.05754) | Actual footnotes signal a week in the literature, not a week of prompting |
| **`LIMITATIONS.md`** | Where the trace breaks and why | Every hackathon project overclaims; stating your own boundaries reads as adult |
| **`DECISIONS.md`** | Why attribution over taint · why we stop at sinks · why the LLM never scores · why FIFO is the default | Shows the *thinking*, which judges reward and most often can't find |
| **`make reproduce`** | One command, byte-identical Euler trace | Reproducibility is undemo'd in this category |
| **Divergence view in the UI** | Three taint models on one graph; wallets glow where they disagree | Visually unlike anything else at the event; 10 seconds to explain |
| **`ADVERSARIAL.md`** *(stretch)* | Counter-forensics breaking points (§13.3) | Research contribution, not a feature |

---

## 16. Anti-Gimmick Kill List

Do **not** build these — each one reads as gimmick to a security-literate judge:

1. ❌ **LLM-generated risk scores.** Attacked within 30 seconds, and rightly.
2. ❌ **Registering an ENS subname for every wallet the trace touches.** That's spam *and* an irrevocable public accusation against people who may be innocent.
3. ❌ **"Chat with the blockchain" as the headline framing.** TRM's Co-Case Agent and Chainalysis's agents shipped this in March 2026.
4. ❌ **Any mock or hardcoded data anywhere**, including the demo. The Graph track explicitly disqualifies it.
5. ❌ **Multi-chain support as a breadth claim.** One chain traced correctly beats six traced shallowly.
6. ❌ **A bare `flagged: true` on-chain.** Unfalsifiable accusation with no recourse.
7. ❌ **Neo4j, Redis queues, wallet connect.** Postgres JSONB and an in-memory cache are sufficient; cut anything that isn't load-bearing.

---

## 17. Risks & Open Questions

### 17.1 Technical risks

| Risk | Mitigation |
|---|---|
| **Token API coverage** — does it return complete transfer history for arbitrary addresses at the depth we need? | **Verify first, before anything else is built.** This is the single point of failure for the entire project. |
| **ENSv2 Sepolia tooling maturity** — new contracts, evolving docs | Subregistry-before-subname is a hard prerequisite; validate the deploy path early. Fallback: Path B or E (§11) |
| **Trace explosion** | Sinks + allowlist + relative pruning + peel-chain collapse are all mandatory, not optional |
| **Per-account lot accounting complexity** on Ethereum | This is the moat — but scope it to a single chain and a bounded hop depth |
| **False positives on infrastructure** | Curated allowlist of routers, hot wallets, bridges seeded before the demo |

### 17.2 Open questions to resolve early

1. Does the 3-track cap count **per project** or **per sponsor**? (Determines whether The Graph's second Composability track is reachable — §11 stretch.)
2. Can the x402 gate on Hedera be fronted such that the ERC-8004 identity is verifiable in the same flow?
3. Which specific hacks have post-mortems detailed enough to serve as ground truth? (Answer determines the benchmark set.)
4. EAS availability and schema registration on the target testnet.

### 17.3 Ethical risk

We are **publishing public accusations of theft**. Every verdict must carry confidence, evidence CID, block height, expiry, and a revocation path. Only confirmed entities get named, batched, and user-approved. A dispute mechanism (§13.4) is the right long-term answer and worth stating even if unbuilt.

---

## 18. Demo Script

One real incident, end to end. No slides.

> A protocol's guard agent is about to release a large withdrawal. It queries ChainHound over x402 — **pays two cents, no account, no login**.
>
> ChainHound pulls live history from **The Graph** and works backwards. It finds the funds passed through a **Uniswap V3 pool**, reconstructs the exact route, and follows the value out the other side as a different token. Two hops later the money hits **Tornado Cash** — where every other tool stops. ChainHound doesn't say *"trail lost"*; it says **"one of 40 possible deposits, and 3 of those are the Euler hack."**
>
> Meanwhile it notices something else: six of the wallets in this trail all had their **gas paid by the same address**. Different wallets, one operator.
>
> The verdict lands as an **on-chain attestation, readable at an ENS name**. The guard agent blocks the withdrawal. **No human was ever involved.**
>
> Then: here's the same engine run against **seven historical hacks**, and here's how much of each published trail it recovered — **including the two it lost.**

**That last line is the one that wins it.**

---

## 19. References

### Research
- **Taint analysis methods** — "Probing the Mystery of Cryptocurrency Theft: An Investigation into Methods for Taint Analysis" — https://ar5iv.labs.arxiv.org/html/1906.05754
- **Tornado Cash demixing** — "Clustering Deposit and Withdrawal Activity in Tornado Cash: A Cross-Chain Analysis" — https://arxiv.org/abs/2510.09433
- **Ethereum privacy analysis** — "Tutela: An Open-Source Tool for Assessing User-Privacy on Ethereum and Tornado Cash" — https://arxiv.org/pdf/2201.06811
- **Agentic forensics** — "LOCARD: An Agentic Framework for Blockchain Forensics" — https://arxiv.org/html/2604.04211
- **LLM AML annotation** — "RiskTagger" — https://arxiv.org/pdf/2510.17848
- **Multi-model taint (Bitcoin)** — TaintTrail — https://github.com/TrailBit-Labs/TaintTrail
- **Clayton's Case (1816)** — English common-law FIFO rule for commingled accounts

### Standards & platform docs
- **ERC-8004: Trustless Agents** — https://eips.ethereum.org/EIPS/eip-8004
- **ENSv2 overview** — https://docs.ens.domains/ensv2/overview/
- **ENSv2 readiness** — https://docs.ens.domains/web/ensv2-readiness/
- **The Graph — Token API** — https://thegraph.com/token-api/
- **Token API MCP** — https://thegraph.com/docs/ai-suite/token-api-mcp/introduction/
- **Token API repo** — https://github.com/pinax-network/token-api/

### Competitive landscape
- **MetaSleuth** — https://metasleuth.io/
- **TRM Co-Case Agent** (Mar 2026) — https://www.trmlabs.com/resources/blog/trm-labs-launches-co-case-agent-an-ai-assistant-for-every-crypto-investigation
- **Chainalysis AI agents** (Mar 2026) — https://www.pymnts.com/blockchain/2026/ai-agents-promise-faster-investigations-as-crypto-crime-hits-new-highs/
- **AnChain.AI** — https://www.anchain.ai/
- **Assessment Agent** (ETHGlobal prior art) — https://ethglobal.com/showcase/assessment-agent-hpb2o

### Event
- **ETHOnline 2026 prizes** — https://ethglobal.com/events/ethonline2026/prizes
- **ENS track detail** — https://ethglobal.com/events/ethonline2026/prizes/ens

---

*Document version 1.0 — consolidates all research and design decisions to date.*
