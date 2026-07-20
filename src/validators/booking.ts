import { z } from "zod";

const source = z.enum(["web", "phone_ai", "phone_staff", "walk_in", "admin", "waitlist", "integration"]);
export const databaseIdSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Identificativo non valido",
);

export const availabilitySchema = z.object({
  locationId: databaseIdSchema,
  date: z.iso.date(),
  requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  partySize: z.number().int().min(1).max(100),
  preferredAreaId: databaseIdSchema.optional(),
  requestedDuration: z.number().int().min(45).max(360).optional(),
  source,
  accessibilityRequirements: z.boolean().optional(),
  tablePreferenceId: databaseIdSchema.optional(),
});

export const holdSchema = availabilitySchema.extend({
  startAt: z.iso.datetime(),
  sessionId: z.string().min(12).max(128),
});

export const customerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  email: z.union([z.email(), z.literal("")]).optional(),
  preferredLanguage: z.enum(["it", "en", "es"]).default("it"),
  marketingConsent: z.boolean().default(false),
  privacyConsent: z.literal(true),
  allergies: z.string().trim().max(500).optional(),
  accessibilityNeeds: z.string().trim().max(500).optional(),
});

export const reservationCreateSchema = z.object({
  locationId: databaseIdSchema,
  holdId: databaseIdSchema,
  idempotencyKey: z.string().min(16).max(128),
  customer: customerSchema,
  customerNotes: z.string().trim().max(1000).optional(),
  specialOccasion: z.string().trim().max(120).optional(),
});

export const reservationUpdateSchema = z.object({
  partySize: z.number().int().min(1).max(100).optional(),
  date: z.iso.date().optional(),
  requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  customerNotes: z.string().trim().max(1000).optional(),
  allergies: z.string().trim().max(500).optional(),
  accessibilityNeeds: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, "Inserisci almeno una modifica.");

export const holdReleaseSchema = z.object({
  holdId: databaseIdSchema,
  locationId: databaseIdSchema,
  sessionId: z.string().min(12).max(128),
});

export const waitlistSchema = z.object({
  locationId: databaseIdSchema,
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  requestedDate: z.iso.date(),
  requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  partySize: z.number().int().min(1).max(100),
  flexibilityMinutes: z.number().int().min(0).max(180).default(60),
  preferredAreaId: databaseIdSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const publicWaitlistSchema = waitlistSchema.extend({
  privacyConsent: z.literal(true),
});
