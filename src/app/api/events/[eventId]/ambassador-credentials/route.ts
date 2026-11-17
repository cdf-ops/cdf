import { z } from "zod";
import { loadAmbassadorCredentialPdfData } from "@/lib/ambassadors/credentials";
import { requireSession } from "@/lib/auth/session";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const session = await requireSession(["super_adm", "organizador"]);
  const { eventId } = await context.params;
  if (!idSchema.safeParse(eventId).success) return new Response("Evento inválido.", { status: 400 });

  const formData = await request.formData();
  const ambassadorIds = [...new Set(formData.getAll("ambassador_ids").map(String))].filter((id) => idSchema.safeParse(id).success);
  if (!ambassadorIds.length) return new Response("Selecione ao menos um embaixador.", { status: 400 });

  const admin = createAdminClient();
  try {
    const data = await loadAmbassadorCredentialPdfData(admin, { eventId, ambassadorIds });
    const bytes = await generateBadgePdf(admin, data);
    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "AMBASSADOR_CREDENTIALS_BATCH_PRINTED",
      context: { event_id: eventId, ambassador_ids: data.participants.map((item) => item.id), count: data.participants.length },
    });
    return pdfResponse(bytes, `credenciais-embaixadores-${eventId}.pdf`);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credenciais.", { status: 400 });
  }
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
