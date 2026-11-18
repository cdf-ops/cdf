import Link from "next/link";

export type EventReportTab =
  | "resumo-inscricoes"
  | "lista-inscritos"
  | "presenca-dia"
  | "presenca-total"
  | "presentes";

type ReportTabsProps = {
  eventId: string;
  activeTab: EventReportTab;
};

export function ReportTabs({ eventId, activeTab }: ReportTabsProps) {
  const tabs: { id: EventReportTab; label: string }[] = [
    { id: "resumo-inscricoes", label: "Resumo de inscrições" },
    { id: "lista-inscritos", label: "Lista de inscritos" },
    { id: "presenca-dia", label: "Presença por dia" },
    { id: "presenca-total", label: "Presença total" },
    { id: "presentes", label: "Presentes" },
  ];

  return (
    <nav aria-label="Seções dos relatórios" className="overflow-x-auto">
      <div className="flex min-w-max gap-2 border-b border-[var(--outline-variant)]/40 px-1">
        <Link
          href={`/events/${eventId}/lista-do-dia?scope=event`}
          className="border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-muted hover:text-[var(--primary)]"
        >
          Visão geral
        </Link>
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/events/${eventId}/relatorios?tab=${tab.id}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`border-b-2 px-3 py-3 text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-muted hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
        <span
          aria-disabled="true"
          title="Será liberado no próximo bloco"
          className="cursor-not-allowed border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-[var(--outline)]/55"
        >
          Sorteados
        </span>
      </div>
    </nav>
  );
}
