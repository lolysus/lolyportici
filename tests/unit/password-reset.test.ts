import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, hashResetToken, passwordMatches } from "@/lib/auth/staff-accounts";
import { buildPasswordResetEmail } from "@/domains/notifications/password-reset-email";
import { restaurantLocations } from "@/config/brand";

const [yuko] = restaurantLocations;
const pepperOriginale = process.env.MANAGEMENT_TOKEN_PEPPER;

afterEach(() => {
  if (pepperOriginale === undefined) delete process.env.MANAGEMENT_TOKEN_PEPPER;
  else process.env.MANAGEMENT_TOKEN_PEPPER = pepperOriginale;
});

describe("password dello staff", () => {
  it("riconosce la password giusta e rifiuta quella sbagliata", () => {
    const conservata = hashPassword("una frase lunga che ricordo");
    expect(passwordMatches("una frase lunga che ricordo", conservata)).toBe(true);
    expect(passwordMatches("una frase lunga che ricordO", conservata)).toBe(false);
    expect(passwordMatches("", conservata)).toBe(false);
  });

  it("non conserva mai la password in chiaro", () => {
    const conservata = hashPassword("cavallo batteria graffetta");
    expect(conservata.passwordHash).not.toContain("cavallo");
    expect(conservata.passwordSalt).not.toContain("cavallo");
  });

  it("dà hash diversi alla stessa password di due persone", () => {
    // Salt casuale: senza, due colleghi con la stessa password avrebbero lo
    // stesso hash, e chi legge il database lo noterebbe.
    expect(hashPassword("stessa password").passwordHash).not.toBe(hashPassword("stessa password").passwordHash);
  });
});

describe("token di reimpostazione", () => {
  it("dà sempre la stessa impronta per lo stesso token", () => {
    process.env.MANAGEMENT_TOKEN_PEPPER = "pepe-di-prova-lungo-abbastanza-per-i-test";
    expect(hashResetToken("abc123")).toBe(hashResetToken("abc123"));
  });

  it("non contiene il token in chiaro", () => {
    process.env.MANAGEMENT_TOKEN_PEPPER = "pepe-di-prova-lungo-abbastanza-per-i-test";
    const token = "token-che-non-deve-comparire";
    expect(hashResetToken(token)).not.toContain(token);
  });

  it("cambia se cambia il pepe", () => {
    // Un database rubato senza il pepe non permette di ricostruire i link.
    process.env.MANAGEMENT_TOKEN_PEPPER = "primo-pepe-lungo-abbastanza-per-i-test";
    const conPrimo = hashResetToken("stesso-token");
    process.env.MANAGEMENT_TOKEN_PEPPER = "secondo-pepe-lungo-abbastanza-per-test";
    expect(hashResetToken("stesso-token")).not.toBe(conPrimo);
  });
});

describe("email di reimpostazione", () => {
  const email = buildPasswordResetEmail({
    to: "mario@esempio.test",
    name: "Mario Rossi",
    restaurant: yuko,
    resetUrl: "https://yukoardea.it/gestione/xyz/reimposta?token=abc",
    minutes: 60,
  });

  it("dice da quale ristorante arriva già nell'oggetto", () => {
    expect(email.subject).toContain(yuko.shortName);
  });

  it("mette il link sia nel pulsante sia per esteso", () => {
    // Molti client di posta disattivano i pulsanti: senza l'indirizzo scritto
    // l'utente resta bloccato senza capire perché.
    expect(email.text).toContain("https://yukoardea.it/gestione/xyz/reimposta?token=abc");
    expect(email.html.match(/https:\/\/yukoardea\.it\/gestione\/xyz\/reimposta\?token=abc/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("dice quanto dura e cosa fare se non l'ha chiesto nessuno", () => {
    expect(email.text).toContain("60 minuti");
    expect(email.text.toLowerCase()).toContain("se non hai chiesto");
    expect(email.html).toContain("60 minuti");
  });

  it("saluta per nome senza rovesciare il cognome nel messaggio", () => {
    expect(email.text.startsWith("Ciao Mario,")).toBe(true);
  });

  it("regge un nome vuoto senza produrre un saluto monco", () => {
    const senzaNome = buildPasswordResetEmail({ to: "x@y.test", name: "   ", restaurant: yuko, resetUrl: "https://esempio.test/r", minutes: 60 });
    expect(senzaNome.text.startsWith("Ciao,")).toBe(true);
  });

  it("neutralizza l'HTML che arriva dai dati", () => {
    const conIniezione = buildPasswordResetEmail({
      to: "x@y.test",
      name: '<script>alert(1)</script>',
      restaurant: yuko,
      resetUrl: "https://esempio.test/r",
      minutes: 60,
    });
    expect(conIniezione.html).not.toContain("<script>alert(1)</script>");
    expect(conIniezione.html).toContain("&lt;script&gt;");
  });
});
