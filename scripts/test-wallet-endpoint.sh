#!/usr/bin/env bash
# Smoke-tests POST /api/wallet.
#
# Usage:
#   ./scripts/test-wallet-endpoint.sh
#
# If no server is already running at BASE_URL, this starts one with `npm run dev`
# (respecting any .env config) and shuts it down again when the script exits.
#
# Env vars:
#   BASE_URL        default: http://localhost:${PORT:-3000}
#   WALLET_ADDRESS  well-formed address used for the "happy path" request
#                   default: 0x000000000000000000000000000000000000dEaD

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:${PORT:-3000}}"
WALLET_ADDRESS="${WALLET_ADDRESS:-0xFEEEEEE44046c3f61a8CC081E0918eF0de0a7ffC}"
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
# server (e.g. a Next.js dev server) already bound to the port would otherwise false-positive.
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

pass=0
fail=0

# Sends a request and asserts the status code is one of $2 (space-separated list).
check() {
  local name="$1" expected_codes="$2" body="$3"
  local status
  status=$(curl -s -o "$RESP_FILE" -w '%{http_code}' --max-time 120 -X POST "$ENDPOINT" \
    -H 'content-type: application/json' -d "$body")

  if [[ " $expected_codes " == *" $status "* ]]; then
    echo "PASS  $name (status $status)"
    pass=$((pass + 1))
  else
    echo "FAIL  $name (expected one of [$expected_codes], got $status)"
    fail=$((fail + 1))
  fi
  echo "      $(cat "$RESP_FILE")"
  echo
}

echo "Testing $ENDPOINT"
echo

check "missing walletAddress"     "400" '{}'
check "malformed walletAddress"   "400" '{"walletAddress":"not-an-address"}'
# 200 = fetched real data, 502 = MCP/subgraph call failed (e.g. GATEWAY_API_KEY not set)
check "well-formed walletAddress" "200 502" "{\"walletAddress\":\"$WALLET_ADDRESS\"}"

echo "----------------------------------------"
echo "$pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
