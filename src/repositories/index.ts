import "server-only";

import { restaurantConfig } from "@/config/brand";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { MemoryReservationRepository } from "@/repositories/memory-repository";
import type { ReservationRepository } from "@/repositories/repository";
import { SupabaseReservationRepository } from "@/repositories/supabase-repository";

const repositories = new Map<string, ReservationRepository>();

export function getRepository(locationId: string = restaurantConfig.locationId): ReservationRepository {
  const cached = repositories.get(locationId);
  if (cached) return cached;
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isSupabaseConfigured();
  const selected: ReservationRepository = demoMode ? new MemoryReservationRepository(locationId) : new SupabaseReservationRepository(locationId);
  repositories.set(locationId, selected);
  return selected;
}
