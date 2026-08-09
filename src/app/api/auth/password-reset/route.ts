import { z } from "zod";
import { getRestaurantLocationById, getRestaurantLocationBySlug } from "@/config/brand";
import { adminAccessKey, restaurantForAccessKey } from "@/config/admin-access";
import { buildPasswordResetEmail } from "@/domains/notifications/password-reset-email";
import { ResendEmailAdapter } from "@/integrations/email/resend/adapter";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { nativeUserByEmail } from "@/lib/auth/native";
import { accountsTableAvailable, consumeResetToken, createPasswordReset, findAccountByEmail, resetTokenIsUsable, upsertAccountPassword } from "@/lib/auth/staff-accounts";
import { getRequestUrl } from "@/lib/public-url";

/**
 * Recupero password dello staff.
 *
 * Vive fra le API e non fra le azioni server perché le pagine girano su
 * Vercel, che il database non ce l'ha: solo le `/api/*` arrivano al servizio
 * che lo possiede. Metterlo altrove avrebbe prodotto un modulo che accetta la
 * richiesta e non fa niente.
 */

const RESET_MINUTES = 60;

const requestSchema = z.object({
  email: z.email(),
  scope: z.string().trim().min(1),
  /**
   * La porta di servizio da cui arriva la richiesta.
   *
   * Serve perché il link nell'email deve puntare alla porta **vera**, e i
   * percorsi riservati vivono in `ADMIN_ACCESS_PATHS`, una variabile che sta su
   * Vercel — dove girano le pagine — e non necessariamente qui, dove gira
   * l'invio. Senza questo campo l'API costruiva il link con i percorsi di
   * ripiego del codice e spediva un indirizzo che dà 404: il recupero
   * sembrava funzionare e il link era inutilizzabile.
   *
   * Non è fiducia cieca nel client: la chiave viene verificata e deve indicare
   * lo stesso ristorante dell'account, altrimenti si ignora e si torna al
   * percorso calcolato qui.
   */
  accessKey: z.string().trim().min(3).max(64).optional(),
});
const applySchema = z.object({
  token: z.string().trim().min(20),
  scope: z.string().trim().min(1),
  // Lunga batte complicata: dieci caratteri di frase reggono più di otto di
  // simboli, e soprattutto vengono ricordati invece che riscritti su un post-it.
  password: z.string().min(10).max(200),
});

/** Dice se un link è ancora spendibile, senza consumarlo. */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) return success({ usable: false });
    return success({ usable: await resetTokenIsUsable(token) });
  } catch (error) { return failure(error); }
}

/**
 * Chiede il link.
 *
 * La risposta è sempre la stessa, che l'indirizzo esista o no: dire "questa
 * email non è registrata" regalerebbe a chiunque l'elenco di chi lavora al
 * ristorante, un tentativo alla volta.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "password-reset-request", 5, 15 * 60_000, 60);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());

    await deliverResetLink(parsed.data.email, parsed.data.scope, parsed.data.accessKey).catch((error) => {
      // Un guasto dell'invio non deve diventare un modo per scoprire chi
      // esiste: resta nei log, l'utente vede la risposta di sempre.
      console.error("[password-reset] invio non riuscito", error);
    });
    return success({ requested: true });
  } catch (error) { return failure(error); }
}

/** Consuma il link e scrive la password nuova. */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "password-reset-apply", 10, 15 * 60_000, 100);
    const parsed = applySchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());

    const restaurant = getRestaurantLocationBySlug(parsed.data.scope);
    if (!restaurant) return success({ applied: false, reason: "invalid_scope" });

    const email = await consumeResetToken(parsed.data.token);
    if (!email) return success({ applied: false, reason: "token_unusable" });

    const owner = await ownerFor(email);
    if (!owner || owner.locationId !== restaurant.id) return success({ applied: false, reason: "account_missing" });

    await upsertAccountPassword({
      email: owner.email,
      name: owner.name,
      role: owner.role,
      locationId: owner.locationId,
      password: parsed.data.password,
    });
    return success({ applied: true });
  } catch (error) { return failure(error); }
}

/** L'account, prima dalla tabella e poi dalla variabile d'ambiente. */
async function ownerFor(email: string) {
  const account = await findAccountByEmail(email);
  if (account) return { email: account.email, name: account.name, role: account.role, locationId: account.locationId, recoveryEmail: account.recoveryEmail };
  const native = nativeUserByEmail(email);
  return native ? { ...native, recoveryEmail: undefined as string | undefined } : null;
}

async function deliverResetLink(email: string, slug: string, accessKey?: string) {
  if (!accountsTableAvailable()) return;
  const owner = await ownerFor(email);
  if (!owner) return;

  // Ogni porta apre un ristorante solo: chiedere il recupero dall'ingresso di
  // Ardea con un account di Portici non deve produrre nulla.
  const restaurant = getRestaurantLocationById(owner.locationId);
  if (!restaurant || restaurant.slug !== slug) return;

  // La porta dichiarata vale solo se apre questo stesso ristorante.
  const declared = accessKey && restaurantForAccessKey(accessKey)?.slug === restaurant.slug ? accessKey : null;
  const key = declared ?? adminAccessKey(restaurant);
  // Il link va al recapito del recupero se c'è, all'indirizzo dell'account
  // altrimenti. Il token resta legato all'account, non al recapito: cambiare
  // dove arriva la posta non cambia di chi è la password.
  const destinatario = owner.recoveryEmail?.trim() || owner.email;
  const { token } = await createPasswordReset(owner.email);
  const resetUrl = await getRequestUrl(`/gestione/${key}/reimposta?token=${encodeURIComponent(token)}`);
  await new ResendEmailAdapter().send(buildPasswordResetEmail({
    to: destinatario,
    accountEmail: owner.email,
    name: owner.name,
    restaurant,
    resetUrl,
    minutes: RESET_MINUTES,
  }));
}
