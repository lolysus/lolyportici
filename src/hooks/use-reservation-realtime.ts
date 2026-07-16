"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useReservationRealtime(onChange?: () => void, options: { locationId?: string; onReservationCreated?: () => void } = {}) {
  const client = getSupabaseBrowserClient();
  const { locationId, onReservationCreated } = options;
  const [status, setStatus] = useState<"connecting" | "live" | "offline" | "demo">(() => client ? "connecting" : "demo");
  useEffect(() => {
    if (!client) return;
    let channel = client.channel(`regia-operations-${locationId ?? "all"}`);
    channel = channel.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "reservations",
      ...(locationId ? { filter: `location_id=eq.${locationId}` } : {}),
    }, (payload: { eventType: string }) => {
      onChange?.();
      if (payload.eventType === "INSERT") onReservationCreated?.();
    });
    for (const table of ["reservation_holds", "waitlist_entries", "restaurant_tables", "customers", "voice_calls", "notifications"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange?.());
    }
    channel.subscribe((value: string) => setStatus(value === "SUBSCRIBED" ? "live" : value === "CHANNEL_ERROR" || value === "TIMED_OUT" ? "offline" : "connecting"));
    return () => { void client.removeChannel(channel); };
  }, [client, locationId, onChange, onReservationCreated]);
  return status;
}
