import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { parseParticipantNumberSearch } from "@/lib/participants/number";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerEntryCheckinAction } from "@/app/(dashboard)/events/[eventId]/checkin-recepcao/actions";
import { BadgeScanner } from "@/app/(dashboard)/events/[eventId]/checkin-recepcao/badge-scanner";

type ReceptionCheckinPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    q?: string;
    day?: string;
    notice?: string;
    notice_type?: "success" | "error";
    scan?: string;
  }>;
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = new Date().toISOString().slice(0, 10);
  return eventDays.find((day) => day.date === today)?.id ?? eventDays[0].id;
}

export default async function ReceptionCheckinPage({ params, searchParams }: ReceptionCheckinPageProps) {
  await requireSession(["super_adm", "organizador", "recepcao"]);
  const { eventId } = await params;
  const { q = "", day, notice, notice_type, scan } = await searchParams;
  const admin = createAdminClient();

  const { data: eventDaysData } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const eventDays = eventDaysData ?? [];

  if (!eventDays.length) {
    return (
      <section className="surface-card rounded-xl p-6">
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Check-in Recepcao</h2>
        <p className="mt-2 text-sm text-muted">
          Este evento ainda nao possui datas. Configure primeiro em{" "}
          <Link href={`/events/${eventId}/settings`} className="font-semibold text-[var(--primary)]">
            Configuracao
          </Link>
          .
        </p>
      </section>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);
  const queryText = q.trim();
  const searchedParticipantNumber = parseParticipantNumberSearch(queryText);

  const { data: latestCheckinsRaw } = await admin
    .from("entry_checkins")
    .select("id, participant_id, checked_in_at, origin")
    .eq("event_day_id", selectedDayId)
    .is("deleted_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(10);
  const latestCheckins = latestCheckinsRaw ?? [];
  const latestParticipantIds = [...new Set(latestCheckins.map((item) => item.participant_id))];
  const latestParticipants =
    latestParticipantIds.length > 0
      ? (
          await admin
            .from("participants")
            .select("id, participant_number, full_name, document_type, document_number")
            .in("id", latestParticipantIds)
        ).data ?? []
      : [];
  const latestParticipantMap = new Map(latestParticipants.map((participant) => [participant.id, participant]));

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
          .or(
            `full_name.ilike.%${queryText}%,document_number.ilike.%${queryText}%,email.ilike.%${queryText}%,phone.ilike.%${queryText}%`
          )
          .limit(20);
    const participants = participantsRaw ?? [];
    const participantIds = participants.map((item) => item.id);

    const registrations =
      participantIds.length > 0
        ? (
            await admin
              .from("event_registrations")
              .select("participant_id")
              .eq("event_day_id", selectedDayId)
              .in("participant_id", participantIds)
          ).data ?? []
        : [];
    const registeredSet = new Set(registrations.map((item) => item.participant_id));

    const checkins =
      participantIds.length > 0
        ? (
            await admin
              .from("entry_checkins")
              .select("participant_id")
              .eq("event_day_id", selectedDayId)
              .is("deleted_at", null)
              .in("participant_id", participantIds)
          ).data ?? []
        : [];
    const checkedSet = new Set(checkins.map((item) => item.participant_id));

    searchRows = participants
      .map((participant) => ({
        ...participant,
        registeredOnDay: registeredSet.has(participant.id),
        checkedInOnDay: checkedSet.has(participant.id),
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  }

  const returnUrl = `/events/${eventId}/checkin-recepcao?day=${selectedDayId}${queryText ? `&q=${encodeURIComponent(queryText)}` : ""}`;
  const primaryMatch = searchRows[0];

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Terminal de Acesso</p>
            <h2 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-4xl">
              Check-in Digital
            </h2>
            <p className="mt-1 text-sm text-muted">Digite o número do participante para um check-in mais rápido.</p>
          </div>

          <form className="shell-card grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl p-3 md:flex">
            <input type="hidden" name="q" value={queryText} />
            <div className="min-w-0">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Evento Hoje</label>
              <select
                name="day"
                defaultValue={selectedDayId}
                className="mt-1 block min-h-11 w-full rounded-lg bg-[var(--surface-container-lowest)] px-3 text-sm font-semibold outline-none"
              >
                {eventDays.map((item) => (
                  <option key={item.id} value={item.id}>
                    {new Date(item.date).toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
            </div>
            <button className="ghost-border min-h-11 rounded-lg bg-[var(--surface-container-lowest)] px-4 text-sm font-semibold text-[var(--foreground)]">
              Trocar
            </button>
          </form>
        </div>

        {notice ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
            }`}
          >
            {notice}
          </p>
        ) : null}

        <form className="mt-6 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="day" value={selectedDayId} />
          <input
            name="q"
            defaultValue={queryText}
            placeholder="Número do participante, nome, documento, telefone ou e-mail"
            className="input-surface h-14 rounded-2xl px-4 text-base font-medium outline-none focus:ring-4 focus:ring-[var(--primary)]/10 md:col-span-3 md:h-16 md:px-5 md:text-lg"
          />
          <button className="gradient-primary h-14 rounded-2xl px-4 text-base font-semibold text-white md:h-16 md:text-sm">
            Buscar
          </button>
        </form>

        <BadgeScanner eventId={eventId} eventDayId={selectedDayId} initialQrValue={scan} />
      </div>

      {queryText.length >= 2 ? (
        <div className="space-y-4">
          {primaryMatch ? (
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="surface-card rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Participante Encontrado</p>
                <p className="mt-3 font-mono text-4xl font-black tracking-tight text-[var(--primary)] sm:text-5xl">
                  {primaryMatch.participant_number}
                </p>
                <p className="mt-1 break-words font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-4xl">
                  {primaryMatch.full_name}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Documento</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {primaryMatch.document_type} {primaryMatch.document_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Telefone</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{primaryMatch.phone}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">E-mail</p>
                    <p className="mt-1 break-all text-sm text-muted">{primaryMatch.email}</p>
                  </div>
                </div>
              </div>

              <div className="surface-card rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Inscricao</p>
                <div className="mt-3">
                  {primaryMatch.checkedInOnDay ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Check-in realizado</span>
                  ) : primaryMatch.registeredOnDay ? (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Inscrito no dia</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Dia não previsto na inscrição</span>
                  )}
                </div>

                {!primaryMatch.checkedInOnDay ? (
                  <form action={registerEntryCheckinAction} className="mt-4">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="event_day_id" value={selectedDayId} />
                    <input type="hidden" name="participant_id" value={primaryMatch.id} />
                    <input type="hidden" name="include_day" value={primaryMatch.registeredOnDay ? "false" : "true"} />
                    <input type="hidden" name="redirect_url" value={returnUrl} />
                    <button className="gradient-primary min-h-12 w-full rounded-xl px-4 text-sm font-semibold text-white">
                      {primaryMatch.registeredOnDay ? "Confirmar Check-in" : "Fazer check-in mesmo assim"}
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 text-xs font-semibold text-muted">Este participante ja realizou check-in no dia.</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:hidden">
            {searchRows.map((row) => (
              <article key={row.id} className="surface-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-headline text-lg font-bold text-[var(--foreground)]">{row.full_name}</p>
                    <p className="mt-1 font-mono text-3xl font-black text-[var(--primary)]">{row.participant_number}</p>
                  </div>
                  {row.checkedInOnDay ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                      Realizado
                    </span>
                  ) : row.registeredOnDay ? (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                      Inscrito
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                      Outro dia
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Documento</dt>
                    <dd className="mt-1 text-[var(--foreground)]">
                      {row.document_type} {row.document_number}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Contato</dt>
                    <dd className="mt-1 break-all text-muted">{row.email}</dd>
                    <dd className="mt-0.5 text-muted">{row.phone}</dd>
                  </div>
                </dl>
                {!row.checkedInOnDay ? (
                  <form action={registerEntryCheckinAction} className="mt-4">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="event_day_id" value={selectedDayId} />
                    <input type="hidden" name="participant_id" value={row.id} />
                    <input type="hidden" name="include_day" value={row.registeredOnDay ? "false" : "true"} />
                    <input type="hidden" name="redirect_url" value={returnUrl} />
                    <button className="gradient-primary min-h-12 w-full rounded-xl px-4 text-sm font-semibold text-white">
                      {row.registeredOnDay ? "Confirmar Check-in" : "Fazer check-in mesmo assim"}
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-center text-sm font-semibold text-emerald-700">
                    Check-in já realizado
                  </p>
                )}
              </article>
            ))}
            {!searchRows.length ? (
              <div className="surface-card rounded-2xl px-5 py-8 text-center text-sm text-muted">
                Nenhum participante encontrado para essa busca.
              </div>
            ) : null}
            <p className="px-1 text-xs text-muted">
              Nao encontrou o visitante? Cadastre em{" "}
              <Link href={`/events/${eventId}/participants`} className="font-semibold text-[var(--primary)]">
                Participantes
              </Link>
              .
            </p>
          </div>

          <div className="surface-card hidden overflow-hidden rounded-xl md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
                <tr>
                  <th className="px-4 py-3">Participante</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Status no Dia</th>
                  <th className="px-4 py-3 text-right">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {searchRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--foreground)]">{row.full_name}</p>
                      <p className="text-xs text-muted">{row.email} | {row.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">{row.participant_number}</td>
                    <td className="px-4 py-3">
                      {row.document_type} {row.document_number}
                    </td>
                    <td className="px-4 py-3">
                      {row.checkedInOnDay ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Check-in realizado</span>
                      ) : row.registeredOnDay ? (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Inscrito no dia</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Dia não previsto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!row.checkedInOnDay ? (
                        <form action={registerEntryCheckinAction}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="event_day_id" value={selectedDayId} />
                          <input type="hidden" name="participant_id" value={row.id} />
                          <input type="hidden" name="include_day" value={row.registeredOnDay ? "false" : "true"} />
                          <input type="hidden" name="redirect_url" value={returnUrl} />
                          <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:brightness-105">
                            {row.registeredOnDay ? "Confirmar Check-in" : "Fazer check-in mesmo assim"}
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-semibold text-muted">Sem acao</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!searchRows.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                      Nenhum participante encontrado para essa busca.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-muted">
              Nao encontrou o visitante? Cadastre em{" "}
              <Link href={`/events/${eventId}/participants`} className="font-semibold text-[var(--primary)]">
                Participantes
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      <div className="surface-card rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Ultimos Check-ins</h3>
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Tempo real</span>
        </div>
        <div className="mt-3 grid gap-2 md:hidden">
          {latestCheckins.map((item) => {
            const participant = latestParticipantMap.get(item.participant_id);
            return (
              <article key={item.id} className="rounded-xl bg-[var(--surface-container-low)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-[var(--foreground)]">
                      {participant?.full_name ?? "Participante"}
                    </p>
                    <p className="mt-1 font-mono text-xl font-black text-[var(--primary)]">
                      {participant?.participant_number ?? "-"}
                    </p>
                  </div>
                  <time className="shrink-0 text-sm font-bold text-[var(--foreground)]">
                    {new Date(item.checked_in_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {participant ? `${participant.document_type} ${participant.document_number}` : "Documento não informado"}
                </p>
              </article>
            );
          })}
          {!latestCheckins.length ? (
            <p className="rounded-xl bg-[var(--surface-container-low)] px-3 py-5 text-center text-sm text-muted">
              Ainda nao ha check-ins nesse dia.
            </p>
          ) : null}
        </div>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Participante</th>
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Hora</th>
                <th className="px-3 py-2">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {latestCheckins.map((item) => {
                const participant = latestParticipantMap.get(item.participant_id);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{participant?.full_name ?? "Participante"}</td>
                    <td className="px-3 py-2 font-mono font-bold text-[var(--primary)]">{participant?.participant_number ?? "-"}</td>
                    <td className="px-3 py-2">{participant ? `${participant.document_type} ${participant.document_number}` : "-"}</td>
                    <td className="px-3 py-2">{new Date(item.checked_in_at).toLocaleTimeString("pt-BR")}</td>
                    <td className="px-3 py-2">{item.origin}</td>
                  </tr>
                );
              })}
              {!latestCheckins.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-muted">
                    Ainda nao ha check-ins nesse dia.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
