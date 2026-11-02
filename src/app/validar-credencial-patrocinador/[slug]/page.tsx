import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { extractCredentialSlug } from "@/lib/badges/tokens";
import { formatDateOnly } from "@/lib/date-time";
import { sponsorMemberCode } from "@/lib/sponsors/credentials";
import { getSponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ValidateSponsorCredentialPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = extractCredentialSlug((await params).slug);
  if (!slug) notFound();
  const admin = createAdminClient();
  const { data: credential } = await admin
    .from("sponsor_team_credentials")
    .select("sponsor_id, team_member_id, event_id")
    .eq("qr_slug", slug)
    .maybeSingle();
  if (!credential) notFound();

  const [session, sponsorSession] = await Promise.all([getCurrentSession(), getSponsorSession()]);
  const adminAllowed = session && ["super_adm", "organizador", "recepcao"].includes(session.role);
  const sponsorAllowed = sponsorSession?.sponsorId === credential.sponsor_id;
  if (!adminAllowed && !sponsorAllowed) {
    if (session || sponsorSession) redirect("/forbidden");
    redirect(`/login?next=${encodeURIComponent(`/q/${slug}`)}`);
  }

  const [{ data: sponsor }, { data: member }, { data: event }, { data: days }] = await Promise.all([
    admin.from("sponsors").select("name, status").eq("id", credential.sponsor_id).maybeSingle(),
    admin
      .from("sponsor_team_members")
      .select("member_number, full_name, job_title, status")
      .eq("id", credential.team_member_id)
      .eq("sponsor_id", credential.sponsor_id)
      .maybeSingle(),
    admin.from("events").select("name, location, status").eq("id", credential.event_id).maybeSingle(),
    admin.from("event_days").select("date").eq("event_id", credential.event_id).order("date"),
  ]);
  if (!sponsor || !member || !event) notFound();
  const valid = sponsor.status === "active" && member.status === "active" && event.status === "ativo";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4">
      <section className="w-full max-w-xl rounded-3xl bg-white p-6 text-center shadow-xl sm:p-8">
        <div className={`mx-auto grid size-20 place-items-center rounded-full text-4xl font-black ${valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{valid ? "✓" : "×"}</div>
        <p className={`mt-4 text-sm font-bold uppercase tracking-[0.18em] ${valid ? "text-emerald-700" : "text-red-700"}`}>{valid ? "Credencial válida" : "Credencial inválida"}</p>
        <h1 className="mt-3 font-headline text-3xl font-extrabold">{member.full_name}</h1>
        <p className="mt-2 font-mono text-lg font-bold">{sponsorMemberCode(member.member_number)}</p>
        <dl className="mt-6 grid gap-3 rounded-2xl bg-[var(--surface-container-lowest)] p-5 text-left text-sm">
          <div><dt className="font-bold">Patrocinador</dt><dd>{sponsor.name}</dd></div>
          {member.job_title ? <div><dt className="font-bold">Cargo</dt><dd>{member.job_title}</dd></div> : null}
          <div><dt className="font-bold">Evento</dt><dd>{event.name}</dd></div>
          <div><dt className="font-bold">Local</dt><dd>{event.location}</dd></div>
          <div><dt className="font-bold">Datas</dt><dd>{(days ?? []).map((day) => formatDateOnly(day.date)).join(" • ")}</dd></div>
        </dl>
        <p className="mt-5 text-sm text-muted">Esta validação não registra presença nem check-in.</p>
        <Link href={sponsorSession ? "/patrocinador/portal" : "/events"} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-5 font-semibold text-white">Voltar</Link>
      </section>
    </main>
  );
}
