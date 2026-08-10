import {
  createHmac,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyResendSignature,
  verifyTelnyxSignature,
} from "@/lib/security";

const body = JSON.stringify({ id: "event-1", type: "test" });

describe("provider webhook signatures", () => {
  it("verifies Telnyx Ed25519 signatures", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const signature = sign(null, Buffer.from(`${timestamp}|${body}`), privateKey).toString("base64");
    const publicKeyDer = publicKey.export({ format: "der", type: "spki" }).toString("base64");
    expect(verifyTelnyxSignature(body, signature, timestamp, publicKeyDer)).toBe(true);
    expect(verifyTelnyxSignature(`${body} `, signature, timestamp, publicKeyDer)).toBe(false);
  });

  it("verifies Resend's Svix envelope", () => {
    const id = "msg_test_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from("resend-test-key-with-enough-entropy");
    const secret = `whsec_${key.toString("base64")}`;
    const signature = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
    expect(verifyResendSignature(body, { id, timestamp, signature: `v1,${signature}` }, secret)).toBe(true);
    expect(verifyResendSignature(`${body} `, { id, timestamp, signature: `v1,${signature}` }, secret)).toBe(false);
  });
});
