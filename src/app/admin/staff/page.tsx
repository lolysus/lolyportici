import { PageHeading } from "@/components/admin/page-heading";
import { StaffAccessManager, type StaffAccessRow } from "@/components/admin/staff-access-manager";
import { isRestaurantLead } from "@/config/permissions";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { listAccountsForLocation } from "@/lib/auth/staff-accounts";
import { requirePermission } from "@/lib/auth/dal";

/**
 * Chi ha accesso a questa sede, letto da dove il login lo legge.
 *
 * Prima interrogava Supabase, che in produzione non è configurato: la pagina
 * finiva nella schermata di errore, e il ripiego previsto erano due account
 * inventati con indirizzi @example.test. La fonte vera è `staff_accounts`.
 */
export default async function StaffPage() {
  const session = await requirePermission("staff:write");
  const location = await getActiveAdminLocation(session);
  const accounts = await listAccountsForLocation(location.id);
  const staff: StaffAccessRow[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    status: "active",
    locationName: location.shortName,
    isCurrent: account.email.toLowerCase() === session.email.toLowerCase(),
    isOwner: account.role === "owner",
    // Nessuno può togliersi da solo l'accesso da questa pagina.
    isProtected: account.email.toLowerCase() === session.email.toLowerCase(),
  }));

  return <>
    <PageHeading
      eyebrow={location.shortName}
      title="Personale e permessi"
      description={`Account che entrano nel pannello di ${location.city}. Il personale delle altre sedi non compare e non è modificabile da qui.`}
    />
    <StaffAccessManager key={location.id} initialStaff={staff} canAssignAdministrator={isRestaurantLead(session.role)} />
    {/* L'invito via email non è disponibile: dipende da Supabase, che in
        produzione non è configurato, e il modulo rispondeva "Invito inviato"
        senza invitare nessuno. Meglio dire come si fa davvero. */}
    <p className="mt-6 rounded-xl border border-dashed bg-card p-4 text-sm leading-6 text-muted-foreground">
      <strong className="text-foreground">Per aggiungere una persona</strong> serve creare l’account a mano: l’invito via email
      non è ancora attivo. Chiedilo a chi gestisce la piattaforma, indicando nome, email di lavoro e ruolo.
      Chi ha già un account può cambiare la propria password da <em>Non la ricordo</em> nella pagina di accesso.
    </p>
  </>;
}
