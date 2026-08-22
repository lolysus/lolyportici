import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { restaurantLocations } from "@/config/brand";
import { adminAccessPath } from "@/config/admin-access";
import { canAccessAdminLocation, getAccessibleAdminLocations, getActiveAdminLocation, getScopedAdminRestaurant } from "@/lib/admin/location";
import { getCurrentStaffSession } from "@/lib/auth/dal";

/**
 * ⚠️ Niente `loading.tsx` in questa cartella. Non è una dimenticanza.
 *
 * Un `loading.tsx` crea un punto di sospensione, e React 19 rivela il
 * contenuto di un punto di sospensione passando da `startViewTransition`.
 * Finché la pagina non è visibile il browser quella transizione non la
 * esegue: il contenuto resta nel documento — dentro un `<div hidden>` già
 * pronto — e sullo schermo rimane lo scheletro, per sempre. Succede a chi
 * apre il pannello in una scheda in secondo piano.
 *
 * Verificato il 2026-08-06 su build di produzione: con `loading.tsx` la
 * dashboard si fermava allo scheletro in una scheda nascosta, mentre la
 * pagina pubblica di prenotazione — che non ha punti di sospensione — si
 * vedeva senza problemi nella stessa scheda.
 *
 * Queste pagine si servono in mezzo secondo: meglio aspettarle intere che
 * mostrare uno scheletro che rischia di non andarsene più.
 */

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
  const session = await getCurrentStaffSession();
  const scoped = await getScopedAdminRestaurant();

  // Sessione assente o scaduta: NON si finisce sulla pagina generica "Ogni
  // ristorante ha il suo ingresso", che è un vicolo cieco senza modo di
  // rientrare — l'app installata ci sbatteva ogni volta che il login scadeva.
  // Si torna all'ingresso riservato della propria sede, che ha il form di
  // accesso e riporta dritti al pannello.
  if (!session) redirect(scoped ? adminAccessPath(scoped) : "/login");

  const accessibleLocations = getAccessibleAdminLocations(session);

  // Chi apre il pannello di una sede in cui non lavora non ci entra e non ci
  // guarda dentro nemmeno per sbaglio: viene rimandato al proprio. Senza
  // questo controllo l'indirizzo direbbe "yuko" mentre i dati sarebbero di
  // KouSushi, che è peggio di un errore.
  if (scoped && !canAccessAdminLocation(session, scoped.id)) {
    const own = accessibleLocations[0];
    redirect(own ? `/admin/${own.slug}/dashboard` : "/login");
  }

  const activeLocation = await getActiveAdminLocation(session);
  return <AdminShell session={session} locations={accessibleLocations.length ? accessibleLocations : restaurantLocations.slice(0, 1)} activeLocation={activeLocation} scopedRestaurantSlug={scoped?.slug ?? null}>{children}</AdminShell>;
}
