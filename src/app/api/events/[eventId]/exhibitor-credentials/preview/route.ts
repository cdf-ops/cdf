import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccessibleEventExhibitor } from "@/lib/exhibitors/access";
import { loadExhibitorCredentialPdfData } from "@/lib/exhibitor-credentials/data";
import { generateExhibitorCredentialPdf } from "@/lib/exhibitor-credentials/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

export async function GET(
  request: Request,
  context: RouteContext<"/api/events/[eventId]/exhibitor-credentials/preview">
) {
  const session = await getCurrentSession();
  if (!session) return new Response("Não autenticado.", { status: 401 });
  if (!["super_adm", "organizador", "expositor"].includes(session.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { eventId } = await context.params;
  const companyId = new URL(request.url).searchParams.get("empresa") ?? "";
  if (!uuidSchema.safeParse(companyId).success) {
    return new Response("Empresa inválida.", { status: 400 });
  }

  const eventExhibitor = await getAccessibleEventExhibitor(session, eventId, companyId);
  if (!eventExhibitor) return new Response("Empresa não vinculada a este evento.", { status: 403 });

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("exhibitor_team_members")
    .select("id")
    .eq("exhibitor_company_id", companyId)
    .eq("status", "active")
    .order("full_name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!member) return new Response("Cadastre uma pessoa ativa na equipe para visualizar a prévia.", { status: 400 });

  try {
    const data = await loadExhibitorCredentialPdfData(admin, eventExhibitor.id, [member.id]);
    const bytes = await generateExhibitorCredentialPdf(admin, data);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="previa-credencial-equipe.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar prévia.", { status: 400 });
  }
}
