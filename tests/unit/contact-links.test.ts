import { describe, expect, it } from "vitest";
import { buildPhoneHref, buildWhatsappHref } from "@/lib/contact";

describe("phone link", () => {
  it("builds a tel: link from a formatted Italian number", () => {
    expect(buildPhoneHref("06 98871100")).toBe("tel:0698871100");
    expect(buildPhoneHref("+39 081 271258")).toBe("tel:+39081271258");
  });

  it("hides the button when there is nothing usable", () => {
    expect(buildPhoneHref("")).toBe("");
    expect(buildPhoneHref("Contatti in aggiornamento")).toBe("");
  });
});

describe("WhatsApp link", () => {
  it("builds a working wa.me link with the preset message", () => {
    const href = buildWhatsappHref("+39 329 9881193", "Ciao! Vorrei prenotare un tavolo da {ristorante}.", "KouSushi");
    expect(href).toBe("https://wa.me/393299881193?text=" + encodeURIComponent("Ciao! Vorrei prenotare un tavolo da KouSushi."));
  });

  it("omits the text parameter when no message is configured", () => {
    expect(buildWhatsappHref("+39 329 9881193", "", "KouSushi")).toBe("https://wa.me/393299881193");
  });

  // Il caso reale che ha bloccato YUKO: un numero comunicato con due cifre in
  // meno di un cellulare italiano valido. Il link deve restare vuoto invece
  // di pubblicare un pulsante WhatsApp che non apre nessuna chat.
  it("refuses a number that is too short to be a real mobile", () => {
    expect(buildWhatsappHref("+3933915436", "Ciao", "YUKO")).toBe("");
  });

  it("refuses an empty number", () => {
    expect(buildWhatsappHref("", "Ciao", "YUKO")).toBe("");
  });
});
