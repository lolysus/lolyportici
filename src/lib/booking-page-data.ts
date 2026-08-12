import "server-only";

import type { RestaurantLocation, SupportedLocale } from "@/config/brand";
import type { BookingFeatures } from "@/components/public-booking/booking-wizard";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getRepository } from "@/repositories";
import { dateKeyInZone, localDateTimeToUtc } from "@/lib/datetime";
import { buildServiceTimeSlots, dayOfWeekForDateKey } from "@/lib/service-calendar";
import { getGoogleMapsDirectionsUrl } from "@/lib/public-url";
import { buildPhoneHref, buildWhatsappHref } from "@/lib/contact";

/**
 * Tutto ciò che serve per disegnare la prenotazione, caricato una volta sola.
 *
 * Vive qui perché due pagine lo usano: la pagina di prenotazione storica
 * (`/it/book/[slug]`) e quella nuova sotto il sito (`/prenotazione`). Tenere il
 * calcolo — orari aperti, giorni prenotabili, chiusure, recapiti — in un posto
 * solo evita che le due divergano quando le regole cambiano.
 */
export interface BookingPageData {
  dictionary: Dictionary;
  features: BookingFeatures;
  bookingStatus: { label: string; dot: string; message: string };
  directionsUrl: string;
  contactPhone: string;
  contactPhoneHref: string;
  contactWhatsappHref: string;
  officialWebsite: string;
  instagramUrl: string;
  hasPhone: boolean;
  hasVatNumber: boolean;
  highlight: string;
  arrivalMessage: string;
  guestExperience: {
    directions: string;
    parkingInfo: string;
    accessibilityInfo: string;
    dietaryNotice: string;
  };
}

export async function loadBookingPageData(location: RestaurantLocation, locale: SupportedLocale): Promise<BookingPageData> {
  const [dictionary, settings, availabilityContext] = await Promise.all([
    getDictionary(locale),
    getRestaurantSettings(location.id),
    getRepository(location.id).getAvailabilityContext(),
  ]);

  const bookingStatus = settings.operations.serviceMode === "live"
    ? { label: "Live", dot: "bg-emerald-400", message: "Disponibilità sincronizzata in tempo reale" }
    : settings.operations.serviceMode === "approval"
      ? { label: "Su richiesta", dot: "bg-amber-300", message: "Richieste verificate personalmente dallo staff" }
      : { label: "In pausa", dot: "bg-rose-300", message: "Prenotazioni assistite telefonicamente" };

  const now = availabilityContext.now ?? new Date();
  const firstDate = dateKeyInZone(now, availabilityContext.timezone);
  const enabledWeekdays = availabilityContext.locationAvailable === false
    ? []
    : [...new Set(availabilityContext.servicePeriods.filter((service) => service.isActive && service.onlineBookingEnabled).map((service) => service.dayOfWeek))];
  const closedDates = availabilityContext.closures
    .filter((closure) => closure.type !== "opening" && !closure.affectedAreaId && !closure.affectedTableId && !closure.startTime && !closure.endTime)
    .map((closure) => closure.date);
  const onlineServicesToday = availabilityContext.servicePeriods.filter((service) => service.isActive && service.onlineBookingEnabled && service.dayOfWeek === dayOfWeekForDateKey(firstDate));
  const hasTimeAfterNotice = onlineServicesToday.some((service) => {
    const lastStart = localDateTimeToUtc(firstDate, service.endTime, availabilityContext.timezone).getTime() - settings.durations.party1To2 * 60_000;
    return buildServiceTimeSlots(service).some((time) => {
      const start = localDateTimeToUtc(firstDate, time, availabilityContext.timezone).getTime();
      return start >= now.getTime() + settings.policies.minimumNoticeMinutes * 60_000 && start <= lastStart;
    });
  });
  // Oggi non ha più orari utili dopo il preavviso: il calendario non deve
  // proporlo come prenotabile, o il cliente sceglie un giorno vuoto.
  if (onlineServicesToday.length > 0 && !hasTimeAfterNotice) closedDates.push(firstDate);

  const features: BookingFeatures = {
    onlineBookingEnabled: settings.operations.serviceMode !== "paused" && settings.service.onlineBookingEnabled && availabilityContext.locationAvailable !== false,
    waitlistEnabled: settings.features.waitlistEnabled,
    minimumPartySize: settings.rules.minimumPartySize,
    maximumPartySize: settings.rules.maximumPartySize,
    requiresManualApproval: settings.rules.requiresManualApproval || settings.operations.serviceMode === "approval",
    requiresDeposit: settings.rules.requiresDeposit,
    depositAmount: settings.rules.depositAmount,
    minimumNoticeMinutes: settings.policies.minimumNoticeMinutes,
    punctualityNotice: settings.guestExperience.punctualityNotice,
    calendarRules: { firstDate, maximumAdvanceDays: settings.policies.maximumAdvanceDays, enabledWeekdays, closedDates: [...new Set(closedDates)] },
  };

  const contactPhone = settings.contact.phone || location.phone;
  const contactPhoneHref = buildPhoneHref(settings.contact.phone) || location.phoneHref;
  const contactWhatsappHref = buildWhatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage, location.shortName) || location.whatsappHref;

  return {
    dictionary,
    features,
    bookingStatus,
    directionsUrl: getGoogleMapsDirectionsUrl(location.address),
    contactPhone,
    contactPhoneHref,
    contactWhatsappHref,
    officialWebsite: settings.contact.officialWebsite || location.officialWebsite,
    instagramUrl: settings.contact.instagramUrl || location.instagramUrl,
    hasPhone: Boolean(contactPhoneHref),
    hasVatNumber: /^\d{11}$/.test(location.vatNumber.replace(/\s/g, "")),
    highlight: settings.guestExperience.highlight.trim(),
    arrivalMessage: settings.guestExperience.arrivalMessage,
    guestExperience: {
      directions: settings.guestExperience.directions,
      parkingInfo: settings.guestExperience.parkingInfo,
      accessibilityInfo: settings.guestExperience.accessibilityInfo,
      dietaryNotice: settings.guestExperience.dietaryNotice,
    },
  };
}
