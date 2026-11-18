import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getGlobalReportEvents, selectDefaultReportEvent } from "@/lib/reports/global-report-events";

type GlobalReportsPageProps = {
  searchParams: Promise<{ event?: string }>;
};

export default async function GlobalReportsPage({ searchParams }: GlobalReportsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const events = await getGlobalReportEvents();
  const query = await searchParams;
  const selected = events.find((event) => event.id === query.event) ?? selectDefaultReportEvent(events);

  if (selected) redirect(`/relatorios/${selected.id}`);

  return (
    <section className="surface-card rounded-2xl p-6 text-center">
      <h1 className="font-headline text-3xl font-extrabold">Central de Relatórios</h1>
      <p className="mt-2 text-muted">Cadastre um evento para começar a acompanhar os relatórios.</p>
    </section>
  );
}
