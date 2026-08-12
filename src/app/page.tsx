import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { siteRestaurant } from "@/lib/site-host";
import { loadSiteData } from "@/lib/site-data";
import { SiteShell } from "@/components/site/site-shell";
import { HomeView } from "@/components/site/home-view";

export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await siteRestaurant();
  if (!restaurant) return {};
  const city = restaurant.city.split("·")[0].trim();
  const title = `${restaurant.name} · Sushi & Fusion a ${city}`;
  const description = `Cucina giapponese e fusion a ${city}, con ampio parcheggio privato. Prenota il tuo tavolo online: disponibilità in tempo reale e conferma immediata.`;
  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { type: "website", title, description, siteName: restaurant.name },
  };
}

export default async function Home() {
  const restaurant = await siteRestaurant();
  // Sul dominio condiviso non c'è un sito: si mostra la scelta del ristorante.
  if (!restaurant) redirect("/it/book");
  const site = await loadSiteData(restaurant);
  return <SiteShell restaurant={restaurant} site={site}>
    <HomeView restaurant={restaurant} site={site} />
  </SiteShell>;
}
