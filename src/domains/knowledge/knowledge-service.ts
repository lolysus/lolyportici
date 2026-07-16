import "server-only";

import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { KnowledgeBaseItem } from "@/types/domain";

const defaults: KnowledgeBaseItem[] = [
  {
    id: "70000000-0000-0000-0000-000000000001",
    category: "Orari",
    question: "Quali sono gli orari?",
    answer: "Gli orari pubblici devono essere configurati prima della produzione.",
    language: "it",
    isPublic: true,
    isActive: true,
    priority: 10,
  },
  {
    id: "70000000-0000-0000-0000-000000000002",
    category: "Accessibilità",
    question: "Il ristorante è accessibile?",
    answer: "Sono disponibili tavoli accessibili. Segnala la necessità durante la prenotazione.",
    language: "it",
    isPublic: true,
    isActive: true,
    priority: 8,
  },
  {
    id: "70000000-0000-0000-0000-000000000003",
    category: "Allergeni",
    question: "Come comunico un allergene?",
    answer: "Indicalo durante la prenotazione; i casi gravi vengono trasferiti al personale.",
    language: "it",
    isPublic: true,
    isActive: true,
    priority: 10,
  },
];

const memory = globalThis as typeof globalThis & { __sushiKnowledge?: Map<string, KnowledgeBaseItem[]> };

function memoryItems(locationId: string) {
  memory.__sushiKnowledge ??= new Map();
  if (!memory.__sushiKnowledge.has(locationId)) {
    memory.__sushiKnowledge.set(locationId, structuredClone(defaults));
  }
  return memory.__sushiKnowledge.get(locationId)!;
}

export function resetKnowledgeForTests() {
  memory.__sushiKnowledge = new Map();
}

function shouldUseMemory() {
  return !isSupabaseConfigured() || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

function mapRow(row: Record<string, unknown>): KnowledgeBaseItem {
  return {
    id: String(row.id),
    category: String(row.category),
    question: String(row.question),
    answer: String(row.answer),
    language: row.language as KnowledgeBaseItem["language"],
    isPublic: Boolean(row.is_public),
    isActive: Boolean(row.is_active),
    priority: Number(row.priority),
  };
}

function restaurantScope(locationId: string) {
  const restaurant = getRestaurantLocationById(locationId);
  if (!restaurant) throw new Error("Restaurant scope not found");
  return restaurant;
}

export async function listKnowledgeItems(locationId: string = restaurantConfig.locationId): Promise<KnowledgeBaseItem[]> {
  const restaurant = restaurantScope(locationId);
  if (shouldUseMemory()) return structuredClone(memoryItems(locationId));
  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base")
    .select("id,category,question,answer,language,is_public,is_active,priority")
    .eq("restaurant_id", restaurant.restaurantId)
    .eq("location_id", locationId)
    .order("priority", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row));
}

export async function createKnowledgeItem(input: Omit<KnowledgeBaseItem, "id">, locationId: string = restaurantConfig.locationId): Promise<KnowledgeBaseItem> {
  const restaurant = restaurantScope(locationId);
  if (shouldUseMemory()) {
    const item = { ...input, id: crypto.randomUUID() };
    memoryItems(locationId).push(item);
    return structuredClone(item);
  }
  const { data, error } = await getSupabaseAdmin().from("knowledge_base").insert({
    restaurant_id: restaurant.restaurantId,
    location_id: locationId,
    category: input.category,
    question: input.question,
    answer: input.answer,
    language: input.language,
    is_public: input.isPublic,
    is_active: input.isActive,
    priority: input.priority,
  }).select("id,category,question,answer,language,is_public,is_active,priority").single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateKnowledgeItem(item: KnowledgeBaseItem, locationId: string = restaurantConfig.locationId): Promise<KnowledgeBaseItem> {
  const restaurant = restaurantScope(locationId);
  if (shouldUseMemory()) {
    const index = memoryItems(locationId).findIndex((candidate) => candidate.id === item.id);
    if (index === -1) throw new Error("Knowledge item not found");
    memoryItems(locationId)[index] = structuredClone(item);
    return structuredClone(item);
  }
  const { data, error } = await getSupabaseAdmin().from("knowledge_base").update({
    category: item.category,
    question: item.question,
    answer: item.answer,
    language: item.language,
    is_public: item.isPublic,
    is_active: item.isActive,
    priority: item.priority,
  }).eq("id", item.id).eq("restaurant_id", restaurant.restaurantId).eq("location_id", locationId)
    .select("id,category,question,answer,language,is_public,is_active,priority").single();
  if (error) throw error;
  return mapRow(data);
}
