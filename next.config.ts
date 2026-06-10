import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow PDF statement uploads
    },
  },
};

export default nextConfig;
