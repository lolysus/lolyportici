"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useReservationRealtime } from "@/hooks/use-reservation-realtime";
import { cn } from "@/lib/utils";

export function RealtimeStatus({ locationId, compact = false }: { locationId: string; compact?: boolean }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const status = useReservationRealtime(refresh, { locationId });
  const label = status === "demo" ? "Demo" : status === "live" ? "Live" : status === "offline" ? "Offline" : "Connessione";
  return <div aria-label={`Stato realtime: ${label}`} className={cn("flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs", status === "offline" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-300", compact && "size-9 justify-center p-0 sm:size-auto sm:px-2.5 sm:py-1.5")}><span className={cn("size-1.5 rounded-full", status === "offline" ? "bg-destructive" : "bg-emerald-400", status === "connecting" && "animate-pulse")}/><span className={cn(compact && "hidden sm:inline")}>{label}</span></div>;
}
