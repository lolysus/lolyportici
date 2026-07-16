"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { permissionLabels, permissions, roles, type Permission, type Role } from "@/config/permissions";

const roleLabels: Record<Role, string> = { owner: "Proprietario", administrator: "Amministratore", manager: "Manager", receptionist: "Reception", waiter: "Sala", phone_operator: "Operatore telefonico", analyst: "Analyst" };

export function RolePermissionMatrix({ initialPermissions, currentRole }: { initialPermissions: Record<Role, Permission[]>; currentRole: Role }) {
  const [matrix, setMatrix] = useState(initialPermissions);
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole === "owner" ? "administrator" : currentRole);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = matrix[selectedRole];
  const protectedRole = selectedRole === "owner";

  function toggle(permission: Permission, checked: boolean) {
    setMatrix((current) => ({ ...current, [selectedRole]: checked ? [...new Set([...current[selectedRole], permission])] : current[selectedRole].filter((item) => item !== permission) }));
    setSaved(false);
  }

  async function save() {
    setPending(true); setSaved(false); setError(null);
    const response = await fetch("/api/admin/v1/roles", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: selectedRole, permissions: selected }) });
    const payload = await response.json() as { data?: unknown; error?: { message: string } };
    setPending(false);
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Aggiornamento permessi non riuscito."); return; }
    setSaved(true);
  }

  return <div className="surface-3d-dark rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Matrice autorizzazioni</p><h2 className="mt-2 font-heading text-2xl">Permessi per ruolo</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Le modifiche vengono applicate alla navigazione e alle API al prossimo accesso degli utenti.</p></div><Select value={selectedRole} onValueChange={(value) => { setSelectedRole(value as Role); setSaved(false); setError(null); }}><SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent></Select></div>
    {protectedRole && <p className="mt-5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 p-3 text-sm text-primary"><ShieldCheck className="size-4" />Il proprietario mantiene sempre tutti i permessi.</p>}
    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{permissions.map((permission) => { const id = `permission-${selectedRole}-${permission.replace(":", "-")}`; const selfProtection = selectedRole === currentRole && permission === "staff:write"; return <div key={permission} className="flex items-start gap-3 rounded-xl border p-3"><Checkbox id={id} checked={protectedRole || selected.includes(permission)} disabled={protectedRole || selfProtection} onCheckedChange={(value) => toggle(permission, value === true)}/><div><Label htmlFor={id} className="text-sm">{permissionLabels[permission]}</Label><p className="mt-1 font-mono text-[9px] text-muted-foreground">{permission}</p></div></div>; })}</div>
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-5"><Button onClick={save} disabled={pending || protectedRole}>{pending ? <LoaderCircle className="animate-spin"/> : saved ? <CheckCircle2/> : <Save/>}{pending ? "Applicazione…" : saved ? "Permessi applicati" : "Salva permessi"}</Button><Badge variant="outline">{selected.length} di {permissions.length} attivi</Badge></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
  </div>;
}
