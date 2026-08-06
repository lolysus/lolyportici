import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { EntranceLayout, resolveEntrance } from "@/app/gestione/[key]/entrance";
import { LoginForm } from "@/components/admin/login-form";
import { adminAccessPath } from "@/config/admin-access";
import { getCurrentStaffSession } from "@/lib/auth/dal";
import { isNativeAuthConfigured } from "@/lib/auth/native";

/**
 * L'ingresso riservato di una sede. Non è linkato da nessuna pagina pubblica:
 * ci si arriva solo con l'indirizzo in mano.
 */

// Un indirizzo che non deve finire su Google, né essere ricostruibile da un
// crawler che segue i link.
export const metadata: Metadata = { title: "Accesso riservato", robots: { index: false, follow: false } };

export default async function RestaurantStaffEntrance({ params, searchParams }: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ reimpostata?: string }>;
}) {
  const [{ key }, { reimpostata }] = await Promise.all([params, searchParams]);
  const restaurant = await resolveEntrance(key);

  // Chi è già dentro non deve reinserire le credenziali per farsi rimandare
  // dove stava andando.
  const session = await getCurrentStaffSession();
  if (session?.accessibleLocationIds.includes(restaurant.id)) redirect(`/admin/${restaurant.slug}`);

  const demoMode = !isNativeAuthConfigured() && process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return <EntranceLayout
    restaurant={restaurant}
    headline={`Il pannello di ${restaurant.shortName}, e nient’altro.`}
    lead={`Sala, prenotazioni e ospiti di ${restaurant.city}. Gli altri locali del gruppo non sono raggiungibili da qui.`}
  >
    {reimpostata === "1" && <p role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm leading-6 text-emerald-200">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      Password aggiornata. Entra con quella nuova.
    </p>}
    <LoginForm
      demoMode={demoMode}
      restaurant={{ slug: restaurant.slug, shortName: restaurant.shortName, city: restaurant.city }}
      recoveryHref={`${adminAccessPath(restaurant)}/recupera`}
    />
  </EntranceLayout>;
}
