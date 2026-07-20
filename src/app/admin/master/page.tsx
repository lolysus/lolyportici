import { redirect } from "next/navigation";
import { MasterRulesPanel } from "@/components/admin/master-rules-panel";
import { PageHeading } from "@/components/admin/page-heading";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getAccessibleAdminLocations } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";

export default async function MasterRulesPage() {
  const session = await requirePermission("settings:write");
  if (!session.centralAccess) redirect("/admin/dashboard");
  const locations = getAccessibleAdminLocations(session);
  const restaurants = await Promise.all(locations.map(async (location) => ({
    location,
    settings: await getRestaurantSettings(location.id),
  })));

  return <>
    <PageHeading
      eyebrow="Account master · YUKO × KouSushi"
      title="Regole comuni, identità indipendenti"
      description="Queste policy si applicano contemporaneamente ai due ristoranti. Orari, capienza e messaggi restano configurabili dentro la singola dashboard operativa."
    />
    <MasterRulesPanel restaurants={restaurants} />
  </>;
}
