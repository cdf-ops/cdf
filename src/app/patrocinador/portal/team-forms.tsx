"use client";

import { useActionState } from "react";
import {
  createOwnTeamMemberAction,
  updateOwnTeamMemberAction,
  type SponsorPortalActionState,
} from "@/app/patrocinador/portal/actions";

const INITIAL_STATE: SponsorPortalActionState = { error: null, success: null };
const inputClass = "min-h-11 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm outline-none focus:border-[var(--primary)]";

function Notice({ state }: { state: SponsorPortalActionState }) {
  return <>{state.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}{state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}</>;
}

export function SponsorPortalCreateMemberForm() {
  const [state, action, pending] = useActionState(createOwnTeamMemberAction, INITIAL_STATE);
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
      <input name="full_name" required maxLength={160} placeholder="Nome completo" className={inputClass} />
      <input name="job_title" maxLength={120} placeholder="Cargo (opcional)" className={inputClass} />
      <button type="submit" disabled={pending} className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-70">{pending ? "Adicionando..." : "Adicionar"}</button>
      <div className="md:col-span-3"><Notice state={state} /></div>
    </form>
  );
}

export function SponsorPortalMemberForm({ member }: { member: { id: string; code: string; fullName: string; jobTitle: string | null; status: "active" | "inactive" } }) {
  const [state, action, pending] = useActionState(updateOwnTeamMemberAction, INITIAL_STATE);
  return (
    <form action={action} className="grid gap-3 border-t border-[var(--surface-container)] py-4 first:border-0 md:grid-cols-[120px_1.3fr_1fr_140px_auto] md:items-end">
      <input type="hidden" name="member_id" value={member.id} />
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Código</p><p className="mt-2 font-mono text-sm font-bold">{member.code}</p></div>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Nome<input name="full_name" required defaultValue={member.fullName} maxLength={160} className={`${inputClass} font-normal normal-case tracking-normal text-[var(--foreground)]`} /></label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Cargo<input name="job_title" defaultValue={member.jobTitle ?? ""} maxLength={120} className={`${inputClass} font-normal normal-case tracking-normal text-[var(--foreground)]`} /></label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Status<select name="status" defaultValue={member.status} className={`${inputClass} font-normal normal-case tracking-normal text-[var(--foreground)]`}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
      <button type="submit" disabled={pending} className="min-h-11 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 text-sm font-semibold text-[var(--primary)] disabled:opacity-70">{pending ? "Salvando..." : "Salvar"}</button>
      {(state.error || state.success) ? <div className="md:col-start-2 md:col-end-6"><Notice state={state} /></div> : null}
    </form>
  );
}

