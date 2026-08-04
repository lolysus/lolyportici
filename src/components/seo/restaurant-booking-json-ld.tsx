import type { RestaurantLocation } from "@/config/brand";
import { getGoogleMapsDirectionsUrl } from "@/lib/public-url";

/**
 * bookingUrl comes in as a prop, already resolved against the request's real
 * host by the page — not recomputed here from a static base, or the
 * @id/url/target fields would point at the wrong domain on a dedicated site.
 */
export function RestaurantBookingJsonLd({ restaurant, bookingUrl }: { restaurant: RestaurantLocation; bookingUrl: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${bookingUrl}#restaurant`,
    name: restaurant.name,
    legalName: restaurant.legalName,
    url: bookingUrl,
    address: restaurant.address,
    telephone: restaurant.phone,
    email: restaurant.email,
    servesCuisine: "Sushi",
    acceptsReservations: true,
    hasMap: getGoogleMapsDirectionsUrl(restaurant.address),
    potentialAction: {
      "@type": "ReserveAction",
      name: `Prenota da ${restaurant.name}`,
      target: {
        "@type": "EntryPoint",
        urlTemplate: bookingUrl,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />;
}
