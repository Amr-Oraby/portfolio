import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons", "framer-motion"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    const immutableAssetHeaders = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];

    return [
      {
        source: "/images/skeleton-riding-sheet.v1.webp",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/skeleton-riding-poster.v1.webp",
        headers: immutableAssetHeaders,
      },
    ];
  },
};

export default nextConfig;
