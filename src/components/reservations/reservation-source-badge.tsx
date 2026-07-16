import {
  AudioWaveform,
  Footprints,
  Globe2,
  PhoneCall,
  Plug,
  Timer,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { ReservationSource } from "@/types/domain";
import { cn } from "@/lib/utils";

type SourceInfo = {
  label: string;
  description: string;
  icon: LucideIcon;
  className: string;
};

export const reservationSourceInfo: Record<ReservationSource, SourceInfo> = {
  phone_ai: {
    label: "Voce AI",
    description: "Acquisita dall’assistente vocale",
    icon: AudioWaveform,
    className: "border-violet-400/25 bg-violet-400/10 text-violet-700 dark:text-violet-200",
  },
  phone_staff: {
    label: "Telefono staff",
    description: "Inserita dal personale durante una chiamata",
    icon: PhoneCall,
    className: "border-sky-400/25 bg-sky-400/10 text-sky-700 dark:text-sky-200",
  },
  web: {
    label: "Web",
    description: "Prenotata online dall’ospite",
    icon: Globe2,
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200",
  },
  walk_in: {
    label: "Walk-in",
    description: "Ospite arrivato senza prenotazione",
    icon: Footprints,
    className: "border-amber-400/25 bg-amber-400/10 text-amber-700 dark:text-amber-200",
  },
  admin: {
    label: "Staff",
    description: "Inserita dalla regia operativa",
    icon: UserCog,
    className: "border-stone-400/25 bg-stone-400/10 text-stone-700 dark:text-stone-200",
  },
  waitlist: {
    label: "Lista d’attesa",
    description: "Convertita dalla lista d’attesa",
    icon: Timer,
    className: "border-orange-400/25 bg-orange-400/10 text-orange-700 dark:text-orange-200",
  },
  integration: {
    label: "Integrazione",
    description: "Importata da un sistema collegato",
    icon: Plug,
    className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200",
  },
};

export function ReservationSourceBadge({
  source,
  className,
  showDescription = false,
}: {
  source: ReservationSource;
  className?: string;
  showDescription?: boolean;
}) {
  const info = reservationSourceInfo[source];
  const Icon = info.icon;

  if (showDescription) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border p-3", info.className, className)}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/10">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{info.label}</span>
          <span className="mt-0.5 block text-xs opacity-70">{info.description}</span>
        </span>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", info.className, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {info.label}
    </span>
  );
}
