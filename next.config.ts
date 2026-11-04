import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/events/**": ["./public/fonts/*.woff"],
    "/api/patrocinador/**": ["./public/fonts/*.woff"],
    "/api/patrocinadores/**": ["./public/fonts/*.woff"],
    "/credencial/**": ["./public/fonts/*.woff"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/inscricao/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none';",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
      {
        source: "/embed/inscricao/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
