import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",   // enables minimal Docker image via .next/standalone
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
