#!/usr/bin/env bash
# Smoke-tests the "fundFlow" (on-chain, via ethers.js) block of POST /api/wallet.
#
# Usage:
#   ./scripts/test-fundflow-endpoint.sh
#
# Requires ETHERS_RPC_URL to be set (in .env or the environment) — otherwise fundFlow comes back
# as an error block by design (see Routes/dataFetching.ts) and this test fails loudly rather than
# silently passing on empty arrays.
#
# If no server is already running at BASE_URL, this starts one with `npm run dev` and shuts it
# down again when the script exits.
#
# Env vars:
#   BASE_URL        default: http://localhost:${PORT:-3000}
#   WALLET_ADDRESS  a wallet with real, well-known transfer history
#                   default: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 (vitalik.eth)

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:${PORT:-3000}}"
WALLET_ADDRESS="${WALLET_ADDRESS:-0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045}"
ENDPOINT="$BASE_URL/api/wallet"
RESP_FILE="$(mktemp)"

STARTED_SERVER=0
SERVER_PID=""

cleanup() {
  rm -f "$RESP_FILE"
  if [[ "$STARTED_SERVER" -eq 1 && -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

# Checks for our specific error signature, not just "something responded" — a stray unrelated
# server already bound to the port would otherwise false-positive.
probe() {
  curl -s -X POST "$ENDPOINT" -H 'content-type: application/json' -d '{}' 2>/dev/null \
    | grep -q 'walletAddress must be a valid EVM address'
}

if ! probe; then
  echo "No ChainHound API detected at $BASE_URL — starting one with 'npm run dev'..."
  npm run dev >/tmp/chain-hound-dev.log 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1

  ready=0
  for _ in $(seq 1 30); do
    if probe; then
      ready=1
      break
    fi
    sleep 0.5
  done

  if [[ "$ready" -eq 0 ]]; then
    echo "Server never came up. Log:"
    cat /tmp/chain-hound-dev.log
    exit 1
  fi
fi

echo "Testing fundFlow for $WALLET_ADDRESS against $ENDPOINT"
echo

status=$(curl -s -o "$RESP_FILE" -w '%{http_code}' --max-time 180 -X POST "$ENDPOINT" \
  -H 'content-type: application/json' -d "{\"walletAddress\":\"$WALLET_ADDRESS\"}")

if [[ "$status" != "200" ]]; then
  echo "FAIL  request did not return 200 (got $status)"
  cat "$RESP_FILE"
  exit 1
fi

python3 - "$RESP_FILE" << 'EOF'
import json, sys

with open(sys.argv[1]) as f:
    data = json.load(f)

fund_flow = data.get("fundFlow")
if fund_flow is None:
    print("FAIL  response has no 'fundFlow' key")
    sys.exit(1)

if fund_flow.get("source") != "onchain":
    print(f"FAIL  fundFlow.source is {fund_flow.get('source')!r}, expected 'onchain'")
    sys.exit(1)

if "error" in fund_flow:
    print(f"FAIL  fundFlow returned an error: {fund_flow['error']}")
    print("      (check ETHERS_RPC_URL is set and valid)")
    sys.exit(1)

sent = fund_flow.get("sent")
received = fund_flow.get("received")

ok = True
for name, arr in (("sent", sent), ("received", received)):
    if not isinstance(arr, list):
        print(f"FAIL  fundFlow.{name} is not an array")
        ok = False
    elif len(arr) == 0:
        print(f"FAIL  fundFlow.{name} is empty — expected populated for this wallet")
        ok = False
    else:
        print(f"PASS  fundFlow.{name}: {len(arr)} transfers (e.g. {arr[0]['transactionHash']})")

sys.exit(0 if ok else 1)
EOF
