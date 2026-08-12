import "server-only";

import type { RestaurantLocation } from "@/config/brand";
import type { DayScheduleSettings } from "@/types/settings";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getGoogleMapsDirectionsUrl } from "@/lib/public-url";
import { buildPhoneHref, buildWhatsappHref } from "@/lib/contact";

/**
 * I dati del sito vetrina: recapiti, orari e testi d’accoglienza.
 *
 * Vengono dalle impostazioni della sede — modificabili dal pannello — con i
 * valori di `brand.ts` come rete di sicurezza. Così il sito resta allineato a
 * ciò che il ristoratore cambia, senza toccare il codice.
 */
export interface SiteData {
  phone: string;
  phoneHref: string;
  whatsapp: string;
  whatsappHref: string;
  directionsUrl: string;
  officialWebsite: string;
  instagramUrl: string;
  hasVatNumber: boolean;
  schedule: DayScheduleSettings[];
  guest: {
    arrivalMessage: string;
    highlight: string;
    directions: string;
    parkingInfo: string;
    accessibilityInfo: string;
    dietaryNotice: string;
  };
  seating: { indoor: number; outdoor: number };
}

export async function loadSiteData(location: RestaurantLocation): Promise<SiteData> {
  const settings = await getRestaurantSettings(location.id);
  const phone = settings.contact.phone || location.phone;
  return {
    phone,
    phoneHref: buildPhoneHref(settings.contact.phone) || location.phoneHref,
    whatsapp: settings.contact.whatsapp || location.whatsapp,
    whatsappHref: buildWhatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage, location.shortName) || location.whatsappHref,
    directionsUrl: getGoogleMapsDirectionsUrl(location.address),
    officialWebsite: settings.contact.officialWebsite || location.officialWebsite,
    instagramUrl: settings.contact.instagramUrl || location.instagramUrl,
    hasVatNumber: /^\d{11}$/.test(location.vatNumber.replace(/\s/g, "")),
    schedule: settings.schedule,
    guest: {
      arrivalMessage: settings.guestExperience.arrivalMessage,
      highlight: settings.guestExperience.highlight,
      directions: settings.guestExperience.directions,
      parkingInfo: settings.guestExperience.parkingInfo,
      accessibilityInfo: settings.guestExperience.accessibilityInfo,
      dietaryNotice: settings.guestExperience.dietaryNotice,
    },
    seating: {
      indoor: settings.contact.seatingIndoor || location.seating.indoor,
      outdoor: settings.contact.seatingOutdoor || location.seating.outdoor,
    },
  };
}

const DAY_LABELS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export interface OpeningRow { day: string; windows: string[] }

/**
 * Gli orari della settimana come li legge un cliente: una riga per giorno, con
 * pranzo e cena se attivi, "Chiuso" se il giorno non ha servizi.
 */
export function weeklyOpening(schedule: DayScheduleSettings[]): OpeningRow[] {
  // Da lunedì a domenica: l'ordine con cui la gente pensa alla settimana.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dow) => {
    const day = schedule.find((entry) => entry.dayOfWeek === dow);
    const windows: string[] = [];
    if (day?.lunch.enabled) windows.push(`${day.lunch.startTime}–${day.lunch.endTime}`);
    if (day?.dinner.enabled) windows.push(`${day.dinner.startTime}–${day.dinner.endTime}`);
    return { day: DAY_LABELS[dow], windows };
  });
}
