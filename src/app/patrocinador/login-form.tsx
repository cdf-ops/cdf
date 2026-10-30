"use client";

import { useActionState } from "react";
import { sponsorLoginAction, type SponsorLoginState } from "@/app/patrocinador/actions";

const INITIAL_STATE: SponsorLoginState = { error: null };

export function SponsorLoginForm() {
  const [state, action, pending] = useActionState(sponsorLoginAction, INITIAL_STATE);
  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="grid gap-1.5 text-sm font-semibold">Usuário<input name="username" required minLength={3} maxLength={80} autoCapitalize="none" autoCorrect="off" autoComplete="username" className="min-h-12 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 outline-none focus:border-[var(--primary)]" /></label>
      <label className="grid gap-1.5 text-sm font-semibold">Senha<input name="password" type="password" required minLength={5} maxLength={128} autoComplete="current-password" className="min-h-12 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 outline-none focus:border-[var(--primary)]" /></label>
      {state.error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="gradient-primary min-h-12 w-full rounded-xl px-5 text-base font-bold text-white shadow disabled:opacity-70">{pending ? "Entrando..." : "Entrar"}</button>
    </form>
  );
}

