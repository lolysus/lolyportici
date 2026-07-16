import { PageHeading } from "@/components/admin/page-heading";
import { WaitlistBoard } from "@/components/admin/waitlist-board";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";
import { getActiveAdminLocation } from "@/lib/admin/location";
export default async function WaitlistPage() { await requirePermission("reservations:read"); const location=await getActiveAdminLocation(); const entries = await getRepository(location.id).listWaitlist(); const version=entries.map((row)=>`${row.id}:${row.status}:${row.priority}`).join("|"); return <><PageHeading eyebrow={location.shortName} title="Lista d'attesa" description={`Richieste e offerte temporanee della sede di ${location.city}.`} /><WaitlistBoard key={version} initialEntries={entries} /></>; }
