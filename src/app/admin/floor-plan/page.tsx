import { FloorPlanBoard } from "@/components/floor-plan/floor-plan-board";
import { PageHeading } from "@/components/admin/page-heading";
import { TablesManager } from "@/components/admin/tables-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { getRepository } from "@/repositories";

export default async function FloorPlanPage() {
  await requirePermission("floor:read");
  const location = await getActiveAdminLocation();
  const repository = getRepository(location.id);
  const [tables, reservations] = await Promise.all([
    repository.listTables(),
    repository.listReservations(),
  ]);
  const version = tables.map((table) => `${table.id}:${table.code}:${table.maximumCapacity}`).join("|");

  return <>
    <PageHeading
      eyebrow={location.shortName}
      title="Sala e tavoli"
      description={`Configura i tavoli di ${location.city} e assegna le prenotazioni del servizio.`}
    />
    <Tabs defaultValue="tables" className="mt-6">
      <TabsList>
        <TabsTrigger value="tables">Tavoli</TabsTrigger>
        <TabsTrigger value="plan">Planimetria</TabsTrigger>
      </TabsList>
      <TabsContent value="tables" className="mt-6">
        <TablesManager key={version} initialTables={tables} />
      </TabsContent>
      <TabsContent value="plan" className="mt-6">
        <FloorPlanBoard initialTables={tables} initialReservations={reservations} />
      </TabsContent>
    </Tabs>
  </>;
}
