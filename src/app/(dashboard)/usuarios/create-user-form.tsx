"use client";

import { useActionState } from "react";
import { createUserAction, type CreateUserState } from "@/app/(dashboard)/usuarios/actions";

const INITIAL_STATE: CreateUserState = {
  error: null,
  success: null,
};

export function CreateUserForm() {
  const [state, action, isPending] = useActionState(createUserAction, INITIAL_STATE);

  return (
    <form action={action} className="surface-card rounded-xl p-5">
      <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Novo Usuário</h3>
      <p className="mt-1 text-sm text-muted">
        Crie usuários administrativos ou de recepção. Expositores são cadastrados dentro da empresa.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
        <input
          name="email"
          type="email"
          required
          placeholder="usuario@empresa.com"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <select
          name="role"
          defaultValue="recepcao"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="super_adm">Super ADM</option>
          <option value="organizador">Organizador</option>
          <option value="recepcao">Recepção</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {isPending ? "Cadastrando..." : "Cadastrar Usuário"}
        </button>
      </div>

      {state.error ? <p className="mt-3 text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  );
}
