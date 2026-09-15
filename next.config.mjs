import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Force Next.js file tracing to stay inside this Aqua Nexus project.
  outputFileTracingRoot: __dirname,

  webpack: (config) => {
    // Prevent Watchpack from treating C:\projects or C:\ as the app context.
    config.context = __dirname;
    return config;
  },
};

export default nextConfig;
