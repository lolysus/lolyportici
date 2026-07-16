import { PageHeading } from "@/components/admin/page-heading";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveAdminLocation } from "@/lib/admin/location";
export default async function AnalyticsPage(){await requirePermission("analytics:read");const location=await getActiveAdminLocation();return <><PageHeading eyebrow={location.shortName} title="Analytics" description={`Performance e mix dei canali della sede di ${location.city}.`}/><AnalyticsView location={location}/></>}

