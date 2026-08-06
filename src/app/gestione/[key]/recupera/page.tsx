import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { EntranceLayout, resolveEntrance } from "@/app/gestione/[key]/entrance";
import { PasswordResetRequestForm } from "@/components/admin/password-reset-forms";
import { adminAccessPath } from "@/config/admin-access";

export const metadata: Metadata = { title: "Recupera la password", robots: { index: false, follow: false } };

export default async function RecoverPasswordPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const restaurant = await resolveEntrance(key);

  return <EntranceLayout
    restaurant={restaurant}
    headline="Capita. Si rimedia in un minuto."
    lead={`Ti mandiamo un link all’indirizzo con cui entri nel pannello di ${restaurant.shortName}. Nessuno può usarlo al posto tuo: vale un’ora e una volta sola.`}
  >
    <div className="surface-3d rounded-3xl border bg-card/72 p-6 backdrop-blur sm:p-8">
      <div className="mb-7 flex size-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><LockKeyhole className="size-5" /></div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{restaurant.shortName} · {restaurant.city}</p>
      <h1 className="mt-3 font-heading text-4xl tracking-tight">Password dimenticata</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">Indica la tua email di lavoro: ti arriva il link per sceglierne una nuova.</p>
      <PasswordResetRequestForm restaurant={{ slug: restaurant.slug, shortName: restaurant.shortName }} backHref={adminAccessPath(restaurant)} />
    </div>
  </EntranceLayout>;
}
