import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Important for JSON file writes on some platforms
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
