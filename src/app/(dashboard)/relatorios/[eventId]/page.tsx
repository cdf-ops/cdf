import Form from "next/form";
import { notFound } from "next/navigation";
import {
  EventReportsView,
  type ReportSearchParams,
} from "@/app/(dashboard)/events/[eventId]/relatorios/page";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/date-time";
import { getGlobalReportEvents } from "@/lib/reports/global-report-events";

type GlobalEventReportsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<ReportSearchParams>;
};

function eventLabel(event: Awaited<ReturnType<typeof getGlobalReportEvents>>[number]) {
  if (!event.dates.length) return `${event.name} · sem datas · ${event.status}`;
  const first = formatDateOnly(event.dates[0], { day: "2-digit", month: "2-digit", year: "numeric" });
  const last = formatDateOnly(event.dates[event.dates.length - 1], { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${event.name} · ${first}${first === last ? "" : ` a ${last}`} · ${event.status}`;
}

export default async function GlobalEventReportsPage({ params, searchParams }: GlobalEventReportsPageProps) {
  const session = await requireSession(["super_adm", "organizador"]);
  const [{ eventId }, query, events] = await Promise.all([params, searchParams, getGlobalReportEvents()]);
  if (!events.some((event) => event.id === eventId)) notFound();

  return (
    <div className="space-y-6">
      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Visão global</p>
            <h1 className="mt-1 font-headline text-3xl font-extrabold">Central de Relatórios</h1>
            <p className="mt-2 text-sm text-muted">Selecione qualquer evento, independentemente do status.</p>
          </div>
          <Form action="/relatorios" className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
            <div className="min-w-0 flex-1">
              <label htmlFor="global-report-event" className="sr-only">Evento</label>
              <select id="global-report-event" name="event" defaultValue={eventId} className="min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm font-semibold">
                {events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}
              </select>
            </div>
            <SubmitButton pendingLabel="Carregando..." className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white">Ver evento</SubmitButton>
          </Form>
        </div>
      </section>

      <EventReportsView
        eventId={eventId}
        query={query}
        role={session.role}
        navigation={{
          basePath: `/relatorios/${eventId}`,
          overviewPath: `/events/${eventId}/lista-do-dia?scope=event`,
        }}
      />
    </div>
  );
}
