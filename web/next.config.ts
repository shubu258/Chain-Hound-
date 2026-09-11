import path from "node:path";
import type { NextConfig } from "next";

// The Express API (repo root, see ../src/server.ts) is a separate origin in dev — proxying
// through here instead of calling it directly means the browser never needs CORS, and the
// frontend only ever talks to relative /api/* paths.
const CHAINHOUND_API_URL = process.env.CHAINHOUND_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of the ChainHound monorepo (the Express API at the repo root
  // has its own package-lock.json), so Turbopack can't infer the workspace root on its own.
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${CHAINHOUND_API_URL}/api/:path*` }];
  },
};

export default nextConfig;
