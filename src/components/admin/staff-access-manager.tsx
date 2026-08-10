import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/config/permissions";

export type StaffAccessRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationName: string;
};

const roleLabels: Record<Role, string> = { owner: "Proprietario", administrator: "Amministratore centrale", manager: "Manager di sede", receptionist: "Reception", waiter: "Sala", phone_operator: "Operatore telefonico", analyst: "Analyst" };

/**
 * Un solo account per sede, quindi niente tabella con inviti e riassegnazioni
 * di ruolo: sarebbero controlli senza niente da controllare, e in produzione
 * — senza Supabase — non toccavano comunque il database. Qui si vede chi
 * entra, e da dove si cambia la password.
 */
export function StaffAccessManager({ account }: { account: StaffAccessRow }) {
  return <div className="surface-3d-dark overflow-hidden rounded-2xl border bg-card">
    <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{account.name}</p><Badge variant="secondary">{roleLabels[account.role]}</Badge></div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{account.email}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-700"><ShieldCheck className="size-3.5" />Account protetto</span>
    </div>
  </div>;
}
