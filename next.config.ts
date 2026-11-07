import type { NextConfig } from "next";

const config: NextConfig = {
  // Native/wasm database drivers must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "bcryptjs"],
  output: "standalone", // small self-contained server for Docker
  poweredByHeader: false,
};

export default config;
