import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",   // enables minimal Docker image via .next/standalone
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
      // TradingView charting library loads bundles from /bundles/; files live at /charting_library/bundles/
      {
        source: "/bundles/:path*",
        destination: "/charting_library/bundles/:path*",
      },
    ];
  },
};

export default nextConfig;
