import type { RestaurantLocation } from "@/config/brand";
import { getGoogleMapsDirectionsUrl, getPublicBookingUrl } from "@/lib/public-url";

export function RestaurantBookingJsonLd({ restaurant, locale }: { restaurant: RestaurantLocation; locale: string }) {
  const bookingUrl = getPublicBookingUrl(locale, restaurant);
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
