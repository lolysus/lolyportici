import { describe, expect, it } from "vitest";
import { restaurantLocations } from "@/config/brand";
import { buildPasswordResetEmail } from "@/domains/notifications/password-reset-email";

const [yuko, kousushi] = restaurantLocations;
const CASELLA_INTERNA = "suhsiportici@outlook.it";

function email(overrides: { to: string; accountEmail?: string; restaurant?: typeof yuko }) {
  return buildPasswordResetEmail({
    to: overrides.to,
    accountEmail: overrides.accountEmail,
    name: "Operatore",
    restaurant: overrides.restaurant ?? yuko,
    resetUrl: "https://yukoardea.it/gestione/xxx/reimposta?token=abc",
    minutes: 60,
  });
}

describe("recapito del link di recupero", () => {
  it("dice di quale account è il link, quando arriva su una casella condivisa", () => {
    // Due sedi che scaricano su una sola casella interna: senza questo, due
    // messaggi quasi identici e nessuno sa quale password sta reimpostando.
    const messaggio = email({ to: CASELLA_INTERNA, accountEmail: "suhsiroma@outlook.it" });
    expect(messaggio.subject).toContain("suhsiroma@outlook.it");
    expect(messaggio.text).toContain("Account interessato: suhsiroma@outlook.it");
    expect(messaggio.html).toContain("suhsiroma@outlook.it");
  });

  it("distingue le due sedi nello stesso oggetto", () => {
    const ardea = email({ to: CASELLA_INTERNA, accountEmail: "suhsiroma@outlook.it", restaurant: yuko });
    const portici = email({ to: CASELLA_INTERNA, accountEmail: "suhsiportici@outlook.it", restaurant: kousushi });
    expect(ardea.subject).toContain(yuko.shortName);
    expect(portici.subject).toContain(kousushi.shortName);
    expect(ardea.subject).not.toBe(portici.subject);
  });

  it("non aggiunge rumore quando il recapito è l'account stesso", () => {
    // Il caso normale, quando il dominio sarà verificato: nessuna etichetta.
    const messaggio = email({ to: "suhsiroma@outlook.it", accountEmail: "suhsiroma@outlook.it" });
    expect(messaggio.subject).toBe(`Reimposta la password · ${yuko.shortName}`);
    expect(messaggio.text).not.toContain("Account interessato");
  });

  it("ignora la differenza di maiuscole fra recapito e account", () => {
    const messaggio = email({ to: "SuhsiRoma@Outlook.IT", accountEmail: "suhsiroma@outlook.it" });
    expect(messaggio.text).not.toContain("Account interessato");
  });

  it("resta valido senza account dichiarato", () => {
    const messaggio = email({ to: CASELLA_INTERNA });
    expect(messaggio.subject).toBe(`Reimposta la password · ${yuko.shortName}`);
    expect(messaggio.html).toContain("Scegli una nuova password");
  });
});
