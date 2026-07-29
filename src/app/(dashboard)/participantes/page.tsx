import Link from "next/link";
import Form from "next/form";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { formatSaoPauloDateTime } from "@/lib/date-time";
import {
  parseParticipantFilters,
  participantFiltersToSearchParams,
  participantRpcArgs,
} from "@/lib/participants/filters";
import { createAdminClient } from "@/lib/supabase/admin";

type ParticipantsPageProps = {
  searchParams: Promise<{
    q?: string;
    event?: string;
    city?: string;
    profession?: string;
    last_checkin_from?: string;
    last_checkin_to?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 50;

function formatLastCheckin(value: string | null) {
  if (!value) {
    return { date: "Sem check-in", days: "-" };
  }

  const date = new Date(value);
  const elapsedDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return {
    date: formatSaoPauloDateTime(date),
    days: elapsedDays === 0 ? "Hoje" : `${elapsedDays} dia${elapsedDays === 1 ? "" : "s"}`,
  };
}

function paginationHref(filters: ReturnType<typeof parseParticipantFilters>, page: number) {
  const params = participantFiltersToSearchParams(filters);
  if (page > 1) {
    params.set("page", String(page));
  }
  return `/participantes${params.size ? `?${params.toString()}` : ""}`;
}

export default async function ParticipantsPage({ searchParams }: ParticipantsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const rawParams = await searchParams;
  const filters = parseParticipantFilters(rawParams);
  const parsedPage = Number.parseInt(rawParams.page ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const admin = createAdminClient();

  const [{ data: participantData, error }, { data: eventData }] = await Promise.all([
    admin.rpc("list_global_participants", participantRpcArgs(filters, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE)),
    admin.from("events").select("id, name, status").order("name", { ascending: true }),
  ]);

  if (error) {
    throw new Error("Não foi possível carregar a lista global de participantes.");
  }

  const participants = participantData ?? [];
  const totalCount = participants[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const exportParams = participantFiltersToSearchParams(filters);

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Participantes</h1>
            <p className="mt-1 text-sm text-muted">Consulte cadastros e presença consolidada em todos os eventos.</p>
          </div>
          <a
            href={`/participantes/export${exportParams.size ? `?${exportParams.toString()}` : ""}`}
            className="gradient-primary inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Exportar CSV
          </a>
        </div>
      </div>

      <Form action="/participantes" scroll={false} className="shell-card rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Buscar por número, nome, documento, e-mail ou telefone"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] md:col-span-2"
          />
          <select
            name="event"
            defaultValue={filters.eventId}
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="">Todos os eventos</option>
            {(eventData ?? []).map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({event.status})
              </option>
            ))}
          </select>
          <input
            name="city"
            defaultValue={filters.city}
            placeholder="Cidade"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            name="profession"
            defaultValue={filters.profession}
            placeholder="Profissão"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="last_checkin_from"
              type="date"
              defaultValue={filters.lastCheckinFrom}
              aria-label="Último check-in a partir de"
              className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <input
              name="last_checkin_to"
              type="date"
              defaultValue={filters.lastCheckinTo}
              aria-label="Último check-in até"
              className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SubmitButton pendingLabel="Filtrando..." className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
            Filtrar
          </SubmitButton>
          <Link
            href="/participantes"
            className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]"
          >
            Limpar filtros
          </Link>
        </div>
      </Form>

      <div className="surface-card overflow-hidden rounded-xl">
        <div className="flex items-center justify-between border-b border-[var(--surface-container)] px-5 py-4">
          <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Lista de Participantes</h2>
          <p className="text-sm text-muted">{totalCount} cadastro{totalCount === 1 ? "" : "s"}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Localidade</th>
                <th className="px-4 py-3 text-center">Eventos</th>
                <th className="px-4 py-3 text-center">Check-ins</th>
                <th className="px-4 py-3">Último check-in</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {participants.map((participant) => {
                const lastCheckin = formatLastCheckin(participant.last_checkin_at);
                return (
                  <tr key={participant.participant_id} className="hover:bg-[var(--surface-container-low)]/70">
                    <td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">
                      {participant.participant_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{participant.full_name}</p>
                      <p className="text-xs text-muted">{participant.email}</p>
                    </td>
                    <td className="px-4 py-3">{participant.document_type} {participant.document_number}</td>
                    <td className="px-4 py-3">{participant.city} / {participant.state}</td>
                    <td className="px-4 py-3 text-center">{participant.event_count}</td>
                    <td className="px-4 py-3 text-center">{participant.entry_checkin_count}</td>
                    <td className="px-4 py-3">
                      <p>{lastCheckin.date}</p>
                      <p className="text-xs text-muted">{lastCheckin.days}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/participantes/${participant.participant_id}`}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/5"
                      >
                        Ver Detalhes
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!participants.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                    Nenhum participante encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--surface-container)] px-5 py-4 text-sm">
            <p className="text-muted">Página {currentPage} de {totalPages}</p>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link href={paginationHref(filters, currentPage - 1)} className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 font-semibold">
                  Anterior
                </Link>
              ) : null}
              {currentPage < totalPages ? (
                <Link href={paginationHref(filters, currentPage + 1)} className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 font-semibold">
                  Próxima
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
