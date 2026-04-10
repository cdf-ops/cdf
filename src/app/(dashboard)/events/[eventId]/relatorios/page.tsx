import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type ReportsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ day?: string }>;
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = new Date().toISOString().slice(0, 10);
  return eventDays.find((day) => day.date === today)?.id ?? eventDays[0].id;
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { day } = await searchParams;
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
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Relatórios de Evento</h2>
        <p className="mt-2 text-sm text-muted">Configure datas no evento para liberar relatórios.</p>
      </section>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);

  const { data: entryCheckinsAll } = await admin
    .from("entry_checkins")
    .select("participant_id, event_day_id")
    .in(
      "event_day_id",
      eventDays.map((item) => item.id)
    )
    .is("deleted_at", null);
  const { data: standCheckinsAll } = await admin
    .from("stand_checkins")
    .select("participant_id, event_day_id, event_exhibitor_id")
    .in(
      "event_day_id",
      eventDays.map((item) => item.id)
    )
    .is("deleted_at", null);

  const entryRows = entryCheckinsAll ?? [];
  const standRows = standCheckinsAll ?? [];

  const totalsByDay = eventDays.map((eventDay) => {
    const entryDay = entryRows.filter((item) => item.event_day_id === eventDay.id);
    const standDay = standRows.filter((item) => item.event_day_id === eventDay.id);
    return {
      dayId: eventDay.id,
      date: eventDay.date,
      entryCount: entryDay.length,
      entryUnique: new Set(entryDay.map((item) => item.participant_id)).size,
      standCount: standDay.length,
      standUnique: new Set(standDay.map((item) => item.participant_id)).size,
    };
  });

  const totalEntry = entryRows.length;
  const totalEntryUnique = new Set(entryRows.map((item) => item.participant_id)).size;
  const totalStand = standRows.length;
  const selectedDayEntryUnique = new Set(
    entryRows.filter((item) => item.event_day_id === selectedDayId).map((item) => item.participant_id)
  ).size;

  const { data: eventExhibitorsData } = await admin
    .from("event_exhibitors")
    .select("id, exhibitor_company_id, stand_name")
    .eq("event_id", eventId);
  const eventExhibitors = eventExhibitorsData ?? [];
  const companyIds = [...new Set(eventExhibitors.map((item) => item.exhibitor_company_id))];
  const { data: companiesData } =
    companyIds.length > 0
      ? await admin
          .from("exhibitor_companies")
          .select("id, name")
          .in("id", companyIds)
      : { data: [] as { id: string; name: string }[] };
  const companyMap = new Map((companiesData ?? []).map((item) => [item.id, item.name]));

  const selectedDayStandRows = standRows.filter((item) => item.event_day_id === selectedDayId);
  const standConversionRows = eventExhibitors.map((eventExhibitor) => {
    const standVisitorsUnique = new Set(
      selectedDayStandRows
        .filter((item) => item.event_exhibitor_id === eventExhibitor.id)
        .map((item) => item.participant_id)
    ).size;
    const conversion =
      selectedDayEntryUnique > 0 ? ((standVisitorsUnique / selectedDayEntryUnique) * 100).toFixed(2) : "0.00";
    return {
      eventExhibitorId: eventExhibitor.id,
      exhibitorName: companyMap.get(eventExhibitor.exhibitor_company_id) ?? "Expositor",
      standName: eventExhibitor.stand_name,
      uniqueVisitors: standVisitorsUnique,
      conversionPct: conversion,
    };
  });

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Relatórios de Evento</h2>
        <p className="mt-1 text-sm text-muted">Indicadores operacionais e de engajamento por dia.</p>
        <form className="mt-4 flex items-end gap-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Dia para conversão</label>
            <select
              name="day"
              defaultValue={selectedDayId}
              className="mt-1 block rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            >
              {eventDays.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.date).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]">
            Trocar dia
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs text-muted">Check-ins Entrada (total)</p>
          <p className="font-headline text-3xl font-extrabold">{totalEntry}</p>
          <p className="text-xs text-muted">{totalEntryUnique} visitantes únicos</p>
        </div>
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs text-muted">Check-ins Stand (total)</p>
          <p className="font-headline text-3xl font-extrabold">{totalStand}</p>
        </div>
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs text-muted">Base dia selecionado</p>
          <p className="font-headline text-3xl font-extrabold">{selectedDayEntryUnique}</p>
          <p className="text-xs text-muted">visitantes entrada no dia</p>
        </div>
      </div>

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Check-ins por Dia</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Entrada (bruto)</th>
                <th className="px-3 py-2">Entrada (únicos)</th>
                <th className="px-3 py-2">Stand (bruto)</th>
                <th className="px-3 py-2">Stand (únicos)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {totalsByDay.map((row) => (
                <tr key={row.dayId}>
                  <td className="px-3 py-2">{new Date(row.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2">{row.entryCount}</td>
                  <td className="px-3 py-2">{row.entryUnique}</td>
                  <td className="px-3 py-2">{row.standCount}</td>
                  <td className="px-3 py-2">{row.standUnique}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Conversão por Expositor (dia selecionado)</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Expositor</th>
                <th className="px-3 py-2">Stand</th>
                <th className="px-3 py-2">Visitantes Únicos</th>
                <th className="px-3 py-2">Conversão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {standConversionRows.map((row) => (
                <tr key={row.eventExhibitorId}>
                  <td className="px-3 py-2">{row.exhibitorName}</td>
                  <td className="px-3 py-2">{row.standName ?? "-"}</td>
                  <td className="px-3 py-2">{row.uniqueVisitors}</td>
                  <td className="px-3 py-2">{row.conversionPct}%</td>
                </tr>
              ))}
              {!standConversionRows.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-sm text-muted">
                    Nenhum expositor vinculado ao evento.
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

