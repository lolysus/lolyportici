import "server-only";

import { randomUUID } from "node:crypto";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { reservationConfirmationEmail } from "@/emails/reservation-confirmation";
import { ResendEmailAdapter } from "@/integrations/email/resend/adapter";
import { TelnyxAdapter } from "@/integrations/telephony/telnyx/adapter";
import { formatTimeInZone } from "@/lib/datetime";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { PublicReservation } from "@/repositories/repository";

type Delivery = {
  channel: "email" | "sms";
  recipient: string;
  send: () => Promise<{ status: "sent" | "sandbox"; providerMessageId?: string }>;
};

function shouldLog() {
  return isSupabaseConfigured() && process.env.NEXT_PUBLIC_DEMO_MODE !== "true";
}

async function deliver(reservation: PublicReservation, delivery: Delivery, resend: boolean) {
  const db = shouldLog() ? getSupabaseAdmin() : null;
  const idempotencyKey = `${reservation.id}:reservation-confirmation:${delivery.channel}${resend ? `:resend:${randomUUID()}` : ""}`;
  let notificationId: string | undefined;
  if (db) {
    const { data, error } = await db.from("notifications").insert({
      organization_id: reservation.organizationId,
      reservation_id: reservation.id,
      customer_id: reservation.customerId,
      channel: delivery.channel,
      template: "reservation-confirmation",
      recipient: delivery.recipient,
      status: "sending",
      idempotency_key: idempotencyKey,
    }).select("id").single();
    if (error?.code === "23505") return { status: "duplicate" as const };
    if (error) throw error;
    notificationId = data.id;
  }

  try {
    const result = await delivery.send();
    if (db && notificationId) {
      const sandboxInProduction = result.status === "sandbox";
      const { error } = await db.from("notifications").update({
        status: sandboxInProduction ? "failed" : "sent",
        sent_at: sandboxInProduction ? null : new Date().toISOString(),
        failed_at: sandboxInProduction ? new Date().toISOString() : null,
        provider_message_id: result.providerMessageId ?? null,
        error_message: sandboxInProduction ? "Provider non configurato." : null,
      }).eq("id", notificationId);
      if (error) throw error;
      if (sandboxInProduction) throw new Error(`${delivery.channel} provider is not configured`);
    }
    return result;
  } catch (error) {
    if (db && notificationId) {
      await db.from("notifications").update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown notification error",
      }).eq("id", notificationId);
    }
    throw error;
  }
}

export async function sendReservationConfirmation(reservation: PublicReservation, options: { resend?: boolean; emailEnabled?: boolean; smsEnabled?: boolean } = {}) {
  const deliveries: Delivery[] = [];
  const restaurant = getRestaurantLocationById(reservation.locationId) ?? restaurantConfig;
  if (reservation.customer.email && options.emailEnabled !== false) {
    const message = reservationConfirmationEmail(reservation);
    deliveries.push({
      channel: "email",
      recipient: reservation.customer.email,
      send: () => new ResendEmailAdapter().send({ to: reservation.customer.email!, ...message }),
    });
  }
  if (options.smsEnabled !== false) {
    deliveries.push({
      channel: "sms",
      recipient: reservation.customer.phone,
      send: () => new TelnyxAdapter().sendSms({
        to: reservation.customer.phone,
        text: `${restaurant.name}: prenotazione ${reservation.reservationCode} confermata per ${reservation.partySize} persone alle ${formatTimeInZone(reservation.startAt)}.`,
      }),
    });
  }
  if (deliveries.length === 0) return { status: "disabled" as const, attempts: 0, failed: 0, sandbox: 0 };
  const results = await Promise.allSettled(deliveries.map((delivery) => deliver(reservation, delivery, Boolean(options.resend))));
  const failed = results.filter((result) => result.status === "rejected");
  const sandbox = results.filter((result) => result.status === "fulfilled" && result.value.status === "sandbox");
  return {
    status: failed.length ? "partial" : sandbox.length ? "sandbox" : "sent",
    attempts: results.length,
    failed: failed.length,
    sandbox: sandbox.length,
  };
}
