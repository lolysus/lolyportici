import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { normalizeStoredPermissions, rolePermissions, type Permission, type Role } from "@/config/permissions";
import { restaurantLocations } from "@/config/brand";
import { PermissionDeniedError } from "@/domains/bookings/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffSession } from "@/types/domain";

const demoSession: StaffSession = {
  id: "90000000-0000-0000-0000-000000000001",
  name: "Manager Demo",
  email: "manager@example.test",
  role: "manager",
  permissions: [...rolePermissions.manager],
  organizationId: "00000000-0000-0000-0000-000000000001",
  locationId: "00000000-0000-0000-0000-000000000003",
  accessibleLocationIds: restaurantLocations.map((location) => location.id),
  centralAccess: true,
  demo: true,
};

const rolePriority: Record<Role, number> = {
  owner: 7,
  administrator: 6,
  manager: 5,
  receptionist: 4,
  phone_operator: 3,
  waiter: 2,
  analyst: 1,
};

export const getCurrentStaffSession = cache(async (): Promise<StaffSession | null> => {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (demoMode) return demoSession;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("staff_users")
    .select("id,first_name,last_name,email,organization_id,default_location_id,staff_user_roles(location_id,role:roles(name,permissions))")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .single();
  if (!data) return null;
  const rawRoles = data.staff_user_roles as unknown as Array<{ location_id: string | null; role: { name: Role; permissions: string[] } | null }>;
  const assignments = rawRoles
    .filter((assignment): assignment is { location_id: string | null; role: { name: Role; permissions: string[] } } => Boolean(assignment.role))
    .sort((left, right) => rolePriority[right.role.name] - rolePriority[left.role.name]);
  const primaryAssignment = assignments[0];
  if (!primaryAssignment) return null;
  const role = primaryAssignment.role.name;
  const centralAccess = assignments.some((assignment) => assignment.location_id === null || ["owner", "administrator"].includes(assignment.role.name));
  const accessibleLocationIds = centralAccess
    ? restaurantLocations.map((location) => location.id)
    : [...new Set(assignments.map((assignment) => assignment.location_id).filter((id): id is string => Boolean(id)))];
  if (accessibleLocationIds.length === 0) return null;
  const locationId = accessibleLocationIds.includes(data.default_location_id)
    ? data.default_location_id
    : accessibleLocationIds[0];
  return {
    id: data.id,
    name: `${data.first_name} ${data.last_name}`,
    email: data.email,
    role,
    permissions: normalizeStoredPermissions(role, primaryAssignment.role.permissions),
    organizationId: data.organization_id,
    locationId,
    accessibleLocationIds,
    centralAccess,
    demo: false,
  };
});

export async function requireStaffSession() {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await getCurrentStaffSession();
  if (!session || !session.permissions.includes(permission)) throw new PermissionDeniedError();
  return session;
}
