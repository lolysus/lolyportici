import "server-only";

import { randomUUID } from "node:crypto";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { checkAvailability } from "@/domains/availability/availability-service";
import { assertCustomerCanCancelReservation, assertCustomerCanModifyReservation } from "@/domains/bookings/customer-reservation-policy";
import { HoldExpiredError, ReservationNotFoundError, SlotUnavailableError, TableCodeAlreadyUsedError, TableConflictError, TableInUseError, TableNotFoundError } from "@/domains/bookings/errors";
import { assertWaitlistTransition } from "@/domains/bookings/waitlist-state-machine";
import { formatTimeInZone } from "@/lib/datetime";
import { getPostgres } from "@/lib/postgres";
import { hashManagementToken, managementTokenForIdempotency } from "@/lib/security";
import type { ClosureInput, ConfirmedReservation, ConfirmHoldInput, CreateHoldInput, PublicReservation, ReservationRepository, TableChanges, TableInput, VoiceEscalationInput } from "@/repositories/repository";
import type { Customer, Reservation, ReservationEvent, ReservationHold, ServicePeriod, SpecialClosure, TableCombination, TableResource, VoiceCall, WaitlistEntry } from "@/types/domain";

type Row = Record<string, unknown>;
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value: unknown, fallback = 0) => typeof value === "number" ? value : Number(value ?? fallback);
const bool = (value: unknown) => value === true;
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

function tableResource(row: Row): TableResource {
  return {
    id: text(row.id), code: text(row.code), displayName: text(row.display_name), diningAreaId: text(row.dining_area_id),
    diningAreaName: text(row.dining_area_name, "Sala"), minimumCapacity: number(row.minimum_capacity), maximumCapacity: number(row.maximum_capacity),
    shape: text(row.shape) as TableResource["shape"], positionX: number(row.position_x), positionY: number(row.position_y),
    width: number(row.width, 80), height: number(row.height, 80), isAccessible: bool(row.is_accessible), isOutdoor: bool(row.is_outdoor),
    isStrategic: bool(row.is_strategic), status: text(row.status, "available") as TableResource["status"],
  };
}

function customer(row: Row): Customer {
  return {
    id: text(row.customer_id ?? row.id),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    phone: text(row.phone),
    email: text(row.email) || undefined,
    preferredLanguage: text(row.preferred_language, "it"),
    marketingConsent: bool(row.marketing_consent),
    privacyConsent: bool(row.privacy_consent),
    customerType: text(row.customer_type, "new") as Customer["customerType"],
    totalBookings: number(row.total_bookings),
    noShowCount: number(row.no_show_count),
    lastVisitAt: text(row.last_visit_at) || undefined,
    allergies: text(row.allergies) || undefined,
    accessibilityNeeds: text(row.accessibility_needs) || undefined,
  };
}

function reservation(row: Row): Reservation {
  return {
    id: text(row.id),
    organizationId: text(row.organization_id),
    restaurantId: text(row.restaurant_id),
    locationId: text(row.location_id),
    customerId: text(row.customer_id),
    servicePeriodId: text(row.service_period_id),
    reservationCode: text(row.reservation_code),
    managementTokenHash: text(row.management_token_hash),
    source: text(row.source) as Reservation["source"],
    status: text(row.status) as Reservation["status"],
    partySize: number(row.party_size),
    reservationDate: text(row.reservation_date),
    startAt: iso(row.start_at),
    endAt: iso(row.end_at),
    durationMinutes: number(row.duration_minutes),
    diningAreaId: text(row.dining_area_preference_id) || undefined,
    tableIds: Array.isArray(row.table_ids) ? row.table_ids.map(String) : [],
    combinationId: text(row.assigned_combination_id) || undefined,
    customer: customer(row),
    customerNotes: text(row.customer_notes) || undefined,
    internalNotes: text(row.internal_notes) || undefined,
    specialOccasion: text(row.special_occasion) || undefined,
    language: text(row.language, "it"),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function publicReservation(row: Row): PublicReservation {
  const mapped = reservation(row);
  const { managementTokenHash: _token, internalNotes: _notes, ...safe } = mapped;
  void _token; void _notes;
  return safe;
}

const reservationSelect = `
  select r.*, c.first_name, c.last_name, c.phone, c.email,
    c.preferred_language, c.marketing_consent, c.privacy_consent,
    c.customer_type, c.total_bookings, c.no_show_count, c.last_visit_at,
    c.allergies, c.accessibility_needs,
    coalesce(array_agg(a.table_id) filter (where a.table_id is not null), '{}') as table_ids
  from public.reservations r
  join public.customers c on c.id = r.customer_id
  left join public.reservation_table_assignments a on a.reservation_id = r.id and a.is_active
`;

export class PostgresReservationRepository implements ReservationRepository {
  constructor(private readonly locationId: string = restaurantConfig.locationId) {}

  private async reservationRows(where: string, parameters: unknown[] = [], orderBy = "") {
    const sql = getPostgres();
    return await sql.unsafe<Row[]>(
      `${reservationSelect} where r.location_id = $1 and r.deleted_at is null ${where}
       group by r.id, c.id ${orderBy}`,
      [this.locationId, ...parameters] as never[],
    );
  }

  /**
   * Il ristoratore ragiona per "dentro o fuori", non per sale. Le due aree
   * canoniche vengono create al primo tavolo che ne ha bisogno, così la lista
   * resta un modulo da sei campi invece di richiedere prima una tassonomia.
   */
  private async diningAreaFor(isOutdoor: boolean) {
    const sql = getPostgres();
    // Ogni sede ha già le proprie sale, con nomi suoi: "Terrazza" da una parte,
    // "Terrazza porto" dall'altra. Un tavolo nuovo deve entrare in quella che
    // esiste, non far nascere un doppione chiamato "Esterno".
    const inUso = await sql<Row[]>`
      select a.id from public.dining_areas a
      join public.restaurant_tables t on t.dining_area_id=a.id and t.is_active
      where a.location_id=${this.locationId} and a.is_active and t.is_outdoor=${isOutdoor}
      group by a.id order by count(t.id) desc limit 1`;
    if (inUso[0]) return text(inUso[0].id);

    const name = isOutdoor ? "Esterno" : "Sala interna";
    const existing = await sql<Row[]>`select id from public.dining_areas where location_id=${this.locationId} and name=${name} limit 1`;
    if (existing[0]) return text(existing[0].id);
    const created = await sql<Row[]>`
      insert into public.dining_areas (location_id,name,position,is_active)
      values (${this.locationId},${name},${isOutdoor ? 1 : 0},true)
      on conflict (location_id,name) do update set is_active=true
      returning id`;
    return text(created[0].id);
  }

  private async tableById(id: string) {
    const sql = getPostgres();
    const rows = await sql<Row[]>`
      select t.*,a.name as dining_area_name from public.restaurant_tables t
      join public.dining_areas a on a.id=t.dining_area_id
      where t.id=${id} and t.location_id=${this.locationId} and t.is_active`;
    if (!rows[0]) throw new TableNotFoundError();
    return tableResource(rows[0]);
  }

  async listTables(): Promise<TableResource[]> {
    const sql = getPostgres();
    const rows = await sql<Row[]>`
      select t.*,a.name as dining_area_name from public.restaurant_tables t
      join public.dining_areas a on a.id=t.dining_area_id
      where t.location_id=${this.locationId} and t.is_active
      order by t.is_outdoor, t.code`;
    return rows.map(tableResource);
  }

  async createTable(input: TableInput): Promise<TableResource> {
    const sql = getPostgres();
    const duplicate = await sql<Row[]>`select 1 from public.restaurant_tables where location_id=${this.locationId} and code=${input.code} and is_active limit 1`;
    if (duplicate[0]) throw new TableCodeAlreadyUsedError(input.code);
    const areaId = await this.diningAreaFor(input.isOutdoor);
    // I nuovi tavoli entrano in planimetria su una griglia leggibile: senza
    // coordinate finirebbero tutti impilati nell'angolo in alto a sinistra.
    const placed = await sql<Row[]>`select count(*)::int as total from public.restaurant_tables where location_id=${this.locationId} and is_outdoor=${input.isOutdoor} and is_active`;
    const index = number(placed[0]?.total);
    const rows = await sql<Row[]>`
      insert into public.restaurant_tables
        (location_id,dining_area_id,code,display_name,minimum_capacity,maximum_capacity,is_outdoor,is_accessible,position_x,position_y)
      values (${this.locationId},${areaId},${input.code},${input.displayName},${input.minimumCapacity},${input.maximumCapacity},${input.isOutdoor},${input.isAccessible},${12 + (index % 5) * 18},${14 + Math.floor(index / 5) * 20})
      returning id`;
    return this.tableById(text(rows[0].id));
  }

  async updateTable(id: string, changes: TableChanges): Promise<TableResource> {
    const sql = getPostgres();
    const current = await this.tableById(id);
    if (changes.code && changes.code !== current.code) {
      const duplicate = await sql<Row[]>`select 1 from public.restaurant_tables where location_id=${this.locationId} and code=${changes.code} and id<>${id} and is_active limit 1`;
      if (duplicate[0]) throw new TableCodeAlreadyUsedError(changes.code);
    }
    const isOutdoor = changes.isOutdoor ?? current.isOutdoor;
    // Spostare un tavolo fuori significa cambiargli area: la colonna booleana
    // e la sala devono restare coerenti o la planimetria lo perde.
    const areaId = changes.isOutdoor !== undefined && changes.isOutdoor !== current.isOutdoor
      ? await this.diningAreaFor(isOutdoor)
      : undefined;
    await sql`
      update public.restaurant_tables set
        code=${changes.code ?? current.code},
        display_name=${changes.displayName ?? current.displayName},
        minimum_capacity=${changes.minimumCapacity ?? current.minimumCapacity},
        maximum_capacity=${changes.maximumCapacity ?? current.maximumCapacity},
        is_outdoor=${isOutdoor},
        is_accessible=${changes.isAccessible ?? current.isAccessible},
        status=${changes.status ?? current.status},
        updated_at=now()
      where id=${id} and location_id=${this.locationId}`;
    if (areaId) await sql`update public.restaurant_tables set dining_area_id=${areaId} where id=${id} and location_id=${this.locationId}`;
    return this.tableById(id);
  }

  async listClosures(): Promise<SpecialClosure[]> {
    const sql = getPostgres();
    // Solo da oggi in avanti: le chiusure passate sono storia, e un elenco che
    // cresce all'infinito diventa illeggibile proprio quando serve.
    const rows = await sql<Row[]>`
      select * from public.special_openings_closures
      where location_id=${this.locationId} and date >= current_date
      order by date, start_time nulls first`;
    return rows.map((row) => ({
      id: text(row.id), date: text(row.date).slice(0, 10),
      startTime: text(row.start_time).slice(0, 5) || undefined,
      endTime: text(row.end_time).slice(0, 5) || undefined,
      type: text(row.type) as SpecialClosure["type"], reason: text(row.reason),
    }));
  }

  async createClosure(input: ClosureInput): Promise<SpecialClosure> {
    const sql = getPostgres();
    const rows = await sql<Row[]>`
      insert into public.special_openings_closures (location_id,date,start_time,end_time,type,reason)
      values (${this.locationId},${input.date},${input.startTime ?? null},${input.endTime ?? null},${input.type},${input.reason})
      returning id`;
    return { id: text(rows[0].id), ...input };
  }

  async deleteClosure(id: string): Promise<void> {
    const sql = getPostgres();
    // Il vincolo sulla sede sta nella query, non nel chiamante: senza, l'id di
    // una chiusura dell'altro ristorante basterebbe a cancellarla.
    await sql`delete from public.special_openings_closures where id=${id} and location_id=${this.locationId}`;
  }

  async deleteTable(id: string): Promise<void> {
    const sql = getPostgres();
    await this.tableById(id);
    const busy = await sql<Row[]>`
      select 1 from public.reservation_table_assignments a
      join public.reservations r on r.id=a.reservation_id
      where a.table_id=${id}
        and r.status = any(array['confirmed','modified','arriving','late','arrived','seated'])
        and r.start_at > now() - interval '6 hours'
      limit 1`;
    if (busy[0]) throw new TableInUseError();
    // Disattivazione, non cancellazione: le prenotazioni passate devono
    // continuare a puntare al tavolo su cui sono state servite.
    await sql`update public.restaurant_tables set is_active=false,updated_at=now() where id=${id} and location_id=${this.locationId}`;
  }

  async getAvailabilityContext() {
    const sql = getPostgres();
    const [locations, tableRows, combinationRows, itemRows, serviceRows, reservationRows, holdRows, closureRows, ruleRows] = await Promise.all([
      sql<Row[]>`select l.booking_enabled,l.status,r.status as restaurant_status from public.locations l join public.restaurants r on r.id=l.restaurant_id where l.id=${this.locationId}`,
      sql<Row[]>`select t.*,a.name as dining_area_name from public.restaurant_tables t join public.dining_areas a on a.id=t.dining_area_id where t.location_id=${this.locationId} and t.is_active`,
      sql<Row[]>`select * from public.table_combinations where location_id=${this.locationId} and is_active`,
      sql<Row[]>`select i.* from public.table_combination_items i join public.table_combinations c on c.id=i.table_combination_id where c.location_id=${this.locationId}`,
      sql<Row[]>`select * from public.service_periods where location_id=${this.locationId} and is_active`,
      this.reservationRows(`and r.status = any(array['confirmed','modified','arriving','late','arrived','seated'])`),
      sql<Row[]>`select * from public.reservation_holds where location_id=${this.locationId} and status='active' and expires_at>now()`,
      sql<Row[]>`select * from public.special_openings_closures where location_id=${this.locationId}`,
      sql<Row[]>`select * from public.booking_rules where location_id=${this.locationId} and is_active order by created_at limit 1`,
    ]);
    const tables: TableResource[] = tableRows.map(tableResource);
    const combinations: TableCombination[] = combinationRows.map((row) => ({
      id: text(row.id), name: text(row.name), minimumCapacity: number(row.minimum_capacity), maximumCapacity: number(row.maximum_capacity),
      isActive: bool(row.is_active), tableIds: itemRows.filter((item) => item.table_combination_id === row.id).map((item) => text(item.table_id)),
    }));
    const servicePeriods: ServicePeriod[] = serviceRows.map((row) => ({
      id: text(row.id), name: text(row.name), dayOfWeek: number(row.day_of_week), startTime: text(row.start_time).slice(0, 5),
      endTime: text(row.end_time).slice(0, 5), slotIntervalMinutes: number(row.slot_interval_minutes),
      defaultDurationMinutes: number(row.default_duration_minutes), turnaroundMinutes: number(row.turnaround_minutes),
      maximumCovers: number(row.maximum_covers), maximumArrivalsPerSlot: number(row.maximum_arrivals_per_slot),
      onlineBookingEnabled: bool(row.online_booking_enabled), phoneBookingEnabled: bool(row.phone_booking_enabled), isActive: bool(row.is_active),
    }));
    const holds: ReservationHold[] = holdRows.map((row) => ({
      id: text(row.id), locationId: text(row.location_id), sessionId: text(row.session_id), partySize: number(row.party_size),
      startAt: iso(row.start_at), endAt: iso(row.end_at),
      tableIds: Array.isArray(row.table_ids) ? row.table_ids.map(String) : [], combinationId: text(row.combination_id) || undefined,
      diningAreaId: text(row.dining_area_id), expiresAt: iso(row.expires_at),
      status: text(row.status) as ReservationHold["status"], createdAt: iso(row.created_at),
    }));
    const closures: SpecialClosure[] = closureRows.map((row) => ({
      id: text(row.id), date: text(row.date), startTime: text(row.start_time).slice(0, 5) || undefined,
      endTime: text(row.end_time).slice(0, 5) || undefined, type: text(row.type) as SpecialClosure["type"],
      reason: text(row.reason), affectedAreaId: text(row.affected_area_id) || undefined, affectedTableId: text(row.affected_table_id) || undefined,
    }));
    const rule = ruleRows[0];
    const conditions = (rule?.conditions ?? {}) as { durationByParty?: Record<string, number> };
    return {
      tables, combinations, servicePeriods, reservations: reservationRows.map(reservation), holds, closures,
      durationRules: conditions.durationByParty as never,
      bookingConstraints: rule ? {
        minimumPartySize: number(rule.minimum_party_size), maximumPartySize: number(rule.maximum_party_size),
        minimumNoticeMinutes: number(rule.minimum_notice_minutes), maximumAdvanceDays: number(rule.maximum_advance_days),
        requiresManualApproval: bool(rule.requires_manual_approval), requiresDeposit: bool(rule.requires_deposit),
        depositAmount: number(rule.deposit_amount),
      } : undefined,
      locationAvailable: Boolean(locations[0]?.booking_enabled && locations[0]?.status === "active" && locations[0]?.restaurant_status === "active"),
      timezone: getRestaurantLocationById(this.locationId)?.timezone ?? restaurantConfig.timezone,
      now: new Date(),
    };
  }

  async createHold(input: CreateHoldInput) {
    const availability = checkAvailability({ ...input.availability, requestedTime: formatTimeInZone(input.startAt) }, await this.getAvailabilityContext());
    const option = availability.availableOptions.find((item) => item.startAt === input.startAt);
    if (!option) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
    const sql = getPostgres();
    try {
      const [row] = await sql<Row[]>`
        select * from public.create_reservation_hold(
          ${this.locationId}::uuid, ${input.sessionId}, ${input.availability.source},
          ${input.availability.partySize}, ${option.startAt}::timestamptz, ${option.endAt}::timestamptz,
          ${option.tableIds}::uuid[], ${option.combinationId ?? null}::uuid,
          ${option.diningArea.id}::uuid, ${new Date(Date.now() + restaurantConfig.holdMinutes * 60_000).toISOString()}::timestamptz
        )
      `;
      return {
        id: text(row.id), locationId: text(row.location_id), sessionId: text(row.session_id), partySize: number(row.party_size),
        startAt: iso(row.start_at), endAt: iso(row.end_at),
        tableIds: Array.isArray(row.table_ids) ? row.table_ids.map(String) : [], combinationId: text(row.combination_id) || undefined,
        diningAreaId: text(row.dining_area_id), expiresAt: iso(row.expires_at),
        status: text(row.status) as ReservationHold["status"], createdAt: iso(row.created_at),
      };
    } catch (error) {
      if (error instanceof Error && /SLOT_UNAVAILABLE|TABLE_UNAVAILABLE|CAPACITY_EXCEEDED/.test(error.message)) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
      throw error;
    }
  }

  async releaseHold(holdId: string, sessionId?: string) {
    const sql = getPostgres();
    await sql`update public.reservation_holds set status='released' where id=${holdId}::uuid and location_id=${this.locationId}::uuid and status='active' and (${sessionId ?? null}::text is null or session_id=${sessionId ?? null})`;
  }

  async confirmHold(input: ConfirmHoldInput): Promise<ConfirmedReservation> {
    const sql = getPostgres();
    const [hold] = await sql<Row[]>`select location_id from public.reservation_holds where id=${input.holdId}::uuid`;
    if (!hold || text(hold.location_id) !== this.locationId) throw new HoldExpiredError();
    const token = managementTokenForIdempotency(input.idempotencyKey);
    try {
      const [result] = await sql<Row[]>`
        select public.confirm_reservation_from_hold(
          ${input.holdId}::uuid, ${`${this.locationId}:${input.idempotencyKey}`},
          ${hashManagementToken(token)}, ${sql.json(input.customer)}::jsonb,
          ${input.customerNotes ?? null}, ${input.specialOccasion ?? null}
        ) as reservation_id
      `;
      const prefix = getRestaurantLocationById(this.locationId)?.reservationCodePrefix ?? "RS";
      await sql`
        update public.reservations
        set reservation_code = ${`${prefix}-`} || upper(substr(replace(id::text,'-',''),1,6))
        where id = ${text(result.reservation_id)}::uuid and location_id = ${this.locationId}::uuid
      `;
      const rows = await this.reservationRows(`and r.id=$2::uuid`, [result.reservation_id]);
      if (!rows[0]) throw new ReservationNotFoundError();
      return { reservation: publicReservation(rows[0]), managementToken: token };
    } catch (error) {
      if (error instanceof Error && error.message.includes("HOLD_EXPIRED")) throw new HoldExpiredError();
      if (error instanceof Error && error.message.includes("SLOT_UNAVAILABLE")) throw new SlotUnavailableError();
      throw error;
    }
  }

  async listReservations() { return (await this.reservationRows("", [], "order by r.start_at")).map(publicReservation); }

  private async byToken(token: string) {
    const rows = await this.reservationRows(`and r.management_token_hash=$2`, [hashManagementToken(token)]);
    return rows[0] ? reservation(rows[0]) : null;
  }

  async findReservationByToken(token: string) { const row = await this.byToken(token); return row ? publicReservation(row as unknown as Row) : null; }

  async updateReservationByToken(token: string, changes: Partial<Reservation>) {
    const current = await this.byToken(token);
    if (!current) throw new ReservationNotFoundError();
    assertCustomerCanModifyReservation(current);
    const sql = getPostgres();
    await sql.begin(async (tx) => {
      if (changes.customer) await tx`update public.customers set allergies=coalesce(${changes.customer.allergies ?? null},allergies),accessibility_needs=coalesce(${changes.customer.accessibilityNeeds ?? null},accessibility_needs) where id=${current.customerId}::uuid`;
      await tx`update public.reservations set customer_notes=coalesce(${changes.customerNotes ?? null},customer_notes),updated_at=now() where id=${current.id}::uuid and location_id=${this.locationId}::uuid`;
    });
    const rows = await this.reservationRows(`and r.id=$2::uuid`, [current.id]);
    return publicReservation(rows[0]);
  }

  async cancelReservationByToken(token: string, reason?: string) {
    const current = await this.byToken(token);
    if (!current) throw new ReservationNotFoundError();
    assertCustomerCanCancelReservation(current);
    const sql = getPostgres();
    await sql`update public.reservations set status='cancelled_by_customer',cancellation_reason=${reason ?? null},cancelled_at=now(),updated_at=now() where id=${current.id}::uuid and location_id=${this.locationId}::uuid`;
    const rows = await this.reservationRows(`and r.id=$2::uuid`, [current.id]);
    return publicReservation(rows[0]);
  }

  async updateReservationByStaff(id: string, changes: { status?: Reservation["status"]; tableIds?: string[]; customerNotes?: string }) {
    const rows = await this.reservationRows(`and r.id=$2::uuid`, [id]);
    if (!rows[0]) throw new ReservationNotFoundError();
    const sql = getPostgres();
    try {
      if (changes.tableIds) await sql`select public.reassign_reservation_tables(${id}::uuid,${changes.tableIds}::uuid[],${changes.status ?? null},${changes.customerNotes ?? null})`;
      else await sql`select public.update_reservation_by_staff(${id}::uuid,${changes.status ?? null},${changes.customerNotes ?? null},${changes.customerNotes !== undefined})`;
    } catch (error) {
      if (error instanceof Error && error.message.includes("TABLE_CONFLICT")) throw new TableConflictError();
      throw error;
    }
    const updated = await this.reservationRows(`and r.id=$2::uuid`, [id]);
    return publicReservation(updated[0]);
  }

  async addWaitlist(entry: Omit<WaitlistEntry, "id" | "locationId" | "status" | "priority" | "createdAt">): Promise<WaitlistEntry> {
    const sql = getPostgres();
    const [row] = await sql<Row[]>`insert into public.waitlist_entries(location_id,requested_date,requested_start_at,party_size,flexibility_minutes,preferred_area_id,notes,status,customer_snapshot) values(${this.locationId}::uuid,${entry.requestedDate}::date,${entry.requestedStartAt}::timestamptz,${entry.partySize},${entry.flexibilityMinutes},${entry.preferredAreaId ?? null}::uuid,${entry.notes ?? null},'waiting',${sql.json(entry.customer)}::jsonb) returning *`;
    return { ...entry, id: text(row.id), locationId: this.locationId, status: "waiting" as const, priority: number(row.priority), createdAt: iso(row.created_at) };
  }

  async updateWaitlist(id: string, status: WaitlistEntry["status"]) {
    const entries = await this.listWaitlist();
    const current = entries.find((entry) => entry.id === id);
    if (!current) throw new ReservationNotFoundError();
    if (current.status !== status) assertWaitlistTransition(current.status, status);
    const sql = getPostgres();
    await sql`update public.waitlist_entries set status=${status} where id=${id}::uuid and location_id=${this.locationId}::uuid`;
    return { ...current, status };
  }

  async listWaitlist() {
    const sql = getPostgres();
    const rows = await sql<Row[]>`select * from public.waitlist_entries where location_id=${this.locationId}::uuid order by created_at`;
    return rows.map((row) => ({
      id: text(row.id), locationId: text(row.location_id), customer: (row.customer_snapshot ?? {}) as WaitlistEntry["customer"],
      requestedDate: text(row.requested_date), requestedStartAt: iso(row.requested_start_at),
      partySize: number(row.party_size), flexibilityMinutes: number(row.flexibility_minutes), preferredAreaId: text(row.preferred_area_id) || undefined,
      status: text(row.status) as WaitlistEntry["status"], priority: number(row.priority), notes: text(row.notes) || undefined,
      createdAt: iso(row.created_at),
    }));
  }

  async listCustomers() {
    const sql = getPostgres();
    const rows = await sql<Row[]>`select distinct c.* from public.customers c join public.reservations r on r.customer_id=c.id where r.location_id=${this.locationId}::uuid order by c.last_name,c.first_name`;
    return rows.map(customer);
  }

  async recordVoiceEscalation(input: VoiceEscalationInput) {
    const sql = getPostgres();
    const providerCallId = input.providerCallId?.trim() ? `escalation:${input.providerCallId.trim()}` : `escalation:${randomUUID()}`;
    const [row] = await sql<Row[]>`insert into public.voice_calls(location_id,provider,provider_call_id,caller_phone,direction,started_at,duration_seconds,status,intent,outcome,reservation_id,summary,sentiment,human_escalation_required,metadata) values(${this.locationId}::uuid,'retell',${providerCallId},${input.callerPhone ?? null},'inbound',now(),0,'callback_requested','Escalation al personale','Richiamata richiesta',${input.reservationId ?? null}::uuid,${sql.json({ text: input.summary })}::jsonb,'neutral',true,${sql.json({ escalation_reason: input.reason })}::jsonb) on conflict(provider,provider_call_id) do update set summary=excluded.summary returning *`;
    return this.voiceCall(row);
  }

  private voiceCall(row: Row): VoiceCall {
    const summary = row.summary as Row | undefined;
    return { id: text(row.id), locationId: text(row.location_id), provider: text(row.provider) as VoiceCall["provider"], providerCallId: text(row.provider_call_id), callerPhone: text(row.caller_phone), startedAt: iso(row.started_at), durationSeconds: number(row.duration_seconds), status: text(row.status) as VoiceCall["status"], intent: text(row.intent), outcome: text(row.outcome), summary: text(summary?.text), sentiment: text(row.sentiment, "neutral") as VoiceCall["sentiment"], reservationId: text(row.reservation_id) || undefined, humanEscalationRequired: bool(row.human_escalation_required) };
  }

  async listCalls() { const sql = getPostgres(); return (await sql<Row[]>`select * from public.voice_calls where location_id=${this.locationId}::uuid order by started_at desc limit 100`).map((row) => this.voiceCall(row)); }

  async listEvents() {
    const sql = getPostgres();
    const rows = await sql<Row[]>`select e.* from public.reservation_events e join public.reservations r on r.id=e.reservation_id where r.location_id=${this.locationId}::uuid order by e.created_at desc limit 100`;
    return rows.map((row): ReservationEvent => ({ id: text(row.id), reservationId: text(row.reservation_id), eventType: text(row.event_type), previousData: row.previous_data as Partial<Reservation>, newData: row.new_data as Partial<Reservation>, source: text(row.source), actorType: text(row.actor_type) as ReservationEvent["actorType"], createdAt: iso(row.created_at) }));
  }
}
