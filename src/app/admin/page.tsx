import { redirect } from "next/navigation";
import { getAccessibleAdminLocations } from "@/lib/admin/location";
import { requireStaffSession } from "@/lib/auth/dal";

/**
 * `/admin` non è una pagina: è il ramo di un ristorante, o niente. Chi arriva
 * qui viene portato nel pannello della propria sede.
 */
export default async function AdminPage() {
  const session = await requireStaffSession();
  const own = getAccessibleAdminLocations(session)[0];
  redirect(own ? `/admin/${own.slug}/dashboard` : "/login");
}
