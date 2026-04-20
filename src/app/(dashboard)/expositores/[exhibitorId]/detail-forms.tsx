"use client";

import { useActionState } from "react";
import {
  linkEventToExhibitorAction,
  linkExhibitorUserAction,
  unlinkEventFromExhibitorAction,
  unlinkExhibitorUserAction,
  updateExhibitorDetailsAction,
  type ExhibitorDetailState,
} from "@/app/(dashboard)/expositores/[exhibitorId]/actions";

type ExhibitorDetails = {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  phone: string;
  email: string;
  contactName: string;
  notes: string;
};

type LinkedUser = {
  userId: string;
  email: string;
};

type LinkedEvent = {
  eventId: string;
  eventName: string;
  eventStatus: string;
  standName: string | null;
};

type EventOption = {
  id: string;
  name: string;
  status: string;
};

type ExhibitorDetailFormsProps = {
  exhibitor: ExhibitorDetails;
  users: LinkedUser[];
  linkedEvents: LinkedEvent[];
  allEvents: EventOption[];
};

const INITIAL_STATE: ExhibitorDetailState = {
  error: null,
  success: null,
};

export function ExhibitorDetailForms({ exhibitor, users, linkedEvents, allEvents }: ExhibitorDetailFormsProps) {
  const [detailsState, detailsAction, detailsPending] = useActionState(updateExhibitorDetailsAction, INITIAL_STATE);
  const [linkUserState, linkUserAction, linkUserPending] = useActionState(linkExhibitorUserAction, INITIAL_STATE);
  const [unlinkUserState, unlinkUserAction, unlinkUserPending] = useActionState(unlinkExhibitorUserAction, INITIAL_STATE);
  const [linkEventState, linkEventAction, linkEventPending] = useActionState(linkEventToExhibitorAction, INITIAL_STATE);
  const [unlinkEventState, unlinkEventAction, unlinkEventPending] = useActionState(unlinkEventFromExhibitorAction, INITIAL_STATE);

  const linkedEventIds = new Set(linkedEvents.map((item) => item.eventId));
  const availableEvents = allEvents.filter((item) => !linkedEventIds.has(item.id));

  return (
    <div className="space-y-6">
      <form action={detailsAction} className="surface-card rounded-xl p-5">
        <input type="hidden" name="exhibitor_id" value={exhibitor.id} />
        <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Dados Cadastrais</h2>
        <p className="mt-1 text-sm text-muted">Dados gerais do expositor com CNPJ obrigatório e único.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="trade_name"
            required
            defaultValue={exhibitor.tradeName}
            placeholder="Nome fantasia"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            name="legal_name"
            required
            defaultValue={exhibitor.legalName}
            placeholder="Razão social"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            name="cnpj"
            required
            defaultValue={exhibitor.cnpj}
            placeholder="CNPJ"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            name="phone"
            required
            defaultValue={exhibitor.phone}
            placeholder="Telefone"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            name="email"
            type="email"
            defaultValue={exhibitor.email}
            placeholder="E-mail principal"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            name="contact_name"
            defaultValue={exhibitor.contactName}
            placeholder="Responsável"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>

        <textarea
          name="notes"
          defaultValue={exhibitor.notes}
          placeholder="Observações"
          className="mt-3 min-h-24 w-full rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />

        {detailsState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{detailsState.error}</p> : null}
        {detailsState.success ? <p className="mt-3 text-sm text-emerald-700">{detailsState.success}</p> : null}

        <button
          type="submit"
          disabled={detailsPending}
          className="gradient-primary mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {detailsPending ? "Salvando..." : "Salvar Dados"}
        </button>
      </form>

      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Usuários Vinculados</h2>
        <p className="mt-1 text-sm text-muted">
          Vincule usuários por e-mail. Se não existir no Auth, o sistema cria automaticamente com senha temporária.
        </p>

        <form action={linkUserAction} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input type="hidden" name="exhibitor_id" value={exhibitor.id} />
          <input
            name="user_email"
            type="email"
            required
            placeholder="expositor@empresa.com"
            className="flex-1 rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={linkUserPending}
            className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          >
            {linkUserPending ? "Vinculando..." : "Vincular Usuário"}
          </button>
        </form>

        {linkUserState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{linkUserState.error}</p> : null}
        {linkUserState.success ? <p className="mt-3 text-sm text-emerald-700">{linkUserState.success}</p> : null}
        {unlinkUserState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{unlinkUserState.error}</p> : null}
        {unlinkUserState.success ? <p className="mt-3 text-sm text-emerald-700">{unlinkUserState.success}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {users.map((user) => (
            <form key={user.userId} action={unlinkUserAction}>
              <input type="hidden" name="exhibitor_id" value={exhibitor.id} />
              <input type="hidden" name="user_id" value={user.userId} />
              <button
                type="submit"
                disabled={unlinkUserPending}
                className="rounded-full border border-[var(--outline-variant)]/45 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-70"
              >
                {user.email} ×
              </button>
            </form>
          ))}
          {!users.length ? <p className="text-sm text-muted">Nenhum usuário vinculado.</p> : null}
        </div>
      </div>

      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Vínculo com Eventos</h2>
        <p className="mt-1 text-sm text-muted">Vincule este expositor aos eventos e defina o stand em cada evento.</p>

        <form action={linkEventAction} className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
          <input type="hidden" name="exhibitor_id" value={exhibitor.id} />
          <select
            name="event_id"
            required
            defaultValue=""
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="" disabled>
              Selecione um evento
            </option>
            {availableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({event.status})
              </option>
            ))}
          </select>
          <input
            name="stand_name"
            placeholder="Stand (ex.: Stand 12)"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={linkEventPending || availableEvents.length === 0}
            className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          >
            {linkEventPending ? "Vinculando..." : "Vincular Evento"}
          </button>
        </form>

        {!availableEvents.length ? <p className="mt-3 text-sm text-muted">Este expositor já está em todos os eventos listados.</p> : null}
        {linkEventState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{linkEventState.error}</p> : null}
        {linkEventState.success ? <p className="mt-3 text-sm text-emerald-700">{linkEventState.success}</p> : null}
        {unlinkEventState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{unlinkEventState.error}</p> : null}
        {unlinkEventState.success ? <p className="mt-3 text-sm text-emerald-700">{unlinkEventState.success}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Stand</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {linkedEvents.map((item) => (
                <tr key={item.eventId}>
                  <td className="px-4 py-3 font-semibold">{item.eventName}</td>
                  <td className="px-4 py-3">{item.standName ?? "-"}</td>
                  <td className="px-4 py-3">{item.eventStatus}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={unlinkEventAction} className="inline">
                      <input type="hidden" name="exhibitor_id" value={exhibitor.id} />
                      <input type="hidden" name="event_id" value={item.eventId} />
                      <button
                        type="submit"
                        disabled={unlinkEventPending}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-70"
                      >
                        Desvincular
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!linkedEvents.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                    Nenhum evento vinculado a este expositor.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
