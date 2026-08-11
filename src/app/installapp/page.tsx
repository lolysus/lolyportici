import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { defaultRestaurantLocation, getRestaurantLocationById } from "@/config/brand";
import { restaurantForHost } from "@/config/domains";
import { adminAccessPath } from "@/config/admin-access";
import { getCurrentStaffSession } from "@/lib/auth/dal";
import { InstallAppClient } from "@/components/pwa/install-app-client";

/**
 * La pagina per installare l'app del personale e accendere le notifiche.
 *
 * Il link — /installapp — è lo stesso su ogni dominio, ma il dominio decide di
 * quale ristorante si tratta: yukoardea.it/installapp installa YUKO,
 * kousushiportici.it/installapp installa KouSushi. Chi è già entrato nel pannello
 * vede subito il pulsante per le notifiche; chi no, prima accede.
 */

async function hostRestaurant() {
  const host = (await headers()).get("host");
  return restaurantForHost(host) ?? defaultRestaurantLocation;
}

export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await hostRestaurant();
  return {
    title: `Installa l'app · ${restaurant.shortName}`,
    description: `Ricevi una notifica a ogni nuova prenotazione di ${restaurant.shortName}.`,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: restaurant.shortName },
    icons: { apple: `/brands/${restaurant.slug}-apple-180.png` },
    // Un indirizzo interno: non deve finire su Google.
    robots: { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const restaurant = await hostRestaurant();
  return { themeColor: restaurant.theme.primary };
}

export default async function InstallAppPage() {
  const host = await hostRestaurant();
  const session = await getCurrentStaffSession();
  // Quando c'è una sessione, il ristorante di riferimento è quello dell'account:
  // è la sede per cui arriveranno davvero le notifiche. Il dominio serve solo a
  // chi non è ancora entrato, per mandarlo alla porta giusta.
  const sessionRestaurant = session ? getRestaurantLocationById(session.locationId) : undefined;
  const restaurant = sessionRestaurant ?? host;

  return <InstallAppClient
    restaurant={{
      slug: restaurant.slug,
      name: restaurant.name,
      shortName: restaurant.shortName,
      city: restaurant.city,
      accent: restaurant.theme.primary,
      accentForeground: restaurant.theme.primaryForeground,
      surface: restaurant.theme.surface,
    }}
    authenticated={Boolean(session)}
    staffName={session?.name ?? null}
    loginHref={adminAccessPath(host)}
    agendaHref={`/admin/${restaurant.slug}/reservations`}
  />;
}
