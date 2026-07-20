import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Gauge,
  MapPin,
  Phone,
  UsersRound,
  Utensils,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RestaurantLocation } from "@/config/brand";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { cn } from "@/lib/utils";
import type { ServiceMode } from "@/types/settings";

export interface LocationSummary {
  location: RestaurantLocation;
  reservations: number;
  covers: number;
  waiting: number;
  calls: number;
  operatingMode: ServiceMode;
  occupancyPercent: number;
  capacityLimit: number;
  capacityWarningPercent: number;
  serviceWindows: string;
  attentionCount: number;
}

const statusCopy: Record<ServiceMode, { label: string; dot: string; badge: string }> = {
  live: { label: "Operativa", dot: "bg-emerald-400", badge: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300" },
  approval: { label: "Solo richieste", dot: "bg-amber-400", badge: "border-amber-400/20 bg-amber-400/8 text-amber-300" },
  paused: { label: "In pausa", dot: "bg-rose-400", badge: "border-rose-400/20 bg-rose-400/8 text-rose-300" },
};

export function LocationCards({ summaries, activeLocationId }: { summaries: LocationSummary[]; activeLocationId: string }) {
  return <div className="grid gap-5 xl:grid-cols-2">
    {summaries.map((summary, index) => {
      const { location, reservations, covers, waiting, calls, operatingMode, occupancyPercent, capacityLimit, capacityWarningPercent, serviceWindows, attentionCount } = summary;
      const active = location.id === activeLocationId;
      const status = statusCopy[operatingMode];
      const capacityWarning = occupancyPercent >= capacityWarningPercent;

      return <article key={location.id} style={restaurantThemeStyle(location)} className={cn("surface-3d-dark group relative overflow-hidden rounded-xl border border-t-2 border-t-primary bg-card", active ? "border-primary/55" : "border-white/8")}>
        <div className="relative border-b border-white/8 p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <BrandLogo restaurant={location} priority={index === 0} compact className="w-36 shrink-0" />
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ristorante 0{index + 1}</p>{active && <Badge className="gap-1 rounded-sm bg-primary/12 text-primary"><Check className="size-3" />Selezionato</Badge>}</div>
                <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{location.name}</h2>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-3.5" />{location.address}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn("gap-2", status.badge)}><span className={cn("size-1.5 rounded-full", operatingMode === "live" && "signal-pulse", status.dot)} />{status.label}</Badge>
          </div>

          <div className="mt-6 grid gap-4 border border-white/8 bg-background/25 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex items-center justify-between gap-4 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><Gauge className="size-3.5" />Saturazione prevista</span><span className={cn("font-mono font-semibold", capacityWarning && "text-amber-300")}>{occupancyPercent}%</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><div className={cn("h-full rounded-full transition-[width]", capacityWarning ? "bg-amber-300" : "bg-primary")} style={{ width: `${occupancyPercent}%` }} /></div>
            </div>
            <div className="flex max-w-64 items-center gap-2 text-xs text-muted-foreground sm:border-l sm:border-white/8 sm:pl-4"><Clock3 className="size-3.5 shrink-0 text-primary" /><span>{serviceWindows}</span></div>
          </div>
        </div>

        <dl className="relative grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4">
          <Metric icon={CalendarDays} label="Prenotazioni" value={reservations} />
          <Metric icon={UsersRound} label="Coperti" value={covers} />
          <Metric icon={Utensils} label="In attesa" value={waiting} />
          <Metric icon={Phone} label="Chiamate" value={calls} />
        </dl>

        <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium">{attentionCount > 0 ? <><AlertTriangle className="size-3.5 text-amber-300" />{attentionCount} {attentionCount === 1 ? "attenzione operativa" : "attenzioni operative"}</> : <><Check className="size-3.5 text-emerald-300" />Configurazione regolare</>}</p>
            <p className="mt-1 text-xs text-muted-foreground">{capacityLimit} coperti programmabili nel servizio</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link href={`/it/book/${location.slug}`} target="_blank">Booking<ExternalLink /></Link></Button>
            <Button asChild size="sm"><a href={`/admin/${location.slug}`}>{active ? "Apri ristorante" : "Gestisci ristorante"}<ArrowRight /></a></Button>
          </div>
        </div>
      </article>;
    })}
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: number }) {
  return <div className="bg-card/95 p-5"><dt className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground"><Icon className="size-3.5 text-primary" />{label}</dt><dd className="mt-3 font-mono text-2xl font-semibold">{value}</dd></div>;
}
