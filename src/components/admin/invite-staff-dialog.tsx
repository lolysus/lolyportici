"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InviteStaffDialog({ locationName, canInviteAdministrator }: { locationName: string; canInviteAdministrator: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState("receptionist");

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/admin/v1/staff/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: formData.get("firstName"), lastName: formData.get("lastName"), email: formData.get("email"), role }),
    });
    const payload = await response.json() as { data?: { status: string }; error?: { message: string } };
    setPending(false);
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Invito non riuscito."); return; }
    setSuccess(payload.data.status === "sandbox" ? "Invito simulato in ambiente demo." : "Invito inviato.");
    router.refresh();
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><UserPlus /> Invita persona</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Invita una persona</DialogTitle><DialogDescription>Supabase Auth invierà il link di accesso. I ruoli operativi saranno assegnati a {locationName}.</DialogDescription></DialogHeader>
      <form action={submit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="invite-first-name">Nome</Label><Input id="invite-first-name" name="firstName" required minLength={2} className="mt-2" /></div><div><Label htmlFor="invite-last-name">Cognome</Label><Input id="invite-last-name" name="lastName" required minLength={2} className="mt-2" /></div></div>
        <div><Label htmlFor="invite-email">Email</Label><Input id="invite-email" name="email" type="email" required className="mt-2" /></div>
        <div><Label>Ruolo</Label><Select value={role} onValueChange={setRole}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent>{canInviteAdministrator && <SelectItem value="administrator">Amministratore centrale</SelectItem>}<SelectItem value="manager">Manager di sede</SelectItem><SelectItem value="receptionist">Receptionist</SelectItem><SelectItem value="waiter">Sala</SelectItem><SelectItem value="phone_operator">Operatore telefonico</SelectItem><SelectItem value="analyst">Analyst</SelectItem></SelectContent></Select></div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {success && <p role="status" className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary"><CheckCircle2 className="size-4" />{success}</p>}
        <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}{pending ? "Invio…" : "Invia invito"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
