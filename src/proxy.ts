import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { restaurantConfig, restaurantLocations } from "@/config/brand";
import { foreignRestaurantSlugs, restaurantForHost } from "@/config/domains";
import { adminLocationCookie, adminLocationCookieOptions, adminRestaurantHeader } from "@/lib/admin/location-cookie";

/**
 * Su un dominio dedicato esiste un ristorante solo.
 *
 * YUKO e KouSushi sono due attività separate: chi arriva su yuko.it deve
 * vedere YUKO e basta. La pagina di scelta fra i due e le pagine dell'altro
 * ristorante non devono essere raggiungibili, altrimenti un cliente che cerca
 * un locale finisce a prenotare nell'altro.
 *
 * Senza NEXT_PUBLIC_RESTAURANT_DOMAINS configurato la parte pubblica di questo
 * file non fa nulla e l'applicazione continua a servire entrambi sotto lo
 * stesso host. La separazione dell'area riservata, invece, vale sempre.
 */

const LOCALE = String.raw`(?:it|en|es)`;
const RESTAURANT_SLUGS = restaurantLocations.map((restaurant) => restaurant.slug).join("|");
const ADMIN_SCOPE = new RegExp(String.raw`^/admin/(${RESTAURANT_SLUGS})(/.*)?$`);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const restaurant = restaurantForHost(request.headers.get("host"));

  // ── Area riservata: un ramo di indirizzi per ristorante ──────────────────
  //
  // Le sezioni operative sono le stesse, ma ognuna vive sotto il nome della
  // propria sede: /admin/yuko/reservations e /admin/kousushi/reservations sono
  // due pannelli distinti, e chi ha il primo nei preferiti non finisce mai
  // nell'altro. Sotto il prefisso riscriviamo alla sezione condivisa dicendo
  // alle pagine, con un'intestazione, di quale sede si tratta — il cookie
  // arriverebbe una richiesta troppo tardi.
  const adminScope = ADMIN_SCOPE.exec(pathname);
  if (adminScope) {
    const [, slug, section] = adminScope;

    // Su un dominio dedicato il pannello dell'altra sede non esiste, come non
    // esistono le sue pagine pubbliche.
    if (restaurant && restaurant.slug !== slug) return NextResponse.rewrite(new URL("/ristorante-non-disponibile", request.url));

    if (!section || section === "/") return NextResponse.redirect(new URL(`/admin/${slug}/dashboard${search}`, request.url));

    const headers = new Headers(request.headers);
    headers.set(adminRestaurantHeader, slug);
    const response = NextResponse.rewrite(new URL(`/admin${section}${search}`, request.url), { request: { headers } });
    // Il cookie serve alle chiamate API che partono da queste pagine: quelle
    // non passano dal prefisso e la sede la leggono da lì.
    response.cookies.set(adminLocationCookie, slug, adminLocationCookieOptions);
    return response;
  }

  // Nessuna intestazione di sede deve poter arrivare dall'esterno: chi la
  // mettesse a mano si sceglierebbe il ristorante da solo.
  if (request.headers.has(adminRestaurantHeader)) {
    const headers = new Headers(request.headers);
    headers.delete(adminRestaurantHeader);
    return NextResponse.next({ request: { headers } });
  }

  // ── Parte pubblica: solo sui domini dedicati ─────────────────────────────
  if (!restaurant) return NextResponse.next();

  const ownBooking = `/${restaurantConfig.defaultLocale}/book/${restaurant.slug}`;

  // La radice del dominio è la pagina del ristorante, non la scelta fra i due.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(`${ownBooking}${search}`, request.url));
  }

  // La pagina di scelta non ha senso qui: c'è un ristorante solo.
  const chooser = new RegExp(String.raw`^/${LOCALE}/book/?$`);
  if (chooser.test(pathname)) {
    const locale = pathname.split("/")[1];
    return NextResponse.redirect(new URL(`/${locale}/book/${restaurant.slug}${search}`, request.url));
  }

  // Le pagine dell'altro ristorante non esistono su questo dominio.
  const foreign = foreignRestaurantSlugs(restaurant);
  const foreignBooking = new RegExp(String.raw`^/${LOCALE}/book/(${foreign.join("|")})(?:/|$)`);
  if (foreign.length > 0 && foreignBooking.test(pathname)) {
    // Riscrittura verso un percorso inesistente: Next serve la propria pagina
    // "non trovato" con stato 404, che è la risposta corretta — su questo
    // dominio quella pagina davvero non esiste.
    return NextResponse.rewrite(new URL("/ristorante-non-disponibile", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Fuori dal perimetro: API (servite da Railway), asset statici e file di
  // Next.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brands|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
