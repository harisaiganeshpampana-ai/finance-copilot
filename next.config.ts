import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Don't print server-action arguments in the dev terminal: sign-up passes the
  // password to a server action, and passwords must never appear in logs.
  logging: { serverFunctions: false },
  // Statement readers (PDF, Excel) load helper files at runtime; let Node load them directly
  // instead of bundling them, exactly as they run in the tests.
  serverExternalPackages: ["unpdf", "xlsx"],
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
