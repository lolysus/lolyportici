import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { restaurantConfig } from "@/config/brand";
import { foreignRestaurantSlugs, restaurantForHost } from "@/config/domains";

/**
 * Su un dominio dedicato esiste un ristorante solo.
 *
 * YUKO e KouSushi sono due attività separate: chi arriva su yuko.it deve
 * vedere YUKO e basta. La pagina di scelta fra i due e le pagine dell'altro
 * ristorante non devono essere raggiungibili, altrimenti un cliente che cerca
 * un locale finisce a prenotare nell'altro.
 *
 * Senza NEXT_PUBLIC_RESTAURANT_DOMAINS configurato questo file non fa nulla e
 * l'applicazione continua a servire entrambi sotto lo stesso host.
 */

const LOCALE = String.raw`(?:it|en|es)`;

export function proxy(request: NextRequest) {
  const restaurant = restaurantForHost(request.headers.get("host"));
  if (!restaurant) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
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
  // Next. Il proxy tocca solo le pagine pubbliche.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brands|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
