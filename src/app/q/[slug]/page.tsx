import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { extractCredentialSlug } from "@/lib/badges/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function BadgeQrPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession(["super_adm", "organizador", "recepcao"]);
  const { slug: rawSlug } = await params;
  const slug = extractCredentialSlug(rawSlug);
  if (!slug) notFound();

  const admin = createAdminClient();
  const { data: badge } = await admin.from("badges").select("event_id").eq("qr_slug", slug).maybeSingle();
  if (!badge) notFound();
  const { data: days } = await admin.from("event_days").select("id, date").eq("event_id", badge.event_id).order("date");
  const selectedDay = (days ?? []).find((day) => day.date === todayInSaoPaulo()) ?? days?.[0];
  if (!selectedDay) notFound();
  redirect(`/events/${badge.event_id}/checkin-recepcao?day=${selectedDay.id}&scan=${encodeURIComponent(slug)}`);
}
