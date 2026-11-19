import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons"],
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
      {
        source: "/images/skeleton-backflip-sheet.v2.webp",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/skeleton-backflip-poster.v2.webp",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/skeleton-hero-typing-sheet.v1.webp",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/skeleton-hero-typing-poster.v1.webp",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/pr1.webp",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/pr2.webp",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/about-skeleton-suit-new.png",
        headers: immutableAssetHeaders,
      },
    ];
  },
};

export default nextConfig;
