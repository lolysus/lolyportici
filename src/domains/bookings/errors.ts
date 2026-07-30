export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class SlotUnavailableError extends DomainError {
  constructor(details: Record<string, unknown> = {}) { super("SLOT_NO_LONGER_AVAILABLE", "Lo slot selezionato non è più disponibile.", 409, details); }
}
export class HoldExpiredError extends DomainError {
  constructor() { super("HOLD_EXPIRED", "La disponibilità temporanea è scaduta. Seleziona un nuovo orario.", 409); }
}
export class CapacityExceededError extends DomainError {
  constructor() { super("CAPACITY_EXCEEDED", "La capienza del servizio è stata raggiunta.", 409); }
}
export class TableConflictError extends DomainError {
  constructor() { super("TABLE_CONFLICT", "Il tavolo è già impegnato in questa fascia.", 409); }
}
export class ReservationNotFoundError extends DomainError {
  constructor() { super("RESERVATION_NOT_FOUND", "Prenotazione non trovata.", 404); }
}
export class ReservationModificationNotAllowedError extends DomainError {
  constructor() { super("MODIFICATION_NOT_ALLOWED", "Questa prenotazione non può più essere modificata online.", 409); }
}
export class InvalidReservationStateError extends DomainError {
  constructor(from: string, to: string) { super("INVALID_RESERVATION_STATE", `Transizione non consentita da ${from} a ${to}.`, 409); }
}
export class ReservationCancellationNotAllowedError extends DomainError {
  constructor() { super("CANCELLATION_NOT_ALLOWED", "Questa prenotazione non puÃ² piÃ¹ essere cancellata online.", 409); }
}
export class InvalidWaitlistStateError extends DomainError {
  constructor(from: string, to: string) { super("INVALID_WAITLIST_STATE", `Transizione richiesta non consentita da ${from} a ${to}.`, 409); }
}
export class TableNotFoundError extends DomainError {
  constructor() { super("TABLE_NOT_FOUND", "Tavolo non trovato.", 404); }
}
export class TableCodeAlreadyUsedError extends DomainError {
  constructor(code: string) { super("TABLE_CODE_IN_USE", `Esiste già un tavolo con il numero ${code}.`, 409); }
}
export class TableInUseError extends DomainError {
  constructor() { super("TABLE_IN_USE", "Il tavolo ha prenotazioni attive: spostale prima di eliminarlo.", 409); }
}
export class PermissionDeniedError extends DomainError {
  constructor() { super("PERMISSION_DENIED", "Non hai i permessi necessari.", 403); }
}
export class ProviderUnavailableError extends DomainError {
  constructor(provider: string) { super("PROVIDER_UNAVAILABLE", `${provider} non è configurato o non è disponibile.`, 503); }
}
export class WebhookVerificationError extends DomainError {
  constructor() { super("WEBHOOK_VERIFICATION_FAILED", "Firma webhook non valida.", 401); }
}

