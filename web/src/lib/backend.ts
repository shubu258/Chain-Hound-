// Server-only: forwards a request body to the Express API (repo root, see ../../../src/server.ts).
// Deliberately NOT using next.config.ts `rewrites()` here — that proxy path enforces its own
// internal timeout, which is too short for /api/wallet (chained Subgraph MCP + Token API + Gemini
// + ENS calls can legitimately take a while). A plain fetch from a Route Handler has no such cap.

const CHAINHOUND_API_URL = process.env.CHAINHOUND_API_URL ?? "http://localhost:3000";

export async function forwardToBackend(path: string, request: Request): Promise<Response> {
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${CHAINHOUND_API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch (err) {
    return Response.json(
      { error: `Could not reach the ChainHound API at ${CHAINHOUND_API_URL} — is it running? (${err instanceof Error ? err.message : err})` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
