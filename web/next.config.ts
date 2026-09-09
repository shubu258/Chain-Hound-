import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of the ChainHound monorepo (the Express API at the repo root
  // has its own package-lock.json), so Turbopack can't infer the workspace root on its own.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
