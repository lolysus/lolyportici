import { InvalidWaitlistStateError } from "@/domains/bookings/errors";
import type { WaitlistEntry } from "@/types/domain";

const transitions: Record<WaitlistEntry["status"], WaitlistEntry["status"][]> = {
  waiting: ["offered", "cancelled"],
  offered: ["converted", "expired", "cancelled"],
  converted: [],
  expired: [],
  cancelled: [],
};

export function assertWaitlistTransition(from: WaitlistEntry["status"], to: WaitlistEntry["status"]) {
  if (!transitions[from].includes(to)) throw new InvalidWaitlistStateError(from, to);
}
