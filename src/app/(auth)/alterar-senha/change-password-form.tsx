"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/(auth)/alterar-senha/actions";

const INITIAL_STATE: ChangePasswordState = { error: null };

export function ChangePasswordForm({ recovery }: { recovery: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, INITIAL_STATE);

  return (
    <form action={action} className="surface-card w-full max-w-md rounded-2xl p-8">
      <input type="hidden" name="recovery" value={String(recovery)} />
      <h1 className="font-headline text-3xl font-extrabold tracking-tight">Crie uma nova senha</h1>
      <p className="mt-2 text-sm text-muted">
        {recovery
          ? "Escolha uma nova senha para recuperar sua conta."
          : "Por segurança, substitua a senha temporária antes de acessar o sistema."}
      </p>

      <div className="mt-6 space-y-4">
        {!recovery ? (
          <label className="block text-sm font-semibold">
            Senha temporária
            <input
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
            />
          </label>
        ) : null}
        <label className="block text-sm font-semibold">
          Nova senha
          <input
            name="new_password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Confirmar nova senha
          <input
            name="confirm_password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-muted">Use pelo menos 10 caracteres e evite senhas usadas em outros serviços.</p>
      {state.error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="gradient-primary mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Salvando nova senha..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
