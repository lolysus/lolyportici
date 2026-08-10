export const roles = [
  "owner",
  "administrator",
  "manager",
  "receptionist",
  "waiter",
  "phone_operator",
  "analyst",
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "reservations:read",
  "reservations:write",
  "floor:read",
  "floor:write",
  "customers:read",
  "customers:write",
  "analytics:read",
  "settings:write",
  "staff:write",
] as const;

export type Permission = (typeof permissions)[number];

export const permissionLabels: Record<Permission, string> = {
  "reservations:read": "Vede prenotazioni",
  "reservations:write": "Gestisce prenotazioni",
  "floor:read": "Vede la sala",
  "floor:write": "Gestisce tavoli",
  "customers:read": "Vede ospiti",
  "customers:write": "Gestisce ospiti",
  "analytics:read": "Vede analytics",
  "settings:write": "Modifica regole",
  "staff:write": "Gestisce accessi e ruoli",
};

const all: Permission[] = [...permissions];

export const rolePermissions: Record<Role, Permission[]> = {
  owner: all,
  administrator: all,
  manager: all,
  receptionist: ["reservations:read", "reservations:write", "floor:read", "customers:read", "customers:write"],
  waiter: ["reservations:read", "floor:read", "floor:write", "customers:read"],
  phone_operator: ["reservations:read", "reservations:write", "customers:read"],
  analyst: ["analytics:read", "reservations:read"],
};

export function normalizeStoredPermissions(role: Role, stored?: string[] | null): Permission[] {
  if (!stored?.length) return [...rolePermissions[role]];
  if (stored.includes("*")) return [...all];
  const expanded = new Set<Permission>();
  for (const value of stored) {
    if (permissions.includes(value as Permission)) expanded.add(value as Permission);
    if (value.endsWith(":*")) {
      const prefix = value.slice(0, -1);
      permissions.filter((permission) => permission.startsWith(prefix)).forEach((permission) => expanded.add(permission));
    }
  }
  return [...expanded];
}

/**
 * Chi comanda dentro il proprio ristorante.
 *
 * Prima "amministratore" era un ruolo che stava sopra i due locali e lo
 * assegnava solo la regia centrale. Ora la regia centrale non c'è più: un
 * amministratore è di una sede, e a nominarlo è chi quella sede la guida.
 */
export function isRestaurantLead(role: Role) {
  return role === "owner" || role === "administrator";
}

export function hasPermission(role: Role, permission: Permission, stored?: string[] | null) {
  return normalizeStoredPermissions(role, stored).includes(permission);
}
