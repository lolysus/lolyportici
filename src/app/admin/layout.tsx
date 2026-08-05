import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { restaurantLocations } from "@/config/brand";
import { canAccessAdminLocation, getAccessibleAdminLocations, getActiveAdminLocation, getScopedAdminRestaurant } from "@/lib/admin/location";
import { requireStaffSession } from "@/lib/auth/dal";

/**
 * Anche la linguetta del browser è informazione separata: nel pannello di
 * Ardea non deve comparire il nome di Portici, come non compare in nessun'altra
 * schermata. Senza questo, il titolo predefinito restava "YUKO × KouSushi".
 */
export async function generateMetadata(): Promise<Metadata> {
  const scoped = await getScopedAdminRestaurant();
  return {
    title: { default: scoped ? `${scoped.shortName} · pannello` : "Pannello del ristorante", template: `%s · ${scoped?.shortName ?? "Pannello"}` },
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession();
  const accessibleLocations = getAccessibleAdminLocations(session);

  // Chi apre il pannello di una sede in cui non lavora non ci entra e non ci
  // guarda dentro nemmeno per sbaglio: viene rimandato al proprio. Senza
  // questo controllo l'indirizzo direbbe "yuko" mentre i dati sarebbero di
  // KouSushi, che è peggio di un errore.
  const scoped = await getScopedAdminRestaurant();
  if (scoped && !canAccessAdminLocation(session, scoped.id)) {
    const own = accessibleLocations[0];
    redirect(own ? `/admin/${own.slug}/dashboard` : "/login");
  }

  const activeLocation = await getActiveAdminLocation(session);
  return <AdminShell session={session} locations={accessibleLocations.length ? accessibleLocations : restaurantLocations.slice(0, 1)} activeLocation={activeLocation} scopedRestaurantSlug={scoped?.slug ?? null}>{children}</AdminShell>;
}
