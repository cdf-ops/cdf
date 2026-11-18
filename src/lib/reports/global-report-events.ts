import { getSaoPauloDateKey } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export type GlobalReportEvent = {
  id: string;
  name: string;
  status: "rascunho" | "ativo" | "encerrado" | "arquivado";
  dates: string[];
};

export async function getGlobalReportEvents() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .select("id, name, status, event_days(date)")
    .order("name", { ascending: true });

  if (error) throw new Error("Não foi possível carregar os eventos dos relatórios.");

  return (data ?? []).map((event) => ({
    id: event.id,
    name: event.name,
    status: event.status,
    dates: (event.event_days ?? []).map((day) => day.date).sort(),
  })) as GlobalReportEvent[];
}

export function selectDefaultReportEvent(events: GlobalReportEvent[]) {
  const today = getSaoPauloDateKey();
  const active = events.filter((event) => event.status === "ativo" && event.dates.length);
  const occurring = active
    .filter((event) => event.dates[0] <= today && event.dates[event.dates.length - 1] >= today)
    .sort((left, right) => left.dates[0].localeCompare(right.dates[0]));
  if (occurring[0]) return occurring[0];

  const future = active
    .filter((event) => event.dates[0] > today)
    .sort((left, right) => left.dates[0].localeCompare(right.dates[0]));
  if (future[0]) return future[0];

  const finished = events
    .filter((event) => event.dates.length && event.dates[event.dates.length - 1] < today)
    .sort((left, right) => right.dates[right.dates.length - 1].localeCompare(left.dates[left.dates.length - 1]));
  return finished[0] ?? events[0] ?? null;
}
