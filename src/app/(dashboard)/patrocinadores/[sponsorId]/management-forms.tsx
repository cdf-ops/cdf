"use client";

import { useActionState } from "react";
import {
  createSponsorTeamMemberAction,
  resetSponsorPasswordAction,
  revealSponsorPasswordAction,
  updateSponsorAction,
  updateSponsorTeamMemberAction,
  type SponsorActionState,
} from "@/app/(dashboard)/patrocinadores/actions";

const INITIAL_STATE: SponsorActionState = { error: null, success: null };
const inputClass = "rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]";

function Notice({ state }: { state: SponsorActionState }) {
  return (
    <>
      {state.error ? <p className="mt-3 text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">{state.success}</p> : null}
    </>
  );
}

export function SponsorDetailsForm({ sponsor }: { sponsor: { id: string; name: string; username: string; status: "active" | "inactive" } }) {
  const [state, action, pending] = useActionState(updateSponsorAction, INITIAL_STATE);
  return (
    <form action={action} className="surface-card rounded-xl p-5">
      <input type="hidden" name="sponsor_id" value={sponsor.id} />
      <h2 className="font-headline text-xl font-bold">Cadastro e acesso</h2>
      <p className="mt-1 text-sm text-muted">O usuário é compartilhado pela equipe e não expira automaticamente.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_180px_auto]">
        <label className="grid gap-1 text-sm font-semibold">Nome<input name="name" required maxLength={160} defaultValue={sponsor.name} className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold">Usuário<input name="username" required minLength={3} maxLength={80} defaultValue={sponsor.username} autoCapitalize="none" autoCorrect="off" className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold">Status<select name="status" defaultValue={sponsor.status} className={inputClass}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
        <button type="submit" disabled={pending} className="gradient-primary self-end rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70">{pending ? "Salvando..." : "Salvar"}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}

export function SponsorPasswordManagement({ sponsorId, canReveal }: { sponsorId: string; canReveal: boolean }) {
  const [resetState, resetAction, resetPending] = useActionState(resetSponsorPasswordAction, INITIAL_STATE);
  const [revealState, revealAction, revealPending] = useActionState(revealSponsorPasswordAction, INITIAL_STATE);
  return (
    <div className="surface-card rounded-xl p-5">
      <h2 className="font-headline text-xl font-bold">Senha do patrocinador</h2>
      <p className="mt-1 text-sm text-muted">Redefinir encerra todas as sessões abertas. A senha nunca aparece em listas ou exportações.</p>
      <form action={resetAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="sponsor_id" value={sponsorId} />
        <input name="password" type="password" required minLength={5} maxLength={128} autoComplete="new-password" placeholder="Nova senha (mínimo 5 caracteres)" className={`${inputClass} flex-1`} />
        <button type="submit" disabled={resetPending} className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70">{resetPending ? "Redefinindo..." : "Redefinir senha"}</button>
      </form>
      <Notice state={resetState} />

      {canReveal ? (
        <form action={revealAction} className="mt-5 border-t border-[var(--outline-variant)]/35 pt-5">
          <input type="hidden" name="sponsor_id" value={sponsorId} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="submit" disabled={revealPending} className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] disabled:opacity-70">{revealPending ? "Abrindo cofre..." : "Mostrar senha atual"}</button>
            {revealState.revealedPassword ? <output aria-live="polite" className="rounded-xl bg-amber-50 px-4 py-2.5 font-mono text-sm font-bold text-amber-950">{revealState.revealedPassword}</output> : null}
          </div>
          <Notice state={revealState} />
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-[var(--surface-container)] px-4 py-3 text-sm text-muted">Organizadores podem redefinir a senha, mas somente o Super Administrador pode revelar a atual.</p>
      )}
    </div>
  );
}

export function CreateSponsorTeamMemberForm({ sponsorId }: { sponsorId: string }) {
  const [state, action, pending] = useActionState(createSponsorTeamMemberAction, INITIAL_STATE);
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
      <input type="hidden" name="sponsor_id" value={sponsorId} />
      <input name="full_name" required maxLength={160} placeholder="Nome completo" className={inputClass} />
      <input name="job_title" maxLength={120} placeholder="Cargo ou função (opcional)" className={inputClass} />
      <button type="submit" disabled={pending} className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70">{pending ? "Adicionando..." : "Adicionar integrante"}</button>
      <div className="md:col-span-3"><Notice state={state} /></div>
    </form>
  );
}

export function SponsorTeamMemberForm({ sponsorId, member }: { sponsorId: string; member: { id: string; fullName: string; jobTitle: string | null; status: "active" | "inactive"; code: string } }) {
  const [state, action, pending] = useActionState(updateSponsorTeamMemberAction, INITIAL_STATE);
  return (
    <form action={action} className="grid gap-3 border-t border-[var(--surface-container)] py-4 first:border-t-0 md:grid-cols-[120px_1.4fr_1fr_150px_auto] md:items-end">
      <input type="hidden" name="sponsor_id" value={sponsorId} />
      <input type="hidden" name="member_id" value={member.id} />
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Código</p><p className="mt-2 font-mono text-sm font-bold">{member.code}</p></div>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Nome<input name="full_name" required maxLength={160} defaultValue={member.fullName} className={`${inputClass} font-normal normal-case tracking-normal text-[var(--foreground)]`} /></label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Cargo<input name="job_title" maxLength={120} defaultValue={member.jobTitle ?? ""} className={`${inputClass} font-normal normal-case tracking-normal text-[var(--foreground)]`} /></label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Status<select name="status" defaultValue={member.status} className={`${inputClass} font-normal normal-case tracking-normal text-[var(--foreground)]`}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
      <button type="submit" disabled={pending} className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--primary)] disabled:opacity-70">{pending ? "Salvando..." : "Salvar"}</button>
      {(state.error || state.success) ? <div className="md:col-start-2 md:col-end-6"><Notice state={state} /></div> : null}
    </form>
  );
}

