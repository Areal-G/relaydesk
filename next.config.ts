import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Netlify passes [build.environment] to the build only, not to server
  // functions, so bake the public URL into the bundle.
  env: { APP_URL: process.env.APP_URL },
  devIndicators: false,
  // Pin the project root (a lockfile in a parent directory would otherwise be picked up).
  outputFileTracingRoot: process.cwd(),
  // Native / WASM / auto-instrumented packages must be loaded from node_modules
  // at runtime rather than bundled, so dd-trace can patch them and PGlite can
  // find its .wasm assets.
  serverExternalPackages: ["dd-trace", "pino", "pg", "@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The app has no public landing page: send visitors to the dashboard (which redirects to sign-in).
  async redirects() {
    return [
      { source: "/", destination: "/dashboard", permanent: false },
      // Demo branch: accounts can't be created, since the data lives in memory.
      { source: "/signup", destination: "/login", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
