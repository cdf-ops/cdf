"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";

const INITIAL_STATE: LoginState = {
  error: null,
};

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, action, isPending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={action} className="surface-card w-full max-w-md rounded-2xl p-8">
      <input type="hidden" name="next" value={nextPath ?? "/events"} />
      <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
        Clube do Frio
      </h1>
      <p className="mt-2 text-sm text-muted">Acesse o ProduEvent para gerenciar seus eventos.</p>

      <div className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="voce@empresa.com"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>
      </div>

      {state.error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="gradient-primary mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
