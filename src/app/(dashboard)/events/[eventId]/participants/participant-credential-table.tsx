"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateOnly } from "@/lib/date-time";

export type ParticipantTableRow = {
  participantId: string;
  participantNumber: number;
  fullName: string;
  document: string;
  email: string;
  phone: string;
  profession: string;
  city: string;
  state: string;
  days: string[];
  consentGranted: boolean | null;
};

type ParticipantCredentialTableProps = {
  eventId: string;
  rows: ParticipantTableRow[];
  isExhibitor: boolean;
  canViewConsent: boolean;
  canManageCredentials: boolean;
  dayColumnLabel: string;
};

export function ParticipantCredentialTable({
  eventId,
  rows,
  isExhibitor,
  canViewConsent,
  canManageCredentials,
  dayColumnLabel,
}: ParticipantCredentialTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleIds = rows.map((row) => row.participantId);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleParticipant(participantId: string) {
    setSelectedIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : visibleIds);
  }

  const columnCount =
    4 +
    (isExhibitor ? 0 : 1) +
    (canViewConsent ? 1 : 0) +
    (canManageCredentials ? 2 : 0);

  return (
    <form method="post" action={`/api/events/${eventId}/credentials`}>
      {canManageCredentials ? (
        <div className="mb-4 flex min-h-14 flex-col gap-3 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-lowest)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--foreground)]">
              {selectedIds.length
                ? `${selectedIds.length} participante(s) selecionado(s)`
                : "Selecione participantes para gerar credenciais em lote"}
            </p>
            <p className="mt-0.5 text-xs text-muted">A credencial será gerada com o modelo deste evento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.length ? (
              <button type="button" onClick={() => setSelectedIds([])} className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold">
                Limpar seleção
              </button>
            ) : null}
            <button disabled={!selectedIds.length} className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
              Gerar credenciais selecionadas
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
            <tr>
              {canManageCredentials ? (
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos os participantes exibidos" />
                </th>
              ) : null}
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Participante</th>
              {!isExhibitor ? <th className="px-4 py-3">Documento</th> : null}
              <th className="px-4 py-3">{isExhibitor ? "Dados adicionais" : "Contato"}</th>
              {canViewConsent ? <th className="px-4 py-3">Dados adicionais no expositor</th> : null}
              <th className="px-4 py-3">{dayColumnLabel}</th>
              {canManageCredentials ? <th className="px-4 py-3 text-right">Credencial</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-container)]">
            {rows.map((row) => (
              <tr key={row.participantId} className="hover:bg-[var(--surface-container-low)]/70">
                {canManageCredentials ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="participant_ids"
                      value={row.participantId}
                      checked={selectedIds.includes(row.participantId)}
                      onChange={() => toggleParticipant(row.participantId)}
                      aria-label={`Selecionar ${row.fullName}`}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">{row.participantNumber || "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/participantes/${row.participantId}`} className="font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline">
                    {row.fullName}
                  </Link>
                </td>
                {!isExhibitor ? <td className="px-4 py-3">{row.document}</td> : null}
                <td className="px-4 py-3">
                  {isExhibitor ? (
                    row.consentGranted ? (
                      <div className="space-y-0.5">
                        {row.email ? <p>{row.email}</p> : null}
                        {row.phone ? <p>{row.phone}</p> : null}
                        {row.profession ? <p>{row.profession}</p> : null}
                        {row.city || row.state ? <p>{[row.city, row.state].filter(Boolean).join(" / ")}</p> : null}
                        {!row.email && !row.phone && !row.profession && !row.city && !row.state ? <p className="text-xs text-muted">Somente nome e número liberados</p> : null}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-muted">Não autorizados; nome e número mantidos</span>
                    )
                  ) : (
                    <><p>{row.email}</p><p className="text-xs text-muted">{row.phone}</p></>
                  )}
                </td>
                {canViewConsent ? (
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.consentGranted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                      {row.consentGranted ? "Autorizados" : "Não autorizados"}
                    </span>
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {row.days.map((day) => <span key={day} className="rounded-full bg-[var(--primary-soft)]/45 px-2 py-1 text-xs font-semibold text-[var(--primary)]">{formatDateOnly(day)}</span>)}
                  </div>
                </td>
                {canManageCredentials ? (
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/events/${eventId}/credentials/${row.participantId}`} className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-bold text-white">
                      Gerar credencial
                    </a>
                  </td>
                ) : null}
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-muted">Nenhum participante encontrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </form>
  );
}
