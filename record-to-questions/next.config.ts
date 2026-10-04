import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js は worker_threads で自前のスクリプトを読むため、バンドルせずに使う
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
