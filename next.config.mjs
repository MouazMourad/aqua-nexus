import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Server mode: API routes, PostgreSQL, AI gateway and background jobs now live
  // inside the same Next.js application. PWA/static assets continue to work.
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["pg", "web-push"],

  webpack: (config) => {
    config.context = __dirname;
    return config;
  },
};

export default nextConfig;
