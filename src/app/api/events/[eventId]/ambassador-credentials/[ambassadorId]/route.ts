import { z } from "zod";
import { ambassadorCode, loadAmbassadorCredentialPdfData } from "@/lib/ambassadors/credentials";
import { requireSession } from "@/lib/auth/session";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({ eventId: z.string().uuid(), ambassadorId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string; ambassadorId: string }> }
) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return new Response("Dados inválidos.", { status: 400 });

  const admin = createAdminClient();
  try {
    const data = await loadAmbassadorCredentialPdfData(admin, {
      eventId: parsed.data.eventId,
      ambassadorIds: [parsed.data.ambassadorId],
    });
    const bytes = await generateBadgePdf(admin, data);
    const ambassador = data.participants[0];
    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "AMBASSADOR_CREDENTIAL_PRINTED",
      context: { event_id: parsed.data.eventId, ambassador_id: parsed.data.ambassadorId },
    });
    const code = typeof ambassador.participantNumber === "number"
      ? ambassadorCode(ambassador.participantNumber)
      : ambassador.participantNumber;
    return pdfResponse(bytes, `credencial-${code}.pdf`);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credencial.", { status: 400 });
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
