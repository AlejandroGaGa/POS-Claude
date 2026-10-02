import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose"],
  experimental: {
    optimizePackageImports: ["@gravity-ui/icons", "@heroui/react"],
  },
};

export default nextConfig;
