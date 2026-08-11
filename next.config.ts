import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Keep every build input scoped to this independent repository.
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    const configuredBackend = process.env.BACKEND_ORIGIN
      ?? (process.env.VERCEL ? "https://loly-api-production.up.railway.app" : undefined);
    const backendOrigin = configuredBackend?.replace(/\/+$/, "");
    if (!backendOrigin) return { beforeFiles: [], afterFiles: [], fallback: [] };
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendOrigin}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        // Il service worker non va messo in cache: un aggiornamento dell'app
        // deve poter sostituire quello vecchio subito, non al prossimo giro di
        // cache. `Service-Worker-Allowed: /` gli lascia governare tutta l'origine
        // pur essendo servito dalla radice.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Nessuno deve poter incorniciare queste pagine dentro un altro
          // sito: sopra il pannello del ristorante si costruisce una finta
          // schermata e si fa cliccare "conferma" o "elimina" a chi crede di
          // premere altro. Le due intestazioni dicono la stessa cosa a
          // browser di generazioni diverse. Valgono anche in sviluppo, così
          // quello che si prova in locale è quello che va online.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // Il sito gestisce login e dati personali degli ospiti: il browser
          // deve rifiutarsi di aprirlo in chiaro, non limitarsi a preferire
          // HTTPS. Un anno, sottodomini inclusi.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
