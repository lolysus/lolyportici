import "server-only";

import { createHash, createHmac, createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";

export function hashManagementToken(token: string) {
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER;
  if (!pepper && process.env.NODE_ENV === "production") throw new Error("MANAGEMENT_TOKEN_PEPPER is required in production");
  return createHash("sha256").update(`${token}:${pepper ?? "demo-only-pepper"}`).digest("hex");
}

export function managementTokenForIdempotency(idempotencyKey: string) {
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER;
  if (!pepper && process.env.NODE_ENV === "production") throw new Error("MANAGEMENT_TOKEN_PEPPER is required in production");
  return createHmac("sha256", pepper ?? "demo-only-pepper").update(`management:${idempotencyKey}`).digest("base64url");
}

export function verifyHmacSignature(rawBody: string, signature: string | null, timestamp: string | null, secret: string | undefined) {
  if (!secret) return process.env.NODE_ENV !== "production" && (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!signature || !timestamp) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > 5 * 60_000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature.replace(/^sha256=/, ""));
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function allowUnsignedDemo(secret: string | undefined) {
  return !secret && process.env.NODE_ENV !== "production" && (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

function withinTolerance(timestamp: number, unit: "seconds" | "milliseconds") {
  const milliseconds = unit === "seconds" ? timestamp * 1000 : timestamp;
  return Number.isFinite(milliseconds) && Math.abs(Date.now() - milliseconds) <= 5 * 60_000;
}

export function verifyRetellSignature(
  rawBody: string,
  signature: string | null,
  apiKey = process.env.RETELL_API_KEY ?? process.env.RETELL_WEBHOOK_SECRET,
) {
  if (allowUnsignedDemo(apiKey)) return true;
  if (!apiKey || !signature) return false;
  const match = /^v=(\d+),d=([0-9a-f]+)$/i.exec(signature);
  if (!match || !withinTolerance(Number(match[1]), "milliseconds")) return false;
  const expected = createHmac("sha256", apiKey).update(`${rawBody}${match[1]}`).digest();
  const actual = Buffer.from(match[2], "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyTelnyxSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  publicKey = process.env.TELNYX_PUBLIC_KEY,
) {
  if (allowUnsignedDemo(publicKey)) return true;
  if (!publicKey || !signature || !timestamp || !withinTolerance(Number(timestamp), "seconds")) return false;
  try {
    const rawKey = /^[0-9a-f]{64}$/i.test(publicKey)
      ? Buffer.from(publicKey, "hex")
      : Buffer.from(publicKey, "base64");
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const key = createPublicKey({
      key: rawKey.length === 32 ? Buffer.concat([spkiPrefix, rawKey]) : rawKey,
      format: "der",
      type: "spki",
    });
    return verifySignature(
      null,
      Buffer.from(`${timestamp}|${rawBody}`),
      key,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}

export function verifyResendSignature(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret = process.env.RESEND_WEBHOOK_SECRET,
) {
  if (allowUnsignedDemo(secret)) return true;
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  if (!withinTolerance(Number(headers.timestamp), "seconds")) return false;
  try {
    const key = secret.startsWith("whsec_")
      ? Buffer.from(secret.slice("whsec_".length), "base64")
      : Buffer.from(secret);
    const expected = createHmac("sha256", key)
      .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
      .digest();
    return headers.signature.split(" ").some((candidate) => {
      const encoded = candidate.startsWith("v1,") ? candidate.slice(3) : candidate;
      const actual = Buffer.from(encoded, "base64");
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    });
  } catch {
    return false;
  }
}
