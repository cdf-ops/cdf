import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type EventsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: "todos" | "ativo" | "encerrado" | "rascunho";
  }>;
};

type EventListItem = {
  id: string;
  name: string;
  location: string;
  status: "rascunho" | "ativo" | "encerrado";
  event_days: { date: string }[] | null;
};

const STATUS_OPTIONS = [
  { label: "Todos", value: "todos" },
  { label: "Ativo", value: "ativo" },
  { label: "Encerrado", value: "encerrado" },
  { label: "Rascunho", value: "rascunho" },
] as const;

function formatDateRange(dateList: string[]) {
  if (!dateList.length) {
    return "Sem datas";
  }
  const sorted = [...dateList].sort((a, b) => (a < b ? -1 : 1));
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const first = formatter.format(new Date(sorted[0]));
  const last = formatter.format(new Date(sorted[sorted.length - 1]));
  return sorted.length === 1 ? first : `${first} - ${last}`;
}

function statusBadgeClass(status: "rascunho" | "ativo" | "encerrado") {
  if (status === "ativo") {
    return "bg-[var(--secondary-soft)] text-[var(--secondary)]";
  }
  if (status === "encerrado") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-[var(--surface-container)] text-[var(--foreground)]";
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "expositor"]);
  const params = await searchParams;
  const queryText = (params.q ?? "").trim();
  const selectedStatus = params.status ?? "todos";

  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id, name, location, status, event_days(date)")
    .order("created_at", { ascending: false });

  if (queryText) {
    query = query.or(`name.ilike.%${queryText}%,location.ilike.%${queryText}%`);
  }
  if (selectedStatus !== "todos") {
    query = query.eq("status", selectedStatus);
  }

  const { data } = await query;
  const events = (data ?? []) as EventListItem[];

  return (
    <section>
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-[var(--foreground)]">Eventos</h1>
          <p className="mt-2 text-lg text-muted">Gerencie seus eventos e acompanhe o progresso de cada um.</p>
        </div>
        <Link
          href="/events/new"
          className="gradient-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow"
        >
          <span className="text-base leading-none">＋</span>
          Novo Evento
        </Link>
      </div>

      <form className="shell-card mb-6 rounded-xl p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <input
            type="text"
            name="q"
            defaultValue={queryText}
            placeholder="Buscar por nome ou local do evento..."
            className="input-surface flex-1 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
          />
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((item) => (
              <button
                key={item.value}
                name="status"
                value={item.value}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedStatus === item.value
                    ? "bg-[var(--primary)] text-white"
                    : "ghost-border bg-[var(--surface-container-lowest)] text-[var(--foreground)] hover:bg-[var(--surface-container)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="surface-card overflow-hidden rounded-xl">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
            <tr>
              <th className="px-8 py-5 font-semibold">Nome do Evento</th>
              <th className="px-8 py-5 font-semibold">Datas</th>
              <th className="px-8 py-5 font-semibold">Local</th>
              <th className="px-8 py-5 font-semibold text-center">Status</th>
              <th className="px-8 py-5 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-container)] text-sm">
            {events.map((event) => {
              const dateList = (event.event_days ?? []).map((item) => item.date);
              const entryHref =
                session.role === "recepcao"
                  ? `/events/${event.id}/checkin-recepcao`
                  : session.role === "expositor"
                    ? `/events/${event.id}/checkin-expositor`
                    : `/events/${event.id}/settings`;
              return (
                <tr key={event.id} className="hover:bg-[var(--surface-container-low)]/75">
                  <td className="px-8 py-5">
                    <p className="font-headline text-base font-bold text-[var(--foreground)]">{event.name}</p>
                  </td>
                  <td className="px-8 py-5 text-muted">{formatDateRange(dateList)}</td>
                  <td className="px-8 py-5 text-muted">{event.location}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(event.status)}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <Link
                      href={entryHref}
                      className="rounded-lg px-3 py-2 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--primary)]/5"
                    >
                      Entrar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!events.length ? (
              <tr>
                <td colSpan={5} className="px-8 py-10 text-center text-sm text-muted">
                  Nenhum evento encontrado com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="gradient-primary rounded-2xl p-6 text-white md:col-span-2">
          <p className="font-headline text-3xl font-extrabold tracking-tight">Expanda seu impacto</p>
          <p className="mt-2 max-w-xl text-sm text-white/90">
            Crie um novo evento e gerencie inscricoes, certificados e check-ins com a mesma base de operacao.
          </p>
          <Link
            href="/events/new"
            className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[var(--primary)]"
          >
            Criar Novo Evento
          </Link>
        </div>
        <div className="surface-card rounded-2xl p-6">
          <p className="font-headline text-2xl font-bold tracking-tight text-[var(--foreground)]">Relatorios Globais</p>
          <p className="mt-2 text-sm text-muted">Visualize o desempenho consolidado dos eventos.</p>
          <Link href="/events" className="mt-5 inline-flex text-sm font-semibold text-[var(--primary)]">
            Ver estatisticas
          </Link>
        </div>
      </div>
    </section>
  );
}
