import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("the public entry point lets the guest choose a restaurant", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/it\/book$/);
  await expect(page.getByRole("heading", { name: "Due identità. Un tavolo scelto con cura." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "YUKO Sushi & Fusion" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "KouSushi" })).toBeVisible();
  await page.getByRole("link", { name: "Prenota in questo ristorante" }).nth(1).click();
  await expect(page).toHaveURL(/\/it\/book\/kousushi$/);
});

test("the restaurant booking page exposes Google-ready metadata and mobile actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/it/book/yuko");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/it\/book\/yuko$/);
  await expect.poll(() => page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"Restaurant"');
  await expect(page.getByRole("link", { name: "Prenota ora" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Apri YUKO Sushi & Fusion in Google Maps/ })).toBeVisible();
});

test("an ospite can verify an existing reservation without exposing the management token", async ({ page }) => {
  await page.goto("/account");
  await page.getByLabel("Codice prenotazione").fill("YK-2401");
  await page.getByLabel("Numero di telefono").fill("+390000000001");
  await page.getByRole("button", { name: "Apri la mia prenotazione" }).click();

  await expect(page.getByRole("heading", { name: "Ciao, Giulia." })).toBeVisible();
  await expect(page.getByText("YK-2401", { exact: true })).toBeVisible();
  await expect(page.getByText(/link sicuro contenuto nell'email/i)).toBeVisible();
});

test("an ospite completes a booking and opens the management page", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/it/book/yuko");
  await expect(page.getByRole("heading", { name: "Una tavola, il tempo giusto." })).toBeVisible();

  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Quando vuoi venire?" })).toBeVisible();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Scegli l'orario" })).toBeVisible();

  const slot = page.locator("button").filter({ has: page.locator("span.font-mono") }).first();
  await expect(slot).toBeVisible();
  await slot.click();

  await page.getByLabel("Nome *", { exact: true }).fill("Laura");
  await page.getByLabel("Cognome *", { exact: true }).fill("Collaudo");
  await page.getByLabel("Telefono *", { exact: true }).fill("+393330001234");
  await page.getByLabel("Accetto l'informativa privacy per la gestione della prenotazione. *").check();
  await page.getByRole("button", { name: "Continua" }).click();

  await expect(page.getByRole("heading", { name: "Controlla la prenotazione" })).toBeVisible();
  await page.getByRole("button", { name: "Conferma prenotazione" }).click();
  await expect(page.getByRole("heading", { name: "Il tuo tavolo è confermato." })).toBeVisible();

  await page.getByRole("link", { name: "Gestisci prenotazione" }).click();
  await expect(page).toHaveURL(/\/it\/booking\/manage\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Gestisci prenotazione" })).toBeVisible({ timeout: 30_000 });
  expect(pageErrors).toEqual([]);
});

test("the admin dashboard remains usable on a mobile viewport", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/dashboard");

  await expect(page.getByRole("heading", { name: /Buonasera/i })).toBeVisible();
  await page.getByRole("button", { name: "Apri menu" }).click();
  await expect(page.getByRole("link", { name: "Prenotazioni" })).toBeVisible();
  await page.getByRole("link", { name: "Prenotazioni" }).click();
  await expect(page.getByRole("heading", { name: "Agenda prenotazioni" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("the central administrator sees the master rules for both restaurant brands", async ({ page }) => {
  await page.goto("/admin/master");
  await expect(page.getByRole("heading", { name: "Regole comuni, identità indipendenti" })).toBeVisible();
  await expect(page.getByText("Policy master")).toBeVisible();
  await expect(page.getByRole("button", { name: "Applica a entrambi" })).toBeVisible();
});

test("a manager saves operational settings, knowledge and a staff invitation", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/admin/reservations");
  await page.getByRole("button", { name: /Apri dettaglio di/ }).first().click();
  await page.getByLabel("Note per il servizio").fill("Nota verificata dal collaudo end-to-end.");
  await page.getByRole("button", { name: "Salva note" }).click();
  await expect(page.getByRole("button", { name: "Note salvate" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/admin/settings");
  await page.getByLabel("Capienza simultanea").fill("70");
  await page.getByRole("button", { name: "Salva e applica" }).click();
  await expect(page.getByRole("button", { name: "Configurazione applicata" })).toBeVisible();

  await page.goto("/admin/knowledge-base");
  await page.getByRole("button", { name: "Nuovo contenuto" }).click();
  await expect(page.getByLabel("Categoria")).toHaveValue("Nuova");
  await page.getByLabel("Categoria").fill("Accoglienza");
  await page.getByLabel("Domanda").fill("Posso arrivare in anticipo?");
  await page.getByLabel("Risposta verificata").fill("Contatta il ristorante prima del servizio.");
  await page.getByRole("switch").nth(1).click();
  await page.getByRole("button", { name: "Salva contenuto" }).click();
  await expect(page.getByRole("button", { name: "Salvato" })).toBeVisible();

  await page.goto("/admin/staff");
  await page.getByRole("button", { name: "Invita persona" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Giulia");
  await page.getByLabel("Cognome").fill("Collaudo");
  await page.getByLabel("Email").fill("giulia.collaudo@example.test");
  await page.getByRole("button", { name: "Invia invito" }).click();
  await expect(page.getByRole("status")).toContainText("Invito simulato");
  expect(pageErrors).toEqual([]);
});
