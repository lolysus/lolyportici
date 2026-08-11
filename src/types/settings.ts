export type ServiceMode = "live" | "approval" | "paused";

export type ServiceWindowSettings = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type DayScheduleSettings = {
  dayOfWeek: number;
  lunch: ServiceWindowSettings;
  dinner: ServiceWindowSettings;
};

export type ContactSettings = {
  phone: string;
  whatsapp: string;
  /** Testo precompilato del messaggio WhatsApp. {ristorante} viene sostituito col nome. */
  whatsappMessage: string;
  officialWebsite: string;
  instagramUrl: string;
  /**
   * Posti a sedere dichiarati dal ristorante: sono l'informazione mostrata al
   * cliente e allo staff. Non sono lo stesso numero dei coperti per servizio
   * (quello scala in base alle prenotazioni), ma la loro somma è il tetto
   * pratico entro cui i coperti hanno senso.
   */
  seatingIndoor: number;
  seatingOutdoor: number;
};

export type RestaurantSettings = {
  contact: ContactSettings;
  operations: {
    serviceMode: ServiceMode;
    capacityWarningPercent: number;
    waitlistAlertCount: number;
    largePartyAlertSize: number;
  };
  service: {
    startTime: string;
    endTime: string;
    slotIntervalMinutes: number;
    turnaroundMinutes: number;
    maximumCovers: number;
    maximumArrivalsPerSlot: number;
    onlineBookingEnabled: boolean;
    phoneBookingEnabled: boolean;
  };
  schedule: DayScheduleSettings[];
  durations: {
    party1To2: number;
    party3To4: number;
    party5To6: number;
    party7To10: number;
  };
  rules: {
    minimumPartySize: number;
    maximumPartySize: number;
    requiresManualApproval: boolean;
    requiresDeposit: boolean;
    depositAmount: number;
  };
  policies: {
    minimumNoticeMinutes: number;
    maximumAdvanceDays: number;
    lateToleranceMinutes: number;
    noShowAfterMinutes: number;
    cancellationDeadlineHours: number;
  };
  features: {
    waitlistEnabled: boolean;
    customerModificationEnabled: boolean;
    customerCancellationEnabled: boolean;
    automaticNotificationsEnabled: boolean;
  };
  notifications: {
    emailConfirmationEnabled: boolean;
    smsConfirmationEnabled: boolean;
    staffAllergyAlertsEnabled: boolean;
    staffLargePartyAlertsEnabled: boolean;
    staffWaitlistAlertsEnabled: boolean;
  };
  guestExperience: {
    /**
     * Titolo e occhiello della pagina di prenotazione.
     *
     * Prima venivano dal dizionario di traduzione: stesso testo, identico su
     * Ardea e Portici, che nessuno poteva cambiare senza toccare il codice.
     * Vuoto = torna al testo di default della lingua.
     */
    heroEyebrow: string;
    heroTitle: string;
    arrivalMessage: string;
    /**
     * Cosa accade a chi arriva in ritardo, scritto dal ristorante.
     *
     * Va detto **prima** della conferma e ripetuto nella ricevuta: è l'unica
     * condizione della prenotazione che può far perdere il tavolo, e scoprirla
     * sulla porta è il modo più rapido di litigare con un cliente. Ogni sede ha
     * la sua tolleranza, quindi ha il suo testo.
     */
    punctualityNotice: string;
    /**
     * Il vantaggio che il locale vuole far vedere per primo, in cima alla
     * pagina di prenotazione. Vuoto = nessun riquadro in evidenza.
     */
    highlight: string;
    directions: string;
    parkingInfo: string;
    accessibilityInfo: string;
    dietaryNotice: string;
  };
};
