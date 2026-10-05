import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.20.5"],
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
};

export default nextConfig;



