import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5gb",
    },
  },
};

export default nextConfig;
