import Link from "next/link";
import Form from "next/form";
import { notFound } from "next/navigation";
import {
  CreateSponsorTeamMemberForm,
  SponsorDetailsForm,
  SponsorPasswordManagement,
  SponsorTeamMemberForm,
} from "@/app/(dashboard)/patrocinadores/[sponsorId]/management-forms";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { formatDateOnly, getSaoPauloDateKey } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

type SponsorDetailPageProps = {
  params: Promise<{ sponsorId: string }>;
  searchParams: Promise<{ evento?: string; equipe?: string }>;
};

type EventWithDays = {
  id: string;
  name: string;
  status: "rascunho" | "ativo" | "encerrado" | "arquivado";
  event_days: { date: string }[] | null;
};

function memberCode(memberNumber: number) {
  return `PAT-${String(memberNumber).padStart(6, "0")}`;
}

function selectDefaultEvent(events: EventWithDays[], requestedId?: string) {
  if (requestedId && events.some((event) => event.id === requestedId)) return requestedId;
  const today = getSaoPauloDateKey();
  const activeEvents = events
    .filter((event) => event.status === "ativo")
    .map((event) => ({ ...event, dates: (event.event_days ?? []).map((day) => day.date).sort() }))
    .filter((event) => event.dates.length > 0 && event.dates[event.dates.length - 1] >= today);
  const happening = activeEvents.find((event) => event.dates[0] <= today && event.dates[event.dates.length - 1] >= today);
  if (happening) return happening.id;
  return activeEvents.sort((left, right) => left.dates[0].localeCompare(right.dates[0]))[0]?.id ?? events[0]?.id ?? "";
}

export default async function SponsorDetailPage({ params, searchParams }: SponsorDetailPageProps) {
  const session = await requireSession(["super_adm", "organizador"]);
  const { sponsorId } = await params;
  const query = await searchParams;
  const admin = createAdminClient();

  const [{ data: sponsor }, { data: members }, { data: eventsData }, { data: records }] = await Promise.all([
    admin.from("sponsors").select("id, name, username, status, created_at").eq("id", sponsorId).maybeSingle(),
    admin.from("sponsor_team_members").select("id, member_number, full_name, job_title, status").eq("sponsor_id", sponsorId).order("status").order("full_name"),
    admin.from("events").select("id, name, status, event_days(date)").neq("status", "arquivado").order("created_at", { ascending: false }),
    admin.from("sponsor_participant_records").select("event_id, captured_at").eq("sponsor_id", sponsorId).is("invalidated_at", null),
  ]);
  if (!sponsor) notFound();

  const events = (eventsData ?? []) as EventWithDays[];
  const selectedEventId = selectDefaultEvent(events, query.evento);
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedRecords = (records ?? []).filter((record) => record.event_id === selectedEventId);
  const showInactiveMembers = query.equipe === "todos";
  const visibleMembers = (members ?? []).filter((member) => showInactiveMembers || member.status === "active");
  const eventDates = (selectedEvent?.event_days ?? []).map((day) => day.date).sort();

  return (
    <section className="space-y-6">
      <header className="surface-card rounded-xl p-5">
        <Link href="/patrocinadores" className="text-sm font-semibold text-[var(--primary)]">← Voltar para Patrocinadores</Link>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><h1 className="font-headline text-3xl font-extrabold tracking-tight">{sponsor.name}</h1><p className="mt-1 font-mono text-sm text-muted">Usuário: {sponsor.username}</p></div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-sm font-semibold ${sponsor.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{sponsor.status === "active" ? "Ativo" : "Inativo"}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--surface-container-lowest)] p-4"><p className="text-xs text-muted">Equipe ativa</p><p className="font-headline text-2xl font-bold">{(members ?? []).filter((member) => member.status === "active").length}</p></div>
          <div className="rounded-xl bg-[var(--surface-container-lowest)] p-4"><p className="text-xs text-muted">Eventos com registros</p><p className="font-headline text-2xl font-bold">{new Set((records ?? []).map((record) => record.event_id)).size}</p></div>
          <div className="rounded-xl bg-[var(--surface-container-lowest)] p-4"><p className="text-xs text-muted">Participantes registrados</p><p className="font-headline text-2xl font-bold">{records?.length ?? 0}</p></div>
        </div>
      </header>

      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-xl font-bold">Evento em contexto</h2>
        <p className="mt-1 text-sm text-muted">A seleção apenas altera a consulta e a futura impressão; não cria vínculo com o patrocinador.</p>
        <Form action={`/patrocinadores/${sponsor.id}`} scroll={false} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <select name="evento" defaultValue={selectedEventId} className="min-w-0 flex-1 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]">
            {events.map((event) => <option key={event.id} value={event.id}>{event.name} ({event.status})</option>)}
          </select>
          <SubmitButton pendingLabel="Carregando..." className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white">Selecionar</SubmitButton>
        </Form>
        {selectedEvent ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[var(--surface-container-lowest)] p-4"><p className="text-xs text-muted">Datas</p><p className="mt-1 font-semibold">{eventDates.length ? eventDates.map((date) => formatDateOnly(date)).join(" • ") : "Sem datas"}</p></div><div className="rounded-xl bg-[var(--surface-container-lowest)] p-4"><p className="text-xs text-muted">Registros neste evento</p><p className="mt-1 font-headline text-2xl font-bold">{selectedRecords.length}</p></div></div> : <p className="mt-4 text-sm text-muted">Nenhum evento disponível.</p>}
      </div>

      <SponsorDetailsForm sponsor={{ id: sponsor.id, name: sponsor.name, username: sponsor.username, status: sponsor.status }} />
      <SponsorPasswordManagement sponsorId={sponsor.id} canReveal={session.role === "super_adm"} />

      <div className="surface-card rounded-xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-headline text-xl font-bold">Equipe permanente</h2><p className="mt-1 text-sm text-muted">Integrantes servem somente para impressão de credenciais e não são participantes do evento.</p></div><Link href={`/patrocinadores/${sponsor.id}?${selectedEventId ? `evento=${selectedEventId}&` : ""}equipe=${showInactiveMembers ? "ativos" : "todos"}`} className="text-sm font-semibold text-[var(--primary)]">{showInactiveMembers ? "Mostrar somente ativos" : "Mostrar inativos"}</Link></div>
        <CreateSponsorTeamMemberForm sponsorId={sponsor.id} />
        <div className="mt-5">
          {visibleMembers.map((member) => <SponsorTeamMemberForm key={member.id} sponsorId={sponsor.id} member={{ id: member.id, fullName: member.full_name, jobTitle: member.job_title, status: member.status, code: memberCode(member.member_number) }} />)}
          {!visibleMembers.length ? <p className="py-8 text-center text-sm text-muted">Nenhum integrante neste filtro.</p> : null}
        </div>
      </div>
    </section>
  );
}

