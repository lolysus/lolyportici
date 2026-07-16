import { PageHeading } from "@/components/admin/page-heading";
import { KnowledgeBaseEditor } from "@/components/admin/knowledge-base-editor";
import { listKnowledgeItems } from "@/domains/knowledge/knowledge-service";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
export default async function KnowledgeBasePage(){const session=await requirePermission("knowledge:write");const location=await getActiveAdminLocation(session);const items=await listKnowledgeItems(location.id);return <><PageHeading eyebrow={location.shortName} title="Knowledge base" description={`L'assistente di ${location.name} risponde esclusivamente con contenuti approvati per lingua e ristorante.`}/><KnowledgeBaseEditor initialItems={items} assistantName={location.name}/></>}
