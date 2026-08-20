"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimeInZone } from "@/lib/datetime";
import type { PublicReservation } from "@/repositories/repository";
import type { TableResource } from "@/types/domain";

/**
 * Stampa tutte le prenotazioni in un foglio ordinato e leggibile.
 *
 * Costruisce un documento pulito in un iframe nascosto — indipendente dalla
 * grafica del pannello — e apre la finestra di stampa del sistema, da cui si
 * può stampare su carta o salvare come PDF. Raggruppa per giorno e ordina per
 * ora, con tutti i dati di chi ha prenotato.
 */
const STATUS_LABEL: Record<string, string> = {
  draft: "Bozza",
  held: "Opzione",
  pending_confirmation: "In attesa",
  pending_approval: "Da approvare",
  confirmed: "Confermata",
  modified: "Modificata",
  arriving: "In arrivo",
  late: "In ritardo",
  arrived: "Arrivato",
  seated: "In servizio",
  completed: "Completata",
  cancelled_by_customer: "Cancellata",
  cancelled_by_restaurant: "Cancellata staff",
  no_show: "No-show",
  waitlisted: "Lista d'attesa",
  offered: "Proposta",
  expired: "Scaduta",
};

const SOURCE_LABEL: Record<string, string> = {
  web: "Online",
  phone_ai: "Telefono AI",
  phone_staff: "Telefono",
  walk_in: "Al banco",
  admin: "Pannello",
  waitlist: "Lista d'attesa",
  integration: "Integrazione",
};

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function PrintReservationsButton({
  reservations,
  tables,
  restaurantName,
  city,
  timezone,
}: {
  reservations: PublicReservation[];
  tables: TableResource[];
  restaurantName: string;
  city: string;
  timezone: string;
}) {
  const [busy, setBusy] = useState(false);

  function tableLabel(reservation: PublicReservation) {
    const names = reservation.tableIds
      .map((id) => tables.find((table) => table.id === id))
      .filter((table): table is TableResource => Boolean(table));
    if (names.length === 0) return "—";
    const area = names[0]?.diningAreaName;
    const codes = names.map((table) => table.displayName || table.code).join(", ");
    return area ? `${codes} · ${area}` : codes;
  }

  function build() {
    const printable = [...reservations].sort((a, b) =>
      a.reservationDate === b.reservationDate ? a.startAt.localeCompare(b.startAt) : a.reservationDate.localeCompare(b.reservationDate),
    );

    const groups = new Map<string, PublicReservation[]>();
    for (const reservation of printable) {
      const list = groups.get(reservation.reservationDate) ?? [];
      list.push(reservation);
      groups.set(reservation.reservationDate, list);
    }

    const dateLabel = (key: string) =>
      new Date(`${key}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    const now = new Date().toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });

    const sections = [...groups.entries()]
      .map(([date, list]) => {
        const rows = list
          .map((r) => {
            const c = r.customer;
            const notes = [
              c.allergies ? `Allergie: ${c.allergies}` : "",
              c.accessibilityNeeds ? `Accessibilità: ${c.accessibilityNeeds}` : "",
              r.specialOccasion ? `Occasione: ${r.specialOccasion}` : "",
              r.customerNotes || "",
            ].filter(Boolean).join(" · ");
            return `<tr>
              <td class="c">${esc(formatTimeInZone(r.startAt, timezone))}</td>
              <td class="c b">${esc(r.partySize)}</td>
              <td>${esc(`${c.firstName} ${c.lastName}`.trim())}</td>
              <td class="mono">${esc(c.phone || "—")}</td>
              <td class="mono sm">${esc(c.email || "—")}</td>
              <td>${esc(tableLabel(r))}</td>
              <td>${esc(STATUS_LABEL[r.status] ?? r.status)}<span class="src"> · ${esc(SOURCE_LABEL[r.source] ?? r.source)}</span></td>
              <td class="notes">${esc(notes || "—")}</td>
              <td class="mono sm">${esc(r.reservationCode)}</td>
            </tr>`;
          })
          .join("");
        const covers = list.reduce((sum, r) => sum + r.partySize, 0);
        return `<section>
          <h2>${esc(dateLabel(date))} <span class="count">· ${list.length} prenotazioni · ${covers} coperti</span></h2>
          <table>
            <thead><tr>
              <th class="c">Ora</th><th class="c">Pax</th><th>Cliente</th><th>Telefono</th><th>Email</th>
              <th>Tavolo</th><th>Stato</th><th>Note e allergie</th><th>Codice</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
      })
      .join("");

    const empty = printable.length === 0 ? `<p class="empty">Nessuna prenotazione da stampare.</p>` : "";

    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Prenotazioni ${esc(restaurantName)}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm 10mm; }
      * { box-sizing: border-box; }
      body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1c1c1c; font-size: 9.5pt; margin: 0; }
      header { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 14px; }
      header .brand { font-size: 8.5pt; letter-spacing: .18em; text-transform: uppercase; color: #666; }
      header h1 { font-size: 20pt; margin: 2px 0 0; }
      header .meta { font-size: 8.5pt; color: #666; margin-top: 2px; }
      section { margin-bottom: 16px; page-break-inside: auto; }
      h2 { font-size: 11pt; margin: 0 0 5px; padding: 4px 0; border-bottom: 1px solid #bbb; text-transform: capitalize; }
      h2 .count { font-weight: normal; font-size: 8.5pt; color: #777; text-transform: none; }
      table { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      th { text-align: left; font-size: 7.5pt; letter-spacing: .06em; text-transform: uppercase; color: #555; border-bottom: 1px solid #999; padding: 3px 5px; }
      td { border-bottom: 1px solid #eee; padding: 4px 5px; vertical-align: top; }
      tr { page-break-inside: avoid; }
      .c { text-align: center; white-space: nowrap; }
      .b { font-weight: 700; }
      .mono { font-family: "Courier New", monospace; }
      .sm { font-size: 8pt; color: #444; }
      .src { color: #999; }
      .notes { font-size: 8.3pt; color: #333; max-width: 60mm; }
      .empty { text-align: center; color: #777; padding: 40px; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    </style></head>
    <body>
      <header>
        <div class="brand">${esc(restaurantName)} · ${esc(city)}</div>
        <h1>Prenotazioni</h1>
        <div class="meta">Stampato il ${esc(now)} · ${printable.length} prenotazioni totali</div>
      </header>
      ${sections}${empty}
    </body></html>`;
  }

  function handlePrint() {
    if (busy) return;
    setBusy(true);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const cleanup = () => {
      setBusy(false);
      setTimeout(() => iframe.remove(), 500);
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      return;
    }
    doc.open();
    doc.write(build());
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.onafterprint = cleanup;
    // Un attimo perché il layout si assesti prima di aprire la stampa.
    setTimeout(() => {
      win.focus();
      win.print();
      // Rete di sicurezza se onafterprint non scatta (alcuni browser).
      setTimeout(() => setBusy(false), 1500);
    }, 250);
  }

  return (
    <Button type="button" variant="outline" onClick={handlePrint} disabled={busy}>
      <Printer />
      {busy ? "Preparo…" : "Stampa prenotazioni"}
    </Button>
  );
}
