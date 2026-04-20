"use client";

import { useActionState } from "react";
import {
  createExhibitorCompanyAction,
  linkCompanyToEventAction,
  linkExhibitorUserAction,
  removeCompanyFromEventAction,
  unlinkExhibitorUserAction,
  type ExhibitorFormState,
} from "@/app/(dashboard)/events/[eventId]/expositores/actions";

type CompanyOption = {
  id: string;
  name: string;
};

type EventCompanyOption = {
  id: string;
  name: string;
  standName: string | null;
};

type EventCompanyRow = {
  id: string;
  name: string;
  standName: string | null;
  users: Array<{
    userId: string;
    email: string;
  }>;
};

type ExhibitorFormsProps = {
  eventId: string;
  allCompanies: CompanyOption[];
  eventCompanies: EventCompanyOption[];
  eventCompanyRows: EventCompanyRow[];
};

const INITIAL_STATE: ExhibitorFormState = {
  error: null,
  success: null,
};

export function ExhibitorForms({ eventId, allCompanies, eventCompanies, eventCompanyRows }: ExhibitorFormsProps) {
  const [createCompanyState, createCompanyFormAction, createCompanyPending] = useActionState(
    createExhibitorCompanyAction,
    INITIAL_STATE
  );
  const [linkCompanyState, linkCompanyFormAction, linkCompanyPending] = useActionState(linkCompanyToEventAction, INITIAL_STATE);
  const [linkUserState, linkUserFormAction, linkUserPending] = useActionState(linkExhibitorUserAction, INITIAL_STATE);
  const [removeCompanyState, removeCompanyFormAction, removeCompanyPending] = useActionState(
    removeCompanyFromEventAction,
    INITIAL_STATE
  );
  const [unlinkUserState, unlinkUserFormAction, unlinkUserPending] = useActionState(unlinkExhibitorUserAction, INITIAL_STATE);

  return (
    <div className="space-y-6">
      <form action={createCompanyFormAction} className="surface-card rounded-xl p-5">
        <input type="hidden" name="event_id" value={eventId} />
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Cadastrar Empresa Expositora</h3>
        <p className="mt-1 text-sm text-muted">Cadastre a empresa para reutilizar em eventos futuros.</p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            name="company_name"
            required
            placeholder="Nome da empresa expositora"
            className="flex-1 rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={createCompanyPending}
            className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          >
            {createCompanyPending ? "Salvando..." : "Cadastrar Empresa"}
          </button>
        </div>
        {createCompanyState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{createCompanyState.error}</p> : null}
        {createCompanyState.success ? <p className="mt-3 text-sm text-emerald-700">{createCompanyState.success}</p> : null}
      </form>

      <form action={linkCompanyFormAction} className="surface-card rounded-xl p-5">
        <input type="hidden" name="event_id" value={eventId} />
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Vincular Empresa ao Evento</h3>
        <p className="mt-1 text-sm text-muted">Defina o stand físico da empresa neste evento.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_1fr_auto]">
          <select
            name="company_id"
            required
            defaultValue=""
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="" disabled>
              Selecione uma empresa
            </option>
            {allCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <input
            name="stand_name"
            placeholder="Stand (ex.: Stand 14)"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={linkCompanyPending || allCompanies.length === 0}
            className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          >
            {linkCompanyPending ? "Vinculando..." : "Vincular"}
          </button>
        </div>
        {!allCompanies.length ? (
          <p className="mt-3 text-sm text-muted">Cadastre ao menos uma empresa expositora para continuar.</p>
        ) : null}
        {linkCompanyState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{linkCompanyState.error}</p> : null}
        {linkCompanyState.success ? <p className="mt-3 text-sm text-emerald-700">{linkCompanyState.success}</p> : null}
      </form>

      <form action={linkUserFormAction} className="surface-card rounded-xl p-5">
        <input type="hidden" name="event_id" value={eventId} />
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Vincular Usuário Expositor</h3>
        <p className="mt-1 text-sm text-muted">
          Informe o e-mail do expositor. Se ainda não existir no Auth, o usuário será criado automaticamente com senha
          temporária e perfil expositor.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.1fr_auto]">
          <input
            name="user_email"
            type="email"
            required
            placeholder="expositor@empresa.com"
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <select
            name="company_id"
            required
            defaultValue=""
            className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="" disabled>
              Selecione o expositor do evento
            </option>
            {eventCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
                {company.standName ? ` (${company.standName})` : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={linkUserPending || eventCompanies.length === 0}
            className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          >
            {linkUserPending ? "Vinculando..." : "Vincular Usuário"}
          </button>
        </div>
        {!eventCompanies.length ? (
          <p className="mt-3 text-sm text-muted">Vincule ao menos uma empresa ao evento antes de vincular usuários.</p>
        ) : null}
        {linkUserState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{linkUserState.error}</p> : null}
        {linkUserState.success ? <p className="mt-3 text-sm text-emerald-700">{linkUserState.success}</p> : null}
      </form>

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Vínculos Atuais no Evento</h3>
        <p className="mt-1 text-sm text-muted">Gerencie desvínculos de usuário e remoção de empresa do evento.</p>

        {removeCompanyState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{removeCompanyState.error}</p> : null}
        {removeCompanyState.success ? <p className="mt-3 text-sm text-emerald-700">{removeCompanyState.success}</p> : null}
        {unlinkUserState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{unlinkUserState.error}</p> : null}
        {unlinkUserState.success ? <p className="mt-3 text-sm text-emerald-700">{unlinkUserState.success}</p> : null}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Stand</th>
                <th className="px-4 py-3">Usuários Expositores</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {eventCompanyRows.map((company) => (
                <tr key={company.id}>
                  <td className="px-4 py-3 font-semibold">{company.name}</td>
                  <td className="px-4 py-3">{company.standName ?? "-"}</td>
                  <td className="px-4 py-3">
                    {company.users.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {company.users.map((user) => (
                          <form key={`${company.id}-${user.userId}`} action={unlinkUserFormAction}>
                            <input type="hidden" name="event_id" value={eventId} />
                            <input type="hidden" name="company_id" value={company.id} />
                            <input type="hidden" name="user_id" value={user.userId} />
                            <button
                              type="submit"
                              disabled={unlinkUserPending}
                              className="rounded-full border border-[var(--outline-variant)]/45 bg-white px-2 py-1 text-xs font-semibold text-[var(--foreground)] disabled:opacity-70"
                            >
                              {user.email} ×
                            </button>
                          </form>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Nenhum usuário vinculado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={removeCompanyFormAction} className="inline">
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="company_id" value={company.id} />
                      <button
                        type="submit"
                        disabled={removeCompanyPending}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-70"
                      >
                        Remover do Evento
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!eventCompanyRows.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                    Nenhuma empresa expositora vinculada a este evento.
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
