import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { registerEntryCheckinAction } from "@/app/(dashboard)/events/[eventId]/checkin-recepcao/actions";
import { BadgeScanner } from "@/app/(dashboard)/events/[eventId]/checkin-recepcao/badge-scanner";
import { TerminalShell } from "@/app/recepcao/[eventId]/terminal-shell";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { getClosestEventDayId } from "@/lib/date-time";
import { parseParticipantNumberSearch } from "@/lib/participants/number";
import { createAdminClient } from "@/lib/supabase/admin";

type ReceptionTerminalPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    q?: string;
    day?: string;
    notice?: string;
    notice_type?: "success" | "error";
    scan?: string;
  }>;
};

export default async function ReceptionTerminalPage({ params, searchParams }: ReceptionTerminalPageProps) {
  await requireSession(["super_adm", "organizador", "recepcao"]);
  const { eventId } = await params;
  const { q = "", day, notice, notice_type, scan } = await searchParams;
  const admin = createAdminClient();

  const [{ data: event }, { data: eventDaysData }] = await Promise.all([
    admin.from("events").select("id").eq("id", eventId).maybeSingle(),
    admin.from("event_days").select("id, date").eq("event_id", eventId).order("date", { ascending: true }),
  ]);

  if (!event) notFound();

  const eventDays = eventDaysData ?? [];
  if (!eventDays.length) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--background)] p-6">
        <div className="surface-card max-w-lg rounded-2xl p-8 text-center">
          <h1 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Terminal indisponível</h1>
          <p className="mt-2 text-sm text-muted">Este evento ainda não possui uma data configurada.</p>
          <Link href={`/events/${eventId}/settings`} className="gradient-primary mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-bold text-white">
            Configurar evento
          </Link>
        </div>
      </main>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getClosestEventDayId(eventDays);
  const queryText = q.trim();
  const searchedParticipantNumber = parseParticipantNumberSearch(queryText);

  let searchRows: {
    id: string;
    participant_number: number;
    full_name: string;
    document_type: string;
    document_number: string;
    email: string;
    phone: string;
    registeredOnDay: boolean;
    checkedInOnDay: boolean;
  }[] = [];

  if (queryText.length >= 2) {
    const participantsQuery = admin
      .from("participants")
      .select("id, participant_number, full_name, document_type, document_number, email, phone");
    const { data: participantsRaw } = searchedParticipantNumber
      ? await participantsQuery.eq("participant_number", searchedParticipantNumber).limit(1)
      : await participantsQuery
          .or(`full_name.ilike.%${queryText}%,document_number.ilike.%${queryText}%,email.ilike.%${queryText}%,phone.ilike.%${queryText}%`)
          .limit(8);
    const participants = participantsRaw ?? [];
    const participantIds = participants.map((item) => item.id);

    const [registrationsResult, checkinsResult] =
      participantIds.length > 0
        ? await Promise.all([
            admin.from("event_registrations").select("participant_id").eq("event_day_id", selectedDayId).in("participant_id", participantIds),
            admin.from("entry_checkins").select("participant_id").eq("event_day_id", selectedDayId).is("deleted_at", null).in("participant_id", participantIds),
          ])
        : [{ data: [] }, { data: [] }];

    const registeredSet = new Set((registrationsResult.data ?? []).map((item) => item.participant_id));
    const checkedSet = new Set((checkinsResult.data ?? []).map((item) => item.participant_id));
    searchRows = participants
      .map((participant) => ({
        ...participant,
        registeredOnDay: registeredSet.has(participant.id),
        checkedInOnDay: checkedSet.has(participant.id),
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  }

  const primaryMatch = searchRows.length === 1 ? searchRows[0] : null;
  const terminalHref = `/recepcao/${eventId}?day=${selectedDayId}`;
  const returnUrl = `${terminalHref}${queryText ? `&q=${encodeURIComponent(queryText)}` : ""}`;
  const successNotice = notice_type === "success" && Boolean(notice);

  return (
    <TerminalShell
      eventHref={`/events/${eventId}/checkin-recepcao?day=${selectedDayId}`}
      resetKey={queryText}
    >
      <main className="min-h-dvh bg-[var(--background)] px-4 py-5 sm:px-8 sm:py-7 lg:px-12">
        <div className="mx-auto w-full max-w-[1600px]">
          <section className="mx-auto max-w-5xl pt-16 text-center sm:pt-3">
            <h2 className="font-headline text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">Localizar participante</h2>
            <p className="mt-2 text-sm text-muted sm:text-base">Busque pelo número, nome, documento, telefone ou e-mail.</p>

            <Form action={`/recepcao/${eventId}`} scroll={false} className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input type="hidden" name="day" value={selectedDayId} />
              <input
                name="q"
                data-terminal-search
                autoFocus
                defaultValue={queryText}
                autoComplete="off"
                placeholder="Digite para buscar..."
                className="h-16 min-w-0 rounded-2xl border-2 border-[var(--outline-variant)] bg-white px-5 text-lg font-semibold text-[var(--foreground)] shadow-sm outline-none placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10 sm:h-20 sm:px-7 sm:text-2xl"
              />
              <SubmitButton pendingLabel="Buscando..." className="gradient-primary h-16 rounded-2xl px-8 text-base font-bold text-white sm:h-20 sm:text-lg">
                Buscar
              </SubmitButton>
            </Form>

            <BadgeScanner eventId={eventId} eventDayId={selectedDayId} initialQrValue={scan} variant="terminal" />
          </section>

          {notice && !successNotice ? (
            <div
              className="mx-auto mt-7 max-w-4xl rounded-2xl bg-red-100 px-6 py-5 text-center text-red-800"
              role="status"
            >
              <p className="text-xl font-extrabold sm:text-2xl">{notice}</p>
            </div>
          ) : null}

          {successNotice && primaryMatch ? (
            <section className="mx-auto mt-7 max-w-4xl rounded-3xl bg-emerald-100 px-6 py-7 text-center text-emerald-900 shadow-sm sm:px-10 sm:py-9">
              <p className="text-5xl" aria-hidden="true">✓</p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">Check-in realizado</h3>
              <p className="mt-3 font-mono text-4xl font-black text-emerald-800">{primaryMatch.participant_number}</p>
              <p className="mt-1 text-2xl font-extrabold sm:text-3xl">{primaryMatch.full_name}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <a
                  href={`/api/events/${eventId}/reception-credentials/participant/${primaryMatch.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-emerald-700 px-6 text-lg font-black text-white hover:bg-emerald-800"
                >
                  Imprimir credencial
                </a>
                <Link
                  href={terminalHref}
                  className="inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-emerald-700 bg-white px-6 text-lg font-black text-emerald-800"
                >
                  Próximo atendimento
                </Link>
              </div>
            </section>
          ) : null}

          {!successNotice && primaryMatch ? (
            <section className="mx-auto mt-7 grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
              <div className="surface-card rounded-3xl p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-5xl font-black tracking-tight text-[var(--primary)] sm:text-7xl">{primaryMatch.participant_number}</p>
                    <h3 className="mt-2 break-words font-headline text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">{primaryMatch.full_name}</h3>
                  </div>
                  <span className={`w-fit shrink-0 rounded-full px-3 py-2 text-xs font-extrabold uppercase ${primaryMatch.checkedInOnDay ? "bg-emerald-100 text-emerald-700" : primaryMatch.registeredOnDay ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>
                    {primaryMatch.checkedInOnDay ? "Check-in realizado" : primaryMatch.registeredOnDay ? "Inscrito para hoje" : "Inscrição em outro dia"}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 border-t border-[var(--outline-variant)]/40 pt-5 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Documento</p>
                    <p className="terminal-sensitive mt-1 font-semibold text-[var(--foreground)]">{primaryMatch.document_type} {primaryMatch.document_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Telefone</p>
                    <p className="terminal-sensitive mt-1 font-semibold text-[var(--foreground)]">{primaryMatch.phone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">E-mail</p>
                    <p className="terminal-sensitive mt-1 break-all text-sm font-semibold text-[var(--foreground)]">{primaryMatch.email}</p>
                  </div>
                </div>
              </div>

              <div className="surface-card flex rounded-3xl p-6 sm:p-8">
                {!primaryMatch.checkedInOnDay ? (
                  <form action={registerEntryCheckinAction} className="flex w-full flex-col justify-center">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="event_day_id" value={selectedDayId} />
                    <input type="hidden" name="participant_id" value={primaryMatch.id} />
                    <input type="hidden" name="include_day" value={primaryMatch.registeredOnDay ? "false" : "true"} />
                    <input type="hidden" name="redirect_url" value={returnUrl} />
                    {!primaryMatch.registeredOnDay ? <p className="mb-4 text-center text-sm font-bold text-amber-800">Este participante não estava previsto para esta data.</p> : null}
                    <SubmitButton pendingLabel="Confirmando..." className="gradient-primary min-h-20 w-full rounded-2xl px-5 text-lg font-black text-white sm:text-xl">
                      {primaryMatch.registeredOnDay ? "Confirmar check-in" : "Fazer check-in mesmo assim"}
                    </SubmitButton>
                  </form>
                ) : (
                  <div className="m-auto text-center text-emerald-700">
                    <p className="text-5xl" aria-hidden="true">✓</p>
                    <p className="mt-2 text-xl font-extrabold">Check-in já realizado</p>
                    <div className="mt-5 grid gap-2">
                      <a
                        href={`/api/events/${eventId}/reception-credentials/participant/${primaryMatch.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"
                      >
                        Imprimir credencial
                      </a>
                      <Link href={terminalHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-300 px-4 text-sm font-bold">Nova busca</Link>
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {!successNotice && queryText.length >= 2 && searchRows.length > 1 ? (
            <section className="mx-auto mt-7 max-w-5xl">
              <p className="mb-3 text-center text-sm font-bold text-muted">Encontramos {searchRows.length} participantes. Selecione a pessoa correta.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {searchRows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/recepcao/${eventId}?day=${selectedDayId}&q=${row.participant_number}`}
                    className="surface-card flex items-center justify-between gap-4 rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-md"
                  >
                    <div className="min-w-0 text-left">
                      <p className="break-words text-xl font-extrabold text-[var(--foreground)]">{row.full_name}</p>
                      <p className="mt-1 font-mono text-3xl font-black text-[var(--primary)]">{row.participant_number}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${row.checkedInOnDay ? "bg-emerald-100 text-emerald-700" : row.registeredOnDay ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>
                      {row.checkedInOnDay ? "Realizado" : row.registeredOnDay ? "Inscrito" : "Outro dia"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {!successNotice && queryText.length >= 2 && searchRows.length === 0 ? (
            <div className="mx-auto mt-7 max-w-3xl rounded-2xl border-2 border-dashed border-[var(--outline-variant)] bg-white/60 px-6 py-10 text-center">
              <p className="text-xl font-extrabold text-[var(--foreground)]">Nenhum participante encontrado</p>
              <p className="mt-2 text-sm text-muted">Confira os dados digitados e faça uma nova busca.</p>
            </div>
          ) : null}
        </div>
      </main>
    </TerminalShell>
  );
}
