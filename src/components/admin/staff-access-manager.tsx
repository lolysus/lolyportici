"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/config/permissions";

export type StaffAccessRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "invited" | "suspended";
  locationName: string;
  isCurrent: boolean;
  isOwner: boolean;
  isProtected: boolean;
};

const roleLabels: Record<Role, string> = { owner: "Proprietario", administrator: "Amministratore centrale", manager: "Manager di sede", receptionist: "Reception", waiter: "Sala", phone_operator: "Operatore telefonico", analyst: "Analyst" };
const assignableRoles: Role[] = ["administrator", "manager", "receptionist", "waiter", "phone_operator", "analyst"];

export function StaffAccessManager({ initialStaff, canAssignAdministrator }: { initialStaff: StaffAccessRow[]; canAssignAdministrator: boolean }) {
  const [rows, setRows] = useState(initialStaff);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visibleRoles = canAssignAdministrator ? assignableRoles : assignableRoles.filter((role) => role !== "administrator");

  function change(id: string, values: Partial<Pick<StaffAccessRow, "role" | "status">>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...values } : row));
    setSavedId(null);
  }

  async function save(row: StaffAccessRow) {
    setPendingId(row.id); setSavedId(null); setError(null);
    const response = await fetch("/api/admin/v1/staff", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ staffId: row.id, role: row.role, status: row.status }) });
    const payload = await response.json() as { data?: unknown; error?: { message: string } };
    setPendingId(null);
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Aggiornamento accesso non riuscito."); return; }
    setSavedId(row.id);
  }

  return <>
    <div className="surface-3d-dark overflow-x-auto rounded-2xl border bg-card">
      <Table className="min-w-[900px]">
        <TableHeader><TableRow><TableHead>Persona</TableHead><TableHead>Ruolo</TableHead><TableHead>Stato accesso</TableHead><TableHead>Sede</TableHead><TableHead>Protezione</TableHead><TableHead className="text-right">Azione</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((person) => <TableRow key={person.id}>
          <TableCell><div className="flex items-center gap-2"><p className="font-medium">{person.name}</p>{person.isCurrent && <Badge variant="outline">Tu</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{person.email}</p></TableCell>
          <TableCell>{person.isProtected ? <Badge variant="secondary">{roleLabels[person.role]}</Badge> : <Select value={person.role} disabled={person.isCurrent} onValueChange={(value) => change(person.id, { role: value as Role })}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{visibleRoles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent></Select>}</TableCell>
          <TableCell><Select value={person.status} disabled={person.isProtected || person.isCurrent} onValueChange={(value) => change(person.id, { status: value as StaffAccessRow["status"] })}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Attivo</SelectItem><SelectItem value="invited">Invitato</SelectItem><SelectItem value="suspended">Sospeso</SelectItem></SelectContent></Select></TableCell>
          <TableCell>{person.locationName}</TableCell>
          <TableCell><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />{person.isProtected || person.isCurrent ? "Account protetto" : "Supabase Auth"}</span></TableCell>
          <TableCell className="text-right"><Button size="sm" variant="outline" disabled={person.isProtected || person.isCurrent || pendingId === person.id} onClick={() => void save(person)}>{pendingId === person.id ? <LoaderCircle className="animate-spin"/> : savedId === person.id ? <CheckCircle2/> : <Save/>}{savedId === person.id ? "Salvato" : "Applica"}</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
  </>;
}
