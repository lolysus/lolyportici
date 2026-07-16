import "server-only";

import { restaurantConfig } from "@/config/brand";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type ReservationLifecycleResult = {
  markedLate: number;
  markedNoShow: number;
};

type LifecycleRow = { marked_late?: number; marked_no_show?: number };

export async function reconcileReservationLifecycle(locationId: string = restaurantConfig.locationId): Promise<ReservationLifecycleResult> {
  if (!isSupabaseConfigured() || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return { markedLate: 0, markedNoShow: 0 };
  }

  const { data, error } = await getSupabaseAdmin().rpc("reconcile_reservation_statuses", {
    p_location_id: locationId,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as LifecycleRow | null;
  return {
    markedLate: Number(row?.marked_late ?? 0),
    markedNoShow: Number(row?.marked_no_show ?? 0),
  };
}
