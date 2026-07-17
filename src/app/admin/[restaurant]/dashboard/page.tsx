import { notFound, redirect } from "next/navigation";
import DashboardPage from "@/app/admin/dashboard/page";
import { getRestaurantLocationBySlug } from "@/config/brand";
import { canAccessAdminLocation, getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";

const operatorRestaurantSlugs = new Set(["yuko", "kousushi"]);

export default async function RestaurantOperatorDashboard({ params }: { params: Promise<{ restaurant: string }> }) {
  const { restaurant: slug } = await params;
  const location = operatorRestaurantSlugs.has(slug) ? getRestaurantLocationBySlug(slug) : undefined;
  if (!location) notFound();

  const session = await requirePermission("reservations:read");
  if (!canAccessAdminLocation(session, location.id)) redirect("/admin/dashboard");

  const activeLocation = await getActiveAdminLocation(session);
  if (activeLocation.slug !== location.slug) redirect(`/admin/${location.slug}`);

  return <DashboardPage />;
}
