"use client";

import { useState } from "react";
import { CalendarPlus, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTimeInZone } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { PublicReservation } from "@/repositories/repository";

type ManualSource = "phone_staff" | "walk_in";
type Slot = { startAt: string; endAt: string; time: string };

const sourceLabels: Record<ManualSource, string> = { phone_staff: "Telefono", walk_in: "Arrivata al ristorante" };

function todayKey() { return new Date().toISOString().slice(0, 10); }

function emptyCustomer() {
  return { firstName: "", lastName: "", phone: "", email: "", allergies: "", accessibilityNeeds: "", notes: "" };
}

/**
 * La prenotazione presa al telefono o al banco, inserita da chi lavora in sala.
 *
 * Passa per lo stesso `createHold` + `confirmHold` di una prenotazione online:
 * lo stesso arbitro — tavoli, coperti, limiti di fascia — decide se il posto
 * c'è ancora, anche se chi la registra è staff e non un modulo pubblico.
 */
export function ManualReservationDialog({ defaultDate, onCreated }: { defaultDate: string; onCreated: (reservation: PublicReservation) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"slot" | "details">("slot");
  const [date, setDate] = useState(defaultDate);
  const [partySize, setPartySize] = useState(2);
  const [source, setSource] = useState<ManualSource>("phone_staff");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [customer, setCustomer] = useState(emptyCustomer());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("slot"); setDate(defaultDate); setPartySize(2); setSource("phone_staff");
    setSlots(null); setSelectedSlot(null); setCustomer(emptyCustomer()); setError(null);
  }

  async function loadSlots() {
    setError(null); setSlots(null); setSelectedSlot(null);
    setLoadingSlots(true);
    try {
      const params = new URLSearchParams({ date, partySize: String(partySize), source });
      const response = await fetch(`/api/admin/v1/reservations/manual?${params.toString()}`);
      const payload = await response.json() as { data?: { availableOptions: Slot[]; restrictions: string[] }; error?: { message: string } };
      if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Impossibile calcolare gli orari."); return; }
      if (payload.data.availableOptions.length === 0) {
        setError(payload.data.restrictions[0] ?? "Nessun orario disponibile per questa data e questo numero di persone.");
      }
      setSlots(payload.data.availableOptions);
    } catch { setError("Impossibile calcolare gli orari."); }
    finally { setLoadingSlots(false); }
  }

  function chooseSlot(slot: Slot) { setSelectedSlot(slot); setStep("details"); }

  const canSubmit = Boolean(selectedSlot && customer.firstName.trim().length >= 2 && customer.lastName.trim().length >= 2 && customer.phone.trim().length >= 6);

  async function submit() {
    if (!selectedSlot) return;
    setError(null); setSubmitting(true);
    try {
      const response = await fetch("/api/admin/v1/reservations/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date, startAt: selectedSlot.startAt, partySize, source,
          customer: {
            firstName: customer.firstName.trim(), lastName: customer.lastName.trim(), phone: customer.phone.trim(),
            email: customer.email.trim() || undefined,
            allergies: customer.allergies.trim() || undefined,
            accessibilityNeeds: customer.accessibilityNeeds.trim() || undefined,
          },
          customerNotes: customer.notes.trim() || undefined,
        }),
      });
      const payload = await response.json() as { data?: { reservation: PublicReservation }; error?: { message: string } };
      if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Prenotazione non riuscita."); return; }
      onCreated(payload.data.reservation);
      setOpen(false);
      reset();
    } catch { setError("Prenotazione non riuscita."); }
    finally { setSubmitting(false); }
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
    <DialogTrigger asChild><Button size="sm"><CalendarPlus className="size-4" />Nuova prenotazione</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Prenotazione manuale</DialogTitle>
        <DialogDescription>Per chi ha chiamato o è arrivato al ristorante. Occupa il tavolo e aggiorna la disponibilità come una prenotazione online.</DialogDescription>
      </DialogHeader>

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {step === "slot" && <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="manual-date">Data</Label><Input id="manual-date" type="date" min={todayKey()} value={date} onChange={(event) => { setDate(event.target.value); setSlots(null); }} className="mt-2" /></div>
          <div><Label htmlFor="manual-party">Persone</Label><Input id="manual-party" type="number" min={1} max={100} value={partySize} onChange={(event) => { setPartySize(Math.max(1, Number(event.target.value))); setSlots(null); }} className="mt-2" /></div>
        </div>
        <div>
          <Label htmlFor="manual-source">Arrivata da</Label>
          <Select value={source} onValueChange={(value) => { setSource(value as ManualSource); setSlots(null); }}>
            <SelectTrigger id="manual-source" className="mt-2 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(sourceLabels) as ManualSource[]).map((value) => <SelectItem key={value} value={value}>{sourceLabels[value]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {slots === null
          ? <Button variant="outline" onClick={() => void loadSlots()} disabled={loadingSlots || !date} className="w-full">
              {loadingSlots ? <LoaderCircle className="animate-spin" /> : null}Calcola orari disponibili
            </Button>
          : slots.length > 0 && <div className="grid grid-cols-4 gap-2">
              {slots.map((slot) => <button key={slot.startAt} type="button" onClick={() => chooseSlot(slot)} className="tile min-h-11 font-mono text-sm">{formatTimeInZone(slot.startAt)}</button>)}
            </div>}
      </div>}

      {step === "details" && selectedSlot && <div className="space-y-4">
        <p className="rounded-lg border bg-card/70 px-3 py-2 text-sm"><span className="font-mono font-semibold">{formatTimeInZone(selectedSlot.startAt)}</span> · {partySize} persone · {new Date(`${date}T12:00:00`).toLocaleDateString("it", { day: "numeric", month: "long" })}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="manual-first">Nome</Label><Input id="manual-first" value={customer.firstName} onChange={(event) => setCustomer({ ...customer, firstName: event.target.value })} className="mt-2" /></div>
          <div><Label htmlFor="manual-last">Cognome</Label><Input id="manual-last" value={customer.lastName} onChange={(event) => setCustomer({ ...customer, lastName: event.target.value })} className="mt-2" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="manual-phone">Telefono</Label><Input id="manual-phone" type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} className="mt-2" /></div>
          <div><Label htmlFor="manual-email">Email (facoltativo)</Label><Input id="manual-email" type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="mt-2" /></div>
        </div>
        <div><Label htmlFor="manual-notes">Note per il servizio</Label><Textarea id="manual-notes" value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} className="mt-2 min-h-20" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="manual-allergies">Allergie</Label><Input id="manual-allergies" value={customer.allergies} onChange={(event) => setCustomer({ ...customer, allergies: event.target.value })} className="mt-2" /></div>
          <div><Label htmlFor="manual-accessibility">Accessibilità</Label><Input id="manual-accessibility" value={customer.accessibilityNeeds} onChange={(event) => setCustomer({ ...customer, accessibilityNeeds: event.target.value })} className="mt-2" /></div>
        </div>
      </div>}

      <DialogFooter className="gap-2 sm:justify-between">
        {step === "details" && <Button variant="ghost" onClick={() => setStep("slot")}>Indietro</Button>}
        {step === "details" && <Button onClick={() => void submit()} disabled={!canSubmit || submitting} className={cn(!canSubmit && "opacity-60")}>
          {submitting ? <LoaderCircle className="animate-spin" /> : <Check className="size-4" />}Conferma prenotazione
        </Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
