import { findChosenTableAssignment, type AvailabilityContext, type TableAssignment } from "@/domains/availability/availability-service";
import { TableNoLongerAvailableError } from "@/domains/bookings/errors";
import { listBookableTableOptions } from "@/domains/availability/availability-service";
import type { AvailabilityOption } from "@/types/api";
import type { CreateHoldInput } from "@/repositories/repository";

/**
 * Quali tavoli finiscono nella disponibilità temporanea.
 *
 * Due casi, e la differenza è tutta nel fallimento:
 *
 * - **Senza scelta del cliente** vale la sistemazione che `checkAvailability` ha
 *   già selezionato come migliore. È il caso del telefono, dell'agente vocale e
 *   dello staff, dove il tavolo non si mostra a nessuno.
 * - **Con la scelta del cliente** quella sistemazione va verificata di nuovo
 *   adesso, contro lo stato attuale. Se nel frattempo è stata presa, la
 *   prenotazione si ferma: assegnare un tavolo diverso da quello scelto senza
 *   dirlo è il modo più sicuro di far arrivare qualcuno convinto di sedersi
 *   fuori e ritrovarsi al banco.
 *
 * La verifica sta qui e non nel client perché il client può solo *chiedere*: fra
 * la sua richiesta e questa riga possono essere passate altre prenotazioni.
 */
export function resolveHoldAssignment(
  input: CreateHoldInput,
  context: AvailabilityContext,
  option: AvailabilityOption,
): TableAssignment {
  const fallback: TableAssignment = {
    tableIds: option.tableIds,
    combinationId: option.combinationId,
    diningAreaId: option.diningArea.id,
    diningAreaName: option.diningArea.name,
    score: 0,
    reason: "Assegnazione automatica",
  };
  if (!input.tableSelectionId) return fallback;

  const chosen = findChosenTableAssignment(input.tableSelectionId, input.availability, context, option.startAt, option.endAt);
  if (chosen) return chosen;

  // Le alternative viaggiano con l'errore: il cliente deve poter riscegliere
  // senza ricominciare dall'orario, che è ancora valido.
  throw new TableNoLongerAvailableError({
    tables: listBookableTableOptions(input.availability, context, option.startAt, option.endAt),
  });
}
