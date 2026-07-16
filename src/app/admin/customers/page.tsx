import { Badge } from "@/components/ui/badge";
import { CustomersTable } from "@/components/admin/customers-table";
import { PageHeading } from "@/components/admin/page-heading";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";

export default async function CustomersPage() {
  const session = await requirePermission("customers:read");
  const location = await getActiveAdminLocation(session);
  const customers = await getRepository(location.id).listCustomers();
  return <><PageHeading eyebrow={location.shortName} title="Ospiti" description={`Storico, preferenze, allergie e consensi degli ospiti della sede di ${location.city}.`} actions={<Badge variant="outline">Dati isolati per sede</Badge>} /><CustomersTable customers={customers} /></>;
}
