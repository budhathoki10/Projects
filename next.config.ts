import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Paddle's checkout runs in an iframe from its own domains; everything else is same-origin.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.paddle.com`,
  "style-src 'self' 'unsafe-inline' https://cdn.paddle.com",
  "img-src 'self' data: blob: https://cdn.paddle.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.paddle.com",
  "frame-src https://*.paddle.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://*.paddle.com\")" },
];

const nextConfig: NextConfig = {
  // Shortlist is almost entirely per-user, request-time UI, so it uses the
  // classic dynamic rendering model instead of Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  experimental: {
    // CV uploads go up to 5 MB and photos to 3 MB; leave room for the form's own overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
