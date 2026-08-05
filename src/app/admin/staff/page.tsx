import { InviteStaffDialog } from "@/components/admin/invite-staff-dialog";
import { PageHeading } from "@/components/admin/page-heading";
import { StaffAccessManager, type StaffAccessRow } from "@/components/admin/staff-access-manager";
import type { RestaurantLocation } from "@/config/brand";
import { isRestaurantLead, type Role } from "@/config/permissions";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function demoStaff(location: RestaurantLocation): StaffAccessRow[] {
  return [
    { id: "90000000-0000-0000-0000-000000000001", name: "Manager Demo", email: "manager@example.test", role: "manager", status: "active", locationName: location.shortName, isCurrent: true, isOwner: false, isProtected: true },
    { id: "90000000-0000-0000-0000-000000000002", name: "Reception Demo", email: "reception@example.test", role: "receptionist", status: "invited", locationName: location.shortName, isCurrent: false, isOwner: false, isProtected: false },
  ];
}

async function listStaff(organizationId: string, currentId: string, location: RestaurantLocation): Promise<StaffAccessRow[]> {
  const { data, error } = await getSupabaseAdmin().from("staff_users").select("id,first_name,last_name,email,status,staff_user_roles(location_id,role:roles(name))").eq("organization_id", organizationId).order("last_name");
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const assignments = row.staff_user_roles as unknown as Array<{ location_id: string | null; role: { name: Role } | null }>;
    // Solo chi ha un incarico in questa sede. Prima ricadeva qui anche chi
    // aveva un ruolo senza sede — il vecchio profilo centrale — e il personale
    // di Portici si trovava in elenco ad Ardea.
    const assignment = assignments.find((item) => item.location_id === location.id);
    const role = assignment?.role?.name;
    if (!role) return [];
    return [{ id: row.id, name: `${row.first_name} ${row.last_name}`, email: row.email, role, status: row.status, locationName: location.shortName, isCurrent: row.id === currentId, isOwner: role === "owner", isProtected: role === "owner" }];
  });
}

export default async function StaffPage() {
  const session = await requirePermission("staff:write");
  const location = await getActiveAdminLocation(session);
  const staff = session.demo ? demoStaff(location) : await listStaff(session.organizationId, session.id, location);
  return <>
    <PageHeading eyebrow={location.shortName} title="Personale e permessi" description={`Gestisci gli account operativi di ${location.city}. Il personale delle altre sedi non compare e non è modificabile da qui.`} actions={<InviteStaffDialog locationName={location.shortName} canInviteAdministrator={isRestaurantLead(session.role)} />} />
    <StaffAccessManager initialStaff={staff} canAssignAdministrator={isRestaurantLead(session.role)} />
  </>;
}
