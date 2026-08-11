import { headers } from "next/headers";
import { defaultRestaurantLocation } from "@/config/brand";
import { restaurantForHost } from "@/config/domains";

/**
 * Il manifest della PWA, diverso per ogni dominio.
 *
 * Su yukoardea.it l'app installata è "YUKO", su kousushiportici.it è "KouSushi":
 * nome, colori e icona vengono dal ristorante del dominio. Per questo è una
 * rotta e non un file statico — deve leggere l'host della richiesta. Gira su
 * Vercel come le pagine, quindi non serve nessuna variabile del backend.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const host = (await headers()).get("host");
  const restaurant = restaurantForHost(host) ?? defaultRestaurantLocation;

  const manifest = {
    id: `/installapp?sede=${restaurant.slug}`,
    name: `${restaurant.shortName} · Prenotazioni`,
    short_name: restaurant.shortName,
    description: `Notifiche e agenda prenotazioni di ${restaurant.shortName}.`,
    lang: "it",
    dir: "ltr",
    start_url: "/installapp?app=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: restaurant.theme.surface,
    theme_color: restaurant.theme.primary,
    categories: ["business", "food", "productivity"],
    icons: [
      { src: `/brands/${restaurant.slug}-icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/brands/${restaurant.slug}-icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/brands/${restaurant.slug}-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
