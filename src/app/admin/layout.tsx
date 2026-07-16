import { AdminShell } from "@/components/admin/admin-shell";
import { restaurantLocations } from "@/config/brand";
import { getAccessibleAdminLocations, getActiveAdminLocation } from "@/lib/admin/location";
import { requireStaffSession } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession();
  const activeLocation = await getActiveAdminLocation(session);
  const accessibleLocations = getAccessibleAdminLocations(session);
  return <AdminShell session={session} locations={accessibleLocations.length ? accessibleLocations : restaurantLocations.slice(0, 1)} activeLocation={activeLocation}>{children}</AdminShell>;
}

