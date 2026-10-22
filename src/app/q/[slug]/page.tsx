import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { extractCredentialSlug } from "@/lib/badges/tokens";
import { getClosestEventDayId } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function BadgeQrPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { slug: rawSlug } = await params;
  const slug = extractCredentialSlug(rawSlug);
  if (!slug) notFound();

  const admin = createAdminClient();
  const { data: badge } = await admin.from("badges").select("event_id").eq("qr_slug", slug).maybeSingle();
  let eventId = badge?.event_id;
  if (!eventId) {
    const { data: sponsorCredential } = await admin
      .from("exhibitor_credentials")
      .select("event_exhibitor_id")
      .eq("qr_slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (sponsorCredential) {
      const { data: eventSponsor } = await admin
        .from("event_exhibitors")
        .select("event_id")
        .eq("id", sponsorCredential.event_exhibitor_id)
        .maybeSingle();
      eventId = eventSponsor?.event_id;
    }
  }
  if (!eventId) notFound();
  const { data: days } = await admin.from("event_days").select("id, date").eq("event_id", eventId).order("date");
  const selectedDayId = getClosestEventDayId(days ?? []);
  if (!selectedDayId) notFound();
  if (session.role === "expositor") {
    redirect(`/events/${eventId}/checkin-expositor?day=${selectedDayId}&scan=${encodeURIComponent(slug)}`);
  }
  if (["super_adm", "organizador", "recepcao"].includes(session.role)) {
    redirect(`/events/${eventId}/checkin-recepcao?day=${selectedDayId}&scan=${encodeURIComponent(slug)}`);
  }
  redirect("/forbidden");
}
