import { getCurrentSession } from "@/lib/auth/session";
import { loadEventBadgePdfData } from "@/lib/badges/data";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/events/[eventId]/credentials/[participantId]">) {
  const session = await getCurrentSession();
  if (!session) return new Response("Não autenticado.", { status: 401 });
  if (session.role !== "super_adm" && session.role !== "organizador") {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { eventId, participantId } = await context.params;
  const admin = createAdminClient();
  try {
    const data = await loadEventBadgePdfData(admin, eventId, [participantId], session.userId);
    const bytes = await generateBadgePdf(admin, data);
    const participant = data.participants[0];
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="credencial-${participant.participantNumber}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credencial.", { status: 400 });
  }
}
