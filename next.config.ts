import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen depends on the visitor's private sandbox, so pages render dynamically
  // per request. Cache Components and partial prefetching add nothing here.
  cacheComponents: false,
  partialPrefetching: false,
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
