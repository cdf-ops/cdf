import { extractCredentialSlug } from "@/lib/badges/tokens";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/credencial/[token]">) {
  const { token } = await context.params;
  const downloadSlug = extractCredentialSlug(token);
  if (!downloadSlug) return new Response("Credencial inválida.", { status: 404 });

  const admin = createAdminClient();
  const { data: badge } = await admin
    .from("badges")
    .select("id, event_id, participant_id, qr_slug")
    .eq("download_slug", downloadSlug)
    .maybeSingle();
  if (!badge) return new Response("Credencial não encontrada.", { status: 404 });

  const [{ data: event }, { data: participant }, { data: days }, { data: settings }] = await Promise.all([
    admin.from("events").select("id, name, location, details, event_logo_path").eq("id", badge.event_id).maybeSingle(),
    admin.from("participants").select("full_name, participant_number").eq("id", badge.participant_id).maybeSingle(),
    admin.from("event_days").select("date").eq("event_id", badge.event_id).order("date", { ascending: true }),
    admin.from("event_badge_settings").select("*").eq("event_id", badge.event_id).maybeSingle(),
  ]);
  if (!event || !participant) return new Response("Dados da credencial indisponíveis.", { status: 404 });

  const bytes = await generateBadgePdf(admin, {
    event: {
      id: event.id,
      name: event.name,
      location: event.location,
      details: event.details,
      eventLogoPath: event.event_logo_path,
      dates: (days ?? []).map((day) => day.date),
    },
    participants: [
      {
        fullName: participant.full_name,
        participantNumber: participant.participant_number,
        qrSlug: badge.qr_slug,
      },
    ],
    settings,
  });

  await admin.from("audit_logs").insert({
    actor_user_id: null,
    action: "BADGE_DOWNLOADED",
    context: { event_id: badge.event_id, participant_id: badge.participant_id, badge_id: badge.id },
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="credencial-${participant.participant_number}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
