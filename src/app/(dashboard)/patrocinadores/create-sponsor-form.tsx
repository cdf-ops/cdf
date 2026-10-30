"use client";

import { useActionState } from "react";
import {
  createSponsorAction,
  type SponsorActionState,
} from "@/app/(dashboard)/patrocinadores/actions";

const INITIAL_STATE: SponsorActionState = { error: null, success: null };

export function CreateSponsorForm() {
  const [state, action, pending] = useActionState(createSponsorAction, INITIAL_STATE);

  return (
    <form action={action} className="surface-card rounded-xl p-5">
      <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Novo patrocinador</h2>
      <p className="mt-1 text-sm text-muted">Cadastro mínimo, global e sem vínculo prévio com eventos.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label className="grid gap-1 text-sm font-semibold">
          Nome
          <input name="name" required maxLength={160} className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 font-normal outline-none focus:border-[var(--primary)]" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Usuário
          <input name="username" required minLength={3} maxLength={80} autoCapitalize="none" autoCorrect="off" className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 font-normal outline-none focus:border-[var(--primary)]" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Senha inicial
          <input name="password" type="password" required minLength={5} maxLength={128} autoComplete="new-password" className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 font-normal outline-none focus:border-[var(--primary)]" />
        </label>
        <button type="submit" disabled={pending} className="gradient-primary self-end rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70">
          {pending ? "Salvando..." : "Cadastrar"}
        </button>
      </div>
      {state.error ? <p className="mt-3 text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  );
}

