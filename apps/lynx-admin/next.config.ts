import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@repo/constants",
    "@repo/tailwind-config",
    "@repo/ui",
  ],
};

export default nextConfig;
