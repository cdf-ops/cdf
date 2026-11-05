import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateOnly } from "@/lib/date-time";
import { sponsorMemberCode } from "@/lib/sponsors/credentials";
import { requireSponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SponsorCredentialsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireSponsorSession();
  const { eventId } = await params;
  const admin = createAdminClient();
  const [{ data: event }, { data: days }, { data: members }] = await Promise.all([
    admin.from("events").select("id, name, location, status").eq("id", eventId).maybeSingle(),
    admin.from("event_days").select("date").eq("event_id", eventId).order("date"),
    admin
      .from("sponsor_team_members")
      .select("id, member_number, full_name, job_title")
      .eq("sponsor_id", session.sponsorId)
      .eq("status", "active")
      .order("full_name"),
  ]);
  const dates = (days ?? []).map((day) => day.date);
  if (!event || event.status !== "ativo" || !dates.length) notFound();
  const action = `/api/patrocinador/eventos/${eventId}/credenciais`;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b bg-white"><div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-4 px-4 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary)]">Credenciais da equipe</p><h1 className="mt-1 font-headline text-2xl font-extrabold">{event.name}</h1><p className="text-sm text-muted">{event.location} · {dates.map((date) => formatDateOnly(date)).join(" • ")}</p></div><Link href="/patrocinador/portal" className="min-h-11 rounded-xl border bg-white px-4 py-3 text-sm font-semibold">Voltar</Link></div></header>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
        <form action={action} method="post" target="_blank" className="surface-card rounded-2xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-headline text-xl font-extrabold">Equipe ativa</h2><p className="mt-1 text-sm text-muted">Selecione as pessoas. Cada integrante será gerado em uma página A4.</p></div><button disabled={!members?.length} className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40">Imprimir selecionados</button></div>
          <div className="mt-5 divide-y divide-[var(--outline-variant)]/30">
            {(members ?? []).map((member) => <div key={member.id} className="grid gap-3 py-4 sm:grid-cols-[auto_120px_1fr_1fr_auto] sm:items-center"><input aria-label={`Selecionar ${member.full_name}`} type="checkbox" name="member_ids" value={member.id} defaultChecked className="size-5 accent-[var(--primary)]" /><span className="font-mono text-sm font-bold">{sponsorMemberCode(member.member_number)}</span><strong>{member.full_name}</strong><span className="text-sm text-muted">{member.job_title ?? "Sem cargo"}</span><a href={`${action}?membro=${member.id}`} target="_blank" rel="noreferrer" className="rounded-xl border bg-white px-4 py-2.5 text-center text-sm font-semibold text-[var(--primary)]">Imprimir individual</a></div>)}
            {!members?.length ? <p className="py-10 text-center text-sm text-muted">Cadastre ao menos um integrante ativo antes de imprimir.</p> : null}
          </div>
        </form>
      </div>
    </main>
  );
}
