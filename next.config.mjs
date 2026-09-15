import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Aqua Nexus is currently a client-side/PWA preview, so export a fully static build.
  // This makes the Netlify mobile preview reliable without requiring SSR/functions.
  output: "export",

  // Force Next.js file tracing to stay inside this Aqua Nexus project.
  outputFileTracingRoot: __dirname,

  webpack: (config) => {
    // Prevent Watchpack from treating C:\projects or C:\ as the app context.
    config.context = __dirname;
    return config;
  },
};

export default nextConfig;
