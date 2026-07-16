import { PageHeading } from "@/components/admin/page-heading";
import { FloorPlanBoard } from "@/components/floor-plan/floor-plan-board";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";
import { getActiveAdminLocation } from "@/lib/admin/location";

export default async function FloorPlanPage() { await requirePermission("floor:read"); const location=await getActiveAdminLocation(); const repository = getRepository(location.id); const [context, reservations] = await Promise.all([repository.getAvailabilityContext(), repository.listReservations()]); const version=[...context.tables.map((row)=>`${row.id}:${row.status}`),...reservations.map((row)=>`${row.id}:${row.updatedAt}:${row.tableIds.join(",")}`)].join("|"); return <><PageHeading eyebrow={location.shortName} title="Sala" description={`Mappa operativa di ${location.city}: tavoli, compatibilità e stato del servizio.`} /><FloorPlanBoard key={version} initialTables={context.tables} initialReservations={reservations} /></>; }
