import type { NextConfig } from "next";
import path from "node:path";

// Bản demo: xuất ra file tĩnh để đưa lên GitHub Pages (https://<tài khoản>.github.io/CampusHub-demo/app/).
// Không có máy chủ: các lệnh gọi /api/v1 chạy trong trình duyệt (server/src/browser/server.ts).
const BASE_PATH = process.env.DEMO_BASE_PATH ?? "/CampusHub-demo/app";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  turbopack: { root: path.resolve(import.meta.dirname, "..") },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
