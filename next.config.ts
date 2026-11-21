import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Importazione del foglio .xlsx (Netlify accetta richieste fino a ~6 MB).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
