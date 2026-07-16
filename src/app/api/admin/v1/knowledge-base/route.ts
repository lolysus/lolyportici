import { z } from "zod";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { createKnowledgeItem, listKnowledgeItems, updateKnowledgeItem } from "@/domains/knowledge/knowledge-service";
import { getAdminLocationFromRequest } from "@/lib/admin/location";

const itemSchema = z.object({
  id: z.uuid().optional(),
  category: z.string().trim().min(2).max(80),
  question: z.string().trim().min(4).max(500),
  answer: z.string().trim().max(5000),
  language: z.enum(["it", "en", "es"]),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  priority: z.number().int().min(0).max(100),
});

export async function GET(request: Request) {
  try {
    const session = await requirePermission("calls:read");
    const location = getAdminLocationFromRequest(request, session);
    return success(await listKnowledgeItems(location.id));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("knowledge:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = itemSchema.omit({ id: true }).safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    return success(await createKnowledgeItem(parsed.data, location.id), { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("knowledge:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = itemSchema.required({ id: true }).safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    return success(await updateKnowledgeItem(parsed.data, location.id));
  } catch (error) {
    return failure(error);
  }
}
