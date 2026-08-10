import { BookingLinksPanel } from "@/components/admin/booking-links-panel";
import { CapacityBandsPanel } from "@/components/admin/capacity-bands-panel";
import { ClosuresPanel } from "@/components/admin/closures-panel";
import { PageHeading } from "@/components/admin/page-heading";
import { NotificationSoundSettings } from "@/components/admin/notification-sound-settings";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { StaffAccessLinksPanel } from "@/components/admin/staff-access-links-panel";
import { adminAccessPath } from "@/config/admin-access";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getPublicAppUrl } from "@/lib/public-url";
import { getRepository } from "@/repositories";

export default async function SettingsPage() {
  await requirePermission("settings:write");
  const location = await getActiveAdminLocation();
  const [settings, closures, capacityBands] = await Promise.all([
    getRestaurantSettings(location.id),
    getRepository(location.id).listClosures(),
    getRepository(location.id).listCapacityBands(),
  ]);
  const baseUrl = getPublicAppUrl();
  return <>
    <PageHeading
      eyebrow={location.shortName}
      title="Configurazione sede"
      description={`Stato operativo, settimana di servizio, regole, comunicazioni ed esperienza ospite applicati esclusivamente a ${location.city}.`}
    />
    {/* I due link (pubblico e riservato) vivevano nella pagina Integrazioni,
        tolta perché elencava solo canali che questo ristorante non usa —
        AI vocale, SMS, calendario. Questi due però servono davvero: sono
        l'unico posto dove il titolare può recuperarli senza chiedere aiuto. */}
    <BookingLinksPanel locations={[location]} configuredBaseUrl={baseUrl} />
    <StaffAccessLinksPanel configuredBaseUrl={baseUrl} links={[{ slug: location.slug, label: location.shortName, city: location.city, path: adminAccessPath(location) }]} />
    <SettingsPanel key={location.id} initialSettings={settings} location={location} />
    {/* Le chiusure sono record a sé, non campi del modulo: si salvano da sole,
        quindi stanno fuori dal pannello che ha un unico pulsante "Salva". */}
    {/* Preferenze del dispositivo, non della sede: stanno fuori dal pannello
        che salva sul server, perché non si salvano lì. */}
    <div className="mt-6"><NotificationSoundSettings key={location.id} location={location} /></div>
    <div className="mt-6"><ClosuresPanel key={location.id} initialClosures={closures} /></div>
    <div className="mt-6"><CapacityBandsPanel key={location.id} initialBands={capacityBands} /></div>
  </>;
}
