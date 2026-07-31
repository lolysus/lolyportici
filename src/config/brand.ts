export interface ManagedRestaurant {
  id: string;
  restaurantId: string;
  name: string;
  shortName: string;
  legalName: string;
  vatNumber: string;
  website: string;
  /** Sito ufficiale del ristorante, distinto dal link di prenotazione. */
  officialWebsite: string;
  /** Profilo Instagram pubblico, vuoto se non gestito. */
  instagramUrl: string;
  bookingInfoUrl: string;
  privacyUrl: string;
  logoPath: string;
  accentColor: string;
  reservationCodePrefix: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  phoneHref: string;
  email: string;
  timezone: string;
  capacity: number;
  tables: number;
  serviceNote: string;
  theme: {
    primary: string;
    primaryForeground: string;
    surface: string;
    glow: string;
  };
}

// Compatibility alias: the operational engine remains location-scoped, while
// each configured location below belongs to its own restaurant entity.
export type RestaurantLocation = ManagedRestaurant;

const publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const brandConfig = {
  companyName: "YUKO × KouSushi",
  platformName: "Regia Sushi",
  logoPath: "/brands/regia-sushi-mark.svg",
  website: publicAppUrl,
  bookingInfoUrl: `${publicAppUrl}/it/book`,
  privacyUrl: `${publicAppUrl}/it/privacy`,
  email: "",
  phone: "Contatti in aggiornamento",
  phoneHref: "",
  address: "Ardea RM · Portici NA",
  legalName: "Regia prenotazioni YUKO × KouSushi",
  vatNumber: "In aggiornamento",
  primaryColor: "#CDA44C",
  secondaryColor: "#F6F1E6",
  accentColor: "#E60012",
  supportEmail: "",
  supportPhone: "",
} as const;

export const restaurantLocations = [
  {
    id: "00000000-0000-0000-0000-000000000003",
    restaurantId: "00000000-0000-0000-0000-000000000002",
    name: "YUKO Sushi & Fusion",
    shortName: "YUKO",
    legalName: "YUKO Sushi & Fusion",
    // ATTENZIONE: la partita IVA comunicata per YUKO è identica a quella di
    // KouSushi. Due attività distinte non possono condividerla e il dato
    // compare nel footer pubblico: va confermato dal titolare prima del
    // go-live. Finché non è confermato resta fuori.
    vatNumber: "In aggiornamento",
    website: `${publicAppUrl}/it/book/yuko`,
    officialWebsite: "",
    instagramUrl: "",
    bookingInfoUrl: `${publicAppUrl}/it/book/yuko`,
    privacyUrl: `${publicAppUrl}/it/privacy`,
    logoPath: "/brands/yuko-logo.svg",
    accentColor: "#D5AF55",
    reservationCodePrefix: "YK",
    slug: "yuko",
    address: "Via Severiana 60, 00040 Ardea RM, Italia",
    city: "Ardea · RM",
    phone: "Contatti in aggiornamento",
    phoneHref: "",
    email: "",
    timezone: "Europe/Rome",
    capacity: 62,
    tables: 15,
    serviceNote: "Sushi & Fusion · prenotazioni online",
    theme: {
      primary: "#D5AF55",
      primaryForeground: "#15110A",
      surface: "#0F0E0B",
      glow: "rgba(213, 175, 85, 0.24)",
    },
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    restaurantId: "00000000-0000-0000-0000-000000000005",
    name: "KouSushi",
    shortName: "KouSushi",
    legalName: "KouSushi",
    vatNumber: "09944081216",
    website: `${publicAppUrl}/it/book/kousushi`,
    officialWebsite: "https://kousushiportici.com",
    instagramUrl: "https://www.instagram.com/kousushiportici/",
    bookingInfoUrl: `${publicAppUrl}/it/book/kousushi`,
    privacyUrl: `${publicAppUrl}/it/privacy`,
    logoPath: "/brands/kousushi-logo.svg",
    accentColor: "#E60012",
    reservationCodePrefix: "KS",
    slug: "kousushi",
    address: "Corso Giuseppe Garibaldi, 130, 80055 Portici NA, Italia",
    city: "Portici · NA",
    phone: "+39 081 271258",
    phoneHref: "tel:+39081271258",
    email: "",
    timezone: "Europe/Rome",
    capacity: 48,
    tables: 12,
    serviceNote: "Sushi giapponese · prenotazioni online",
    theme: {
      primary: "#E60012",
      primaryForeground: "#FFFFFF",
      surface: "#151011",
      glow: "rgba(230, 0, 18, 0.22)",
    },
  },
] as const satisfies readonly ManagedRestaurant[];

export const managedRestaurants = restaurantLocations;
export const defaultRestaurantLocation = restaurantLocations[0];

export function getRestaurantLocationById(id: string) {
  return restaurantLocations.find((location) => location.id === id);
}

export function getRestaurantLocationBySlug(slug: string) {
  return restaurantLocations.find((location) => location.slug === slug);
}

export function getManagedRestaurantById(restaurantId: string) {
  return managedRestaurants.find((restaurant) => restaurant.restaurantId === restaurantId);
}

export const restaurantConfig = {
  organizationId: "00000000-0000-0000-0000-000000000001",
  id: defaultRestaurantLocation.restaurantId,
  locationId: defaultRestaurantLocation.id,
  name: defaultRestaurantLocation.name,
  slug: defaultRestaurantLocation.slug,
  locationName: defaultRestaurantLocation.shortName,
  timezone: defaultRestaurantLocation.timezone,
  defaultLocale: "it",
  supportedLocales: ["it", "en", "es"] as const,
  currency: "EUR",
  holdMinutes: 5,
  phone: defaultRestaurantLocation.phone,
  email: defaultRestaurantLocation.email,
  address: defaultRestaurantLocation.address,
} as const;

export type SupportedLocale = (typeof restaurantConfig.supportedLocales)[number];
