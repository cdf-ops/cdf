import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import {
  formatDateOnly,
  formatSaoPauloDateTime,
  formatSaoPauloTime,
  getClosestEventDayId,
} from "@/lib/date-time";
import { getEventReportFoundation } from "@/lib/reports/event-report-foundation";

type MonitoringPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ day?: string; q?: string; scope?: string }>;
};

type MonitoringScope = "day" | "event";

const CHECKIN_ORIGIN_LABELS: Record<string, string> = {
  recepcao: "Recepção",
  manual: "Busca manual",
  manual_include_day: "Incluído na hora",
  qr_code: "QR Code",
  credential_print: "Impressão de credencial",
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildMonitoringHref(eventId: string, values: { scope: MonitoringScope; dayId: string; q?: string }) {
  const params = new URLSearchParams({ scope: values.scope, day: values.dayId });
  if (values.q?.trim()) params.set("q", values.q.trim());
  return `/events/${eventId}/lista-do-dia?${params.toString()}`;
}

export default async function MonitoringPage({ params, searchParams }: MonitoringPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { day, q = "", scope: rawScope } = await searchParams;
  const foundation = await getEventReportFoundation(eventId);
  if (!foundation) notFound();

  const eventDays = foundation.days;
  if (!eventDays.length) {
    return (
      <section className="surface-card rounded-xl p-6">
        <h1 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Monitoramento</h1>
        <p className="mt-2 text-sm text-muted">Este evento ainda não possui datas configuradas.</p>
      </section>
    );
  }

  const scope: MonitoringScope = rawScope === "event" ? "event" : "day";
  const selectedDayId = eventDays.some((item) => item.id === day)
    ? String(day)
    : getClosestEventDayId(eventDays);
  const selectedDay = eventDays.find((item) => item.id === selectedDayId) ?? eventDays[0];
  const relevantDays = scope === "event" ? eventDays : [selectedDay];
  const relevantDayIds = new Set(relevantDays.map((item) => item.id));
  const relevantRegistrations = foundation.registrations.filter((item) => relevantDayIds.has(item.eventDayId));
  const relevantCheckins = foundation.officialCheckins.filter((item) => relevantDayIds.has(item.eventDayId));
  const registeredParticipantIds = unique(relevantRegistrations.map((item) => item.participantId));
  const expectedParticipantIds = unique(relevantDays.flatMap((item) => item.uniqueExpectedParticipantIds));
  const presentParticipantIds = unique(relevantCheckins.map((item) => item.participantId));
  const presentSet = new Set(presentParticipantIds);
  const absentExpectedParticipantIds = expectedParticipantIds.filter((participantId) => !presentSet.has(participantId));
  const presentExpectedCount = expectedParticipantIds.filter((participantId) => presentSet.has(participantId)).length;
  const presenceRate = expectedParticipantIds.length
    ? Math.round((presentExpectedCount / expectedParticipantIds.length) * 10_000) / 100
    : 0;
  const expectedSlots = relevantDays.reduce((total, item) => total + item.expectedRegistrations.length, 0);
  const onsiteSlots = relevantDays.reduce((total, item) => total + item.onsiteRegistrations.length, 0);
  const dayById = new Map(eventDays.map((item) => [item.id, item]));
  const registrationByParticipantDay = new Map(
    foundation.registrations.map((registration) => [
      `${registration.participantId}:${registration.eventDayId}`,
      registration,
    ])
  );
  const queryText = q.trim().toLocaleLowerCase("pt-BR");
  const checkinRows = relevantCheckins
    .map((checkin) => {
      const participant = foundation.participantsById.get(checkin.participantId);
      const eventDay = dayById.get(checkin.eventDayId);
      const registration = registrationByParticipantDay.get(`${checkin.participantId}:${checkin.eventDayId}`);
      const registrationType = registration && eventDay && registration.createdAt >= eventDay.cutoff
        ? "Inscrição no local"
        : registration
          ? "Inscrição prevista"
          : "Sem inscrição prévia";
      return { checkin, participant, eventDay, registrationType };
    })
    .filter((row) => {
      if (!queryText) return true;
      const searchable = [
        row.participant?.fullName ?? "",
        row.participant?.participantNumber ?? "",
        row.participant?.documentType ?? "",
        row.participant?.documentNumber ?? "",
        row.registrationType,
        CHECKIN_ORIGIN_LABELS[row.checkin.origin] ?? row.checkin.origin,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return searchable.includes(queryText);
    })
    .sort((left, right) => right.checkin.checkedInAt.localeCompare(left.checkin.checkedInAt));
  const updatedAt = new Date().toISOString();
  const dayHref = buildMonitoringHref(eventId, { scope: "day", dayId: selectedDayId, q });
  const eventHref = buildMonitoringHref(eventId, { scope: "event", dayId: selectedDayId, q });

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Operação do evento</p>
            <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-4xl">
              Monitoramento
            </h1>
            <p className="mt-2 text-sm text-muted">
              Presenças oficiais da recepção. Capturas realizadas por patrocinadores não entram nestes números.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-xl bg-[var(--surface-container)] p-1" aria-label="Período do monitoramento">
              <Link
                href={dayHref}
                aria-current={scope === "day" ? "page" : undefined}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  scope === "day" ? "bg-white text-[var(--primary)] shadow-sm" : "text-muted hover:text-[var(--foreground)]"
                }`}
              >
                Por dia
              </Link>
              <Link
                href={eventHref}
                aria-current={scope === "event" ? "page" : undefined}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  scope === "event" ? "bg-white text-[var(--primary)] shadow-sm" : "text-muted hover:text-[var(--foreground)]"
                }`}
              >
                Evento inteiro
              </Link>
            </div>

            <Form action={`/events/${eventId}/lista-do-dia`} scroll={false}>
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="day" value={selectedDayId} />
              <input type="hidden" name="q" value={q} />
              <SubmitButton
                pendingLabel="Atualizando..."
                className="gradient-primary min-h-11 w-full rounded-xl px-4 text-sm font-bold text-white sm:w-auto"
              >
                Atualizar agora
              </SubmitButton>
            </Form>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--outline-variant)]/35 pt-4 sm:flex-row sm:items-end sm:justify-between">
          {scope === "day" ? (
            <Form action={`/events/${eventId}/lista-do-dia`} scroll={false} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="scope" value="day" />
              <input type="hidden" name="q" value={q} />
              <div>
                <label htmlFor="monitoring-day" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
                  Dia monitorado
                </label>
                <select
                  id="monitoring-day"
                  name="day"
                  defaultValue={selectedDayId}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 text-sm font-semibold outline-none focus:border-[var(--primary)] sm:w-auto"
                >
                  {eventDays.map((item) => (
                    <option key={item.id} value={item.id}>{formatDateOnly(item.date)}</option>
                  ))}
                </select>
              </div>
              <SubmitButton
                pendingLabel="Carregando..."
                className="ghost-border min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[var(--foreground)]"
              >
                Aplicar
              </SubmitButton>
            </Form>
          ) : (
            <p className="text-sm font-semibold text-[var(--foreground)]">Consolidado de todos os dias do evento</p>
          )}
          <p className="text-xs text-muted">Última atualização: {formatSaoPauloDateTime(updatedAt)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {[
          { label: "Inscritos únicos", value: registeredParticipantIds.length, detail: `${relevantRegistrations.length} participações` },
          { label: "Previstos", value: expectedParticipantIds.length, detail: `${expectedSlots} participações previstas` },
          { label: "Inscrições no local", value: onsiteSlots, detail: "A partir de 00h do dia" },
          { label: "Presentes únicos", value: presentParticipantIds.length, detail: `${relevantCheckins.length} presenças acumuladas` },
          { label: "Ausentes previstos", value: absentExpectedParticipantIds.length, detail: "Previstos ainda sem entrada" },
          { label: "Presença dos previstos", value: `${presenceRate}%`, detail: `${presentExpectedCount} de ${expectedParticipantIds.length}` },
        ].map((metric) => (
          <div key={metric.label} className="surface-card rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">{metric.label}</p>
            <p className="mt-2 font-headline text-3xl font-extrabold text-[var(--foreground)]">{metric.value}</p>
            <p className="mt-1 text-xs text-muted">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">
                {scope === "day" ? `Movimento de ${formatDateOnly(selectedDay.date)}` : "Movimento por dia"}
              </h2>
              <p className="mt-1 text-sm text-muted">Tabela operacional baseada somente nos check-ins oficiais de entrada.</p>
            </div>
            <Form
              action={`/events/${eventId}/lista-do-dia`}
              scroll={false}
              className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:max-w-xl"
            >
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="day" value={selectedDayId} />
              <label htmlFor="monitoring-search" className="sr-only">Buscar participante</label>
              <input
                id="monitoring-search"
                name="q"
                defaultValue={q}
                placeholder="Nome, número ou documento"
                className="input-surface min-h-11 w-full rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
              />
              <SubmitButton
                pendingLabel="Buscando..."
                className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-semibold text-white"
              >
                Buscar
              </SubmitButton>
            </Form>
          </div>
        </div>

        {scope === "event" ? (
          <div className="overflow-x-auto border-t border-[var(--surface-container)]">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Inscritos únicos</th>
                  <th className="px-4 py-3">Previstos</th>
                  <th className="px-4 py-3">No local</th>
                  <th className="px-4 py-3">Presentes</th>
                  <th className="px-4 py-3">Ausentes</th>
                  <th className="px-4 py-3">Presença prevista</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {eventDays.map((item) => {
                  const itemPresentSet = new Set(item.uniquePresentParticipantIds);
                  const presentExpected = item.uniqueExpectedParticipantIds.filter((id) => itemPresentSet.has(id)).length;
                  const rate = item.uniqueExpectedParticipantIds.length
                    ? Math.round((presentExpected / item.uniqueExpectedParticipantIds.length) * 10_000) / 100
                    : 0;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{formatDateOnly(item.date)}</td>
                      <td className="px-4 py-3">{item.uniqueRegisteredParticipantIds.length}</td>
                      <td className="px-4 py-3">{item.uniqueExpectedParticipantIds.length}</td>
                      <td className="px-4 py-3">{item.onsiteRegistrations.length}</td>
                      <td className="px-4 py-3">{item.uniquePresentParticipantIds.length}</td>
                      <td className="px-4 py-3">{item.absentExpectedParticipantIds.length}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--primary)]">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="border-t border-[var(--surface-container)]">
          <div className="divide-y divide-[var(--surface-container)] md:hidden">
            {checkinRows.slice(0, 100).map((row) => (
              <article key={row.checkin.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-container-low)] text-sm font-bold text-[var(--primary)]">
                    {getInitials(row.participant?.fullName ?? "Participante")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--foreground)]">{row.participant?.fullName ?? "Participante"}</p>
                        <p className="font-mono text-lg font-black text-[var(--primary)]">{row.participant?.participantNumber ?? "-"}</p>
                      </div>
                      <time className="shrink-0 text-sm font-bold">{formatSaoPauloTime(row.checkin.checkedInAt, { hour: "2-digit", minute: "2-digit" })}</time>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                        row.registrationType === "Inscrição no local" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      }`}>{row.registrationType}</span>
                      <span className="rounded-full bg-[var(--surface-container)] px-2 py-1 text-xs font-semibold text-muted">
                        {CHECKIN_ORIGIN_LABELS[row.checkin.origin] ?? row.checkin.origin}
                      </span>
                    </div>
                    {scope === "event" && row.eventDay ? <p className="mt-2 text-xs text-muted">{formatDateOnly(row.eventDay.date)}</p> : null}
                  </div>
                </div>
              </article>
            ))}
            {!checkinRows.length ? <p className="p-8 text-center text-sm text-muted">Nenhuma presença encontrada.</p> : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
                <tr>
                  <th className="px-4 py-3">Participante</th>
                  {scope === "event" ? <th className="px-4 py-3">Data</th> : null}
                  <th className="px-4 py-3">Check-in</th>
                  <th className="px-4 py-3">Inscrição</th>
                  <th className="px-4 py-3">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {checkinRows.slice(0, 100).map((row) => (
                  <tr key={row.checkin.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--foreground)]">{row.participant?.fullName ?? "Participante"}</p>
                      <p className="text-xs text-muted">
                        {row.participant ? `${row.participant.participantNumber} · ${row.participant.documentType} ${row.participant.documentNumber}` : "-"}
                      </p>
                    </td>
                    {scope === "event" ? <td className="px-4 py-3">{row.eventDay ? formatDateOnly(row.eventDay.date) : "-"}</td> : null}
                    <td className="px-4 py-3 font-semibold">{formatSaoPauloTime(row.checkin.checkedInAt)}</td>
                    <td className="px-4 py-3">{row.registrationType}</td>
                    <td className="px-4 py-3">{CHECKIN_ORIGIN_LABELS[row.checkin.origin] ?? row.checkin.origin}</td>
                  </tr>
                ))}
                {!checkinRows.length ? (
                  <tr><td colSpan={scope === "event" ? 5 : 4} className="px-4 py-8 text-center text-sm text-muted">Nenhuma presença encontrada.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-1 bg-[var(--surface-container-low)] px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Exibindo {Math.min(100, checkinRows.length)} de {checkinRows.length} presenças filtradas</span>
          <span>Atualização manual para preservar recursos do banco</span>
        </div>
      </div>
    </section>
  );
}
