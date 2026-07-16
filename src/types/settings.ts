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

export type RestaurantSettings = {
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
    arrivalMessage: string;
    directions: string;
    parkingInfo: string;
    accessibilityInfo: string;
    dietaryNotice: string;
  };
  voiceAI: {
    assistantName: string;
    greeting: string;
    defaultLanguage: "it" | "en" | "es";
    allowNewReservations: boolean;
    allowModifyReservations: boolean;
    allowCancellation: boolean;
    allowWaitlist: boolean;
    transferOnAllergies: boolean;
    transferPartySize: number;
  };
};
