import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./wiki/**/*"],
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
