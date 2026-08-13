/**
 * L'immagine di anteprima social (Open Graph / Twitter) per ogni ristorante.
 *
 * È quella che compare quando il link viene incollato su WhatsApp, Facebook,
 * Instagram o iMessage: senza, il link resta un rettangolo grigio. Ogni sede ha
 * la sua, con il proprio brand. I file stanno in `public/og`.
 */
export interface OgImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

const IMAGES: Record<string, OgImage> = {
  yuko: { url: "/og/yuko-og.jpg", width: 1200, height: 630, alt: "YUKO Sushi & Fusion — Ardea" },
  kousushi: { url: "/og/kousushi-og.jpg", width: 1200, height: 630, alt: "KouSushi — Portici" },
};

export function restaurantOgImage(slug: string): OgImage | null {
  return IMAGES[slug] ?? null;
}
