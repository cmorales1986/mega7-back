import type { NextConfig } from "next";

// Destino del backend .NET.
// - En local: http://localhost:5063 (valor por defecto)
// - En Vercel: definir API_PROXY_TARGET con la URL pública de Railway
//   (ej: https://mega7-api.up.railway.app)
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:5063";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy de todo lo que empiece con /api → backend .NET
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
