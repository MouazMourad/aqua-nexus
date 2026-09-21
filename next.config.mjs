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
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'self'",
          "form-action 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "media-src 'self' blob:",
          "font-src 'self' data:",
          "connect-src 'self' https: wss:",
          "worker-src 'self' blob:",
          "manifest-src 'self'"
        ].join("; ")
      }
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },

  webpack: (config) => {
    config.context = __dirname;
    return config;
  },
};

export default nextConfig;
