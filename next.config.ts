import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Do not let `next dev` add its managed notes block to AGENTS.md, which is
  // the team's requirements document. With this off, `next dev` also removes
  // a block it added earlier.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
