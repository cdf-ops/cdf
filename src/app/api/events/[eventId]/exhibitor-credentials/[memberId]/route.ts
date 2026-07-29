import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccessibleEventExhibitor } from "@/lib/exhibitors/access";
import {
  loadExhibitorCredentialPdfData,
  recordExhibitorCredentialPrints,
} from "@/lib/exhibitor-credentials/data";
import { generateExhibitorCredentialPdf } from "@/lib/exhibitor-credentials/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

export async function GET(
  request: Request,
  context: RouteContext<"/api/events/[eventId]/exhibitor-credentials/[memberId]">
) {
  const session = await getCurrentSession();
  if (!session) return new Response("Não autenticado.", { status: 401 });
  if (!["super_adm", "organizador", "expositor"].includes(session.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { eventId, memberId } = await context.params;
  const companyId = new URL(request.url).searchParams.get("empresa") ?? "";
  if (!uuidSchema.safeParse(companyId).success || !uuidSchema.safeParse(memberId).success) {
    return new Response("Dados inválidos.", { status: 400 });
  }

  const eventExhibitor = await getAccessibleEventExhibitor(session, eventId, companyId);
  if (!eventExhibitor) return new Response("Empresa não vinculada a este evento.", { status: 403 });

  const admin = createAdminClient();
  try {
    const data = await loadExhibitorCredentialPdfData(admin, eventExhibitor.id, [memberId]);
    const bytes = await generateExhibitorCredentialPdf(admin, data);
    await recordExhibitorCredentialPrints(admin, {
      eventExhibitorId: eventExhibitor.id,
      memberIds: [memberId],
      userId: session.userId,
    });
    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "EXHIBITOR_CREDENTIAL_PRINTED",
      context: { event_id: eventId, exhibitor_company_id: companyId, team_member_id: memberId },
    });

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="credencial-expositor-${memberId}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credencial.", { status: 400 });
  }
}
