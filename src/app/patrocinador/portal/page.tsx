import { sponsorLogoutAction } from "@/app/patrocinador/actions";
import Link from "next/link";
import { SponsorPortalCreateMemberForm, SponsorPortalMemberForm } from "@/app/patrocinador/portal/team-forms";
import { SubmitButton } from "@/components/submit-button";
import { formatDateOnly, getSaoPauloDateKey } from "@/lib/date-time";
import { requireSponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

type EventWithDays = {
  id: string;
  name: string;
  location: string;
  event_days: { date: string }[] | null;
};

function memberCode(memberNumber: number) {
  return `PAT-${String(memberNumber).padStart(6, "0")}`;
}

export default async function SponsorPortalPage() {
  const session = await requireSponsorSession();
  const admin = createAdminClient();
  const today = getSaoPauloDateKey();
  const [{ data: members }, { data: eventsData }, { data: records }] = await Promise.all([
    admin.from("sponsor_team_members").select("id, member_number, full_name, job_title, status").eq("sponsor_id", session.sponsorId).order("status").order("full_name"),
    admin.from("events").select("id, name, location, event_days(date)").eq("status", "ativo").order("created_at"),
    admin.from("sponsor_participant_records").select("event_id, captured_at").eq("sponsor_id", session.sponsorId).is("invalidated_at", null),
  ]);
  const events = ((eventsData ?? []) as EventWithDays[])
    .map((event) => ({ ...event, dates: (event.event_days ?? []).map((day) => day.date).sort() }))
    .filter((event) => event.dates.length > 0 && event.dates[event.dates.length - 1] >= today)
    .sort((left, right) => left.dates[0].localeCompare(right.dates[0]));

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--outline-variant)]/25 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary)]">Portal do patrocinador</p><p className="mt-1 font-headline text-xl font-extrabold">{session.sponsorName}</p></div>
          <form action={sponsorLogoutAction}><SubmitButton pendingLabel="Saindo..." className="min-h-11 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 text-sm font-semibold">Sair</SubmitButton></form>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="surface-card rounded-2xl p-5"><p className="text-sm text-muted">Equipe ativa</p><p className="mt-2 font-headline text-3xl font-extrabold">{(members ?? []).filter((member) => member.status === "active").length}</p></div>
          <div className="surface-card rounded-2xl p-5"><p className="text-sm text-muted">Próximos eventos</p><p className="mt-2 font-headline text-3xl font-extrabold">{events.length}</p></div>
          <div className="surface-card rounded-2xl p-5"><p className="text-sm text-muted">Registros no estande</p><p className="mt-2 font-headline text-3xl font-extrabold">{records?.length ?? 0}</p></div>
        </section>

        <section>
          <h1 className="font-headline text-2xl font-extrabold">Eventos disponíveis</h1>
          <p className="mt-1 text-sm text-muted">Credenciais podem ser preparadas antes do evento; a leitura será liberada somente durante as datas.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {events.map((event) => {
              const happening = event.dates[0] <= today && event.dates[event.dates.length - 1] >= today;
              const count = (records ?? []).filter((record) => record.event_id === event.id).length;
              return <article key={event.id} className="surface-card rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-headline text-xl font-bold">{event.name}</h2><p className="mt-1 text-sm text-muted">{event.location}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${happening ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{happening ? "Acontecendo" : "Futuro"}</span></div><p className="mt-4 text-sm font-semibold">{event.dates.map((date) => formatDateOnly(date)).join(" • ")}</p><div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--surface-container-lowest)] px-4 py-3"><span className="text-sm text-muted">Participantes registrados</span><strong>{count}</strong></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><Link href={`/patrocinador/portal/eventos/${event.id}/credenciais`} className="min-h-11 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--primary)]">Imprimir credenciais</Link>{happening ? <Link href={`/patrocinador/portal/eventos/${event.id}`} className="gradient-primary min-h-11 rounded-xl px-4 py-3 text-center text-sm font-semibold text-white">Ler credencial</Link> : <button type="button" disabled className="gradient-primary min-h-11 rounded-xl px-4 text-sm font-semibold text-white opacity-40">Leitura no dia</button>}</div></article>;
            })}
            {!events.length ? <div className="surface-card rounded-2xl p-8 text-center text-sm text-muted lg:col-span-2">Nenhum evento ativo futuro ou acontecendo.</div> : null}
          </div>
        </section>

        <section className="surface-card rounded-2xl p-5">
          <h2 className="font-headline text-2xl font-extrabold">Equipe permanente</h2>
          <p className="mt-1 text-sm text-muted">Cadastre apenas nome e, se quiser, cargo. Esses integrantes não entram como participantes do evento.</p>
          <SponsorPortalCreateMemberForm />
          <div className="mt-5">
            {(members ?? []).map((member) => <SponsorPortalMemberForm key={member.id} member={{ id: member.id, code: memberCode(member.member_number), fullName: member.full_name, jobTitle: member.job_title, status: member.status }} />)}
            {!members?.length ? <p className="py-8 text-center text-sm text-muted">Nenhum integrante cadastrado.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

