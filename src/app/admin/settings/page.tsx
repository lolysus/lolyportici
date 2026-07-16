import { PageHeading } from "@/components/admin/page-heading";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";

export default async function SettingsPage() {
  await requirePermission("settings:write");
  const location = await getActiveAdminLocation();
  const settings = await getRestaurantSettings(location.id);
  return <>
    <PageHeading
      eyebrow={location.shortName}
      title="Configurazione sede"
      description={`Stato operativo, settimana di servizio, regole, comunicazioni ed esperienza ospite applicati esclusivamente a ${location.city}.`}
    />
    <SettingsPanel key={location.id} initialSettings={settings} location={location} />
  </>;
}
