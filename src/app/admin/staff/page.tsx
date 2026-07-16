import { InviteStaffDialog } from "@/components/admin/invite-staff-dialog";
import { PageHeading } from "@/components/admin/page-heading";
import { RolePermissionMatrix } from "@/components/admin/role-permission-matrix";
import { StaffAccessManager, type StaffAccessRow } from "@/components/admin/staff-access-manager";
import type { RestaurantLocation } from "@/config/brand";
import { normalizeStoredPermissions, rolePermissions, roles, type Permission, type Role } from "@/config/permissions";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

function demoStaff(location: RestaurantLocation): StaffAccessRow[] {
  return [
    { id: "90000000-0000-0000-0000-000000000001", name: "Manager Demo", email: "manager@example.test", role: "manager", status: "active", locationName: "Regia centrale", isCurrent: true, isOwner: false, isProtected: true },
    { id: "90000000-0000-0000-0000-000000000002", name: "Reception Demo", email: "reception@example.test", role: "receptionist", status: "invited", locationName: location.shortName, isCurrent: false, isOwner: false, isProtected: false },
  ];
}

async function listStaff(organizationId: string, currentId: string, location: RestaurantLocation): Promise<StaffAccessRow[]> {
  const { data, error } = await getSupabaseAdmin().from("staff_users").select("id,first_name,last_name,email,status,staff_user_roles(location_id,role:roles(name))").eq("organization_id", organizationId).order("last_name");
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const assignments = row.staff_user_roles as unknown as Array<{ location_id: string | null; role: { name: Role } | null }>;
    const assignment = assignments.find((item) => item.location_id === location.id)
      ?? assignments.find((item) => item.role?.name === "owner" || item.role?.name === "administrator" || item.location_id === null);
    const role = assignment?.role?.name;
    if (!role) return [];
    const centralAccount = assignment.location_id === null || role === "owner" || role === "administrator";
    return [{ id: row.id, name: `${row.first_name} ${row.last_name}`, email: row.email, role, status: row.status, locationName: centralAccount ? "Regia centrale" : location.shortName, isCurrent: row.id === currentId, isOwner: role === "owner", isProtected: centralAccount }];
  });
}

async function listRolePermissions(): Promise<Record<Role, Permission[]>> {
  const defaults = Object.fromEntries(roles.map((role) => [role, [...rolePermissions[role]]])) as Record<Role, Permission[]>;
  if (!isSupabaseConfigured()) return defaults;
  const { data, error } = await getSupabaseAdmin().from("roles").select("name,permissions");
  if (error) throw error;
  for (const row of data ?? []) {
    const role = row.name as Role;
    defaults[role] = normalizeStoredPermissions(role, row.permissions as string[]);
  }
  return defaults;
}

export default async function StaffPage() {
  const session = await requirePermission("staff:write");
  const location = await getActiveAdminLocation(session);
  const [staff, matrix] = await Promise.all([
    session.demo ? Promise.resolve(demoStaff(location)) : listStaff(session.organizationId, session.id, location),
    listRolePermissions(),
  ]);
  return <>
    <PageHeading eyebrow={location.shortName} title="Personale e permessi" description={`Gestisci gli account operativi assegnati a ${location.city}. Gli account centrali restano protetti.`} actions={<InviteStaffDialog locationName={location.shortName} canInviteAdministrator={session.centralAccess} />} />
    <StaffAccessManager initialStaff={staff} canAssignAdministrator={session.centralAccess} />
    {session.centralAccess && <div className="mt-6"><RolePermissionMatrix initialPermissions={matrix} currentRole={session.role} /></div>}
  </>;
}
