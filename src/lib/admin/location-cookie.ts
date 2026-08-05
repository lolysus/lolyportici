/**
 * Nome e opzioni del cookie che ricorda quale ristorante si sta guardando.
 *
 * Vivono qui, fuori da `location.ts`, perché quel file è `server-only` e il
 * proxy — che il cookie lo scrive — non può importarlo.
 */
export const adminLocationCookie = "sushi_admin_location";

export const adminLocationCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Intestazione con cui il proxy dice alle pagine quale sede c'è nell'indirizzo.
 *
 * Il cookie da solo non basterebbe: viene scritto sulla risposta, quindi la
 * pagina che stiamo servendo in questo momento leggerebbe ancora il valore
 * precedente e mostrerebbe l'altro ristorante per una richiesta.
 */
export const adminRestaurantHeader = "x-admin-restaurant";
