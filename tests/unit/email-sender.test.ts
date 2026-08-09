import { afterEach, describe, expect, it } from "vitest";
import { restaurantLocations } from "@/config/brand";
import { emailSenderConfigured, emailSenderFor } from "@/config/email-sender";

const [yuko, kousushi] = restaurantLocations;
const originalByLocation = process.env.EMAIL_FROM_BY_LOCATION;
const originalGlobal = process.env.EMAIL_FROM;

function restore(name: "EMAIL_FROM_BY_LOCATION" | "EMAIL_FROM", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("EMAIL_FROM_BY_LOCATION", originalByLocation);
  restore("EMAIL_FROM", originalGlobal);
});

describe("mittente email per sede", () => {
  it("dà a ogni ristorante il proprio dominio", () => {
    process.env.EMAIL_FROM_BY_LOCATION = "yuko=noreply@yukoardea.it,kousushi=noreply@kousushiportici.it";
    delete process.env.EMAIL_FROM;
    // Il punto di tutto l'esercizio: due attività separate, due mittenti.
    expect(emailSenderFor(yuko)).toBe("YUKO <noreply@yukoardea.it>");
    expect(emailSenderFor(kousushi)).toBe("KouSushi <noreply@kousushiportici.it>");
  });

  it("ripiega sul mittente globale per una sede non elencata", () => {
    process.env.EMAIL_FROM_BY_LOCATION = "yuko=noreply@yukoardea.it";
    process.env.EMAIL_FROM = "noreply@yukoardea.it";
    // Spedire dal mittente sbagliato è peggio che dal proprio, ma molto meglio
    // che lasciare una sede senza recupero password.
    expect(emailSenderFor(kousushi)).toBe(`${kousushi.shortName} <noreply@yukoardea.it>`);
  });

  it("non inventa un mittente quando non ne è configurato nessuno", () => {
    delete process.env.EMAIL_FROM_BY_LOCATION;
    delete process.env.EMAIL_FROM;
    // Senza mittente l'adapter entra in sandbox: meglio un invio che non parte
    // di un invio che parte da un indirizzo inesistente e viene rifiutato.
    expect(emailSenderFor(yuko)).toBeUndefined();
    expect(emailSenderConfigured(yuko)).toBe(false);
  });

  it("rispetta un valore già scritto con nome e indirizzo", () => {
    process.env.EMAIL_FROM_BY_LOCATION = "kousushi=Prenotazioni KouSushi <ciao@kousushiportici.it>";
    expect(emailSenderFor(kousushi)).toBe("Prenotazioni KouSushi <ciao@kousushiportici.it>");
  });

  it("ignora le voci malformate invece di spedire da un indirizzo rotto", () => {
    process.env.EMAIL_FROM_BY_LOCATION = "rotto,=vuoto,yuko=,ignoto=x@y.it";
    delete process.env.EMAIL_FROM;
    expect(emailSenderFor(yuko)).toBeUndefined();
  });

  it("segnala una sede alla volta, non un guasto complessivo", () => {
    process.env.EMAIL_FROM_BY_LOCATION = "yuko=noreply@yukoardea.it";
    delete process.env.EMAIL_FROM;
    // È la distinzione che serve al health check: "Portici non spedisce" non è
    // la stessa cosa di "le email non funzionano".
    expect(emailSenderConfigured(yuko)).toBe(true);
    expect(emailSenderConfigured(kousushi)).toBe(false);
  });
});
