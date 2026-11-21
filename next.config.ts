import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Importazione del foglio .xlsx (Netlify accetta richieste fino a ~6 MB).
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        // Il link degli Sposi contiene il token: non deve mai finire nel Referer verso altri siti.
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
