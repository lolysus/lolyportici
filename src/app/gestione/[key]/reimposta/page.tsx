import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { EntranceLayout, resolveEntrance } from "@/app/gestione/[key]/entrance";
import { PasswordResetForm } from "@/components/admin/password-reset-forms";
import { adminAccessPath } from "@/config/admin-access";

export const metadata: Metadata = { title: "Scegli una nuova password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ params, searchParams }: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ key }, { token }] = await Promise.all([params, searchParams]);
  const restaurant = await resolveEntrance(key);

  // La validità del link la controlla il modulo, non questa pagina: il
  // database sta dietro le `/api/*`, dove questa pagina non arriva.
  return <EntranceLayout
    restaurant={restaurant}
    headline="Scegline una che ricordi."
    lead="Una frase di quattro parole è più difficile da indovinare e più facile da ricordare di una parola piena di simboli. Da qui entri subito nel pannello."
  >
    <div className="surface-3d rounded-3xl border bg-card/72 p-6 backdrop-blur sm:p-8">
      <div className="mb-7 flex size-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><KeyRound className="size-5" /></div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{restaurant.shortName} · {restaurant.city}</p>
      <h1 className="mt-3 font-heading text-4xl tracking-tight">Nuova password</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">Da adesso userai questa per entrare. La precedente smette di funzionare.</p>
      <PasswordResetForm
        restaurant={{ slug: restaurant.slug, shortName: restaurant.shortName }}
        token={token ?? ""}
        entranceHref={adminAccessPath(restaurant)}
      />
    </div>
  </EntranceLayout>;
}
