import { ClosuresPanel } from "@/components/admin/closures-panel";
import { PageHeading } from "@/components/admin/page-heading";
import { NotificationSoundSettings } from "@/components/admin/notification-sound-settings";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";

export default async function SettingsPage() {
  await requirePermission("settings:write");
  const location = await getActiveAdminLocation();
  const [settings, closures] = await Promise.all([
    getRestaurantSettings(location.id),
    getRepository(location.id).listClosures(),
  ]);
  return <>
    <PageHeading
      eyebrow={location.shortName}
      title="Configurazione sede"
      description={`Stato operativo, settimana di servizio, regole, comunicazioni ed esperienza ospite applicati esclusivamente a ${location.city}.`}
    />
    <SettingsPanel key={location.id} initialSettings={settings} location={location} />
    {/* Le chiusure sono record a sé, non campi del modulo: si salvano da sole,
        quindi stanno fuori dal pannello che ha un unico pulsante "Salva". */}
    {/* Preferenze del dispositivo, non della sede: stanno fuori dal pannello
        che salva sul server, perché non si salvano lì. */}
    <div className="mt-6"><NotificationSoundSettings key={location.id} location={location} /></div>
    <div className="mt-6"><ClosuresPanel key={location.id} initialClosures={closures} /></div>
  </>;
}
