import { PageHeading } from "@/components/admin/page-heading";
import { StaffAccessManager } from "@/components/admin/staff-access-manager";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { listAccountsForLocation } from "@/lib/auth/staff-accounts";
import { requirePermission } from "@/lib/auth/dal";

/**
 * Chi ha accesso a questa sede, letto da dove il login lo legge.
 *
 * Un account per sede, non un team: Ardea e Portici hanno ciascuna un unico
 * accesso, e questa pagina lo mostra così com'è invece di offrire inviti e
 * ruoli che non esistono qui.
 */
export default async function StaffPage() {
  const session = await requirePermission("staff:write");
  const location = await getActiveAdminLocation(session);
  const [account] = await listAccountsForLocation(location.id);

  return <>
    <PageHeading
      eyebrow={location.shortName}
      title="Personale"
      description={`L'unico accesso al pannello di ${location.city}. Il personale delle altre sedi non compare e non è raggiungibile da qui.`}
    />
    {account && <StaffAccessManager key={location.id} account={{ id: account.id, name: account.name, email: account.email, role: account.role, locationName: location.shortName }} />}
    <p className="mt-6 rounded-xl border border-dashed bg-card p-4 text-sm leading-6 text-muted-foreground">
      <strong className="text-foreground">Un solo account per sede, di proposito:</strong> per aggiungerne un&apos;altro va chiesto
      a chi gestisce la piattaforma, indicando nome, email di lavoro e ruolo. Per cambiare questa password si usa
      <em> Non la ricordo</em> nella pagina di accesso — arriva un link alla stessa casella dell&apos;account.
    </p>
  </>;
}
