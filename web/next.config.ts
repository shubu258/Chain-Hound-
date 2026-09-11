import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of the ChainHound monorepo (the Express API at the repo root
  // has its own package-lock.json), so Turbopack can't infer the workspace root on its own.
  turbopack: {
    root: path.join(__dirname),
  },
  // /api/* is handled by Route Handlers (src/app/api/*/route.ts), which forward to the Express
  // API — see src/lib/backend.ts for why that's a plain fetch and not a next.config rewrite.
};

export default nextConfig;
