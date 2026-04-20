"use client";

import { useActionState } from "react";
import { createExhibitorAction, type CreateExhibitorState } from "@/app/(dashboard)/expositores/actions";

const INITIAL_STATE: CreateExhibitorState = {
  error: null,
  success: null,
};

export function CreateExhibitorForm() {
  const [state, formAction, isPending] = useActionState(createExhibitorAction, INITIAL_STATE);

  return (
    <form action={formAction} className="surface-card rounded-xl p-5">
      <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Novo Expositor</h3>
      <p className="mt-1 text-sm text-muted">Cadastre os dados principais do expositor para gestão centralizada.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          name="trade_name"
          required
          placeholder="Nome fantasia"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="legal_name"
          required
          placeholder="Razão social"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="cnpj"
          required
          placeholder="CNPJ (somente números ou formatado)"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="phone"
          required
          placeholder="Telefone"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="email"
          type="email"
          placeholder="E-mail principal"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="contact_name"
          placeholder="Responsável"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
      </div>

      <textarea
        name="notes"
        placeholder="Observações"
        className="mt-3 min-h-24 w-full rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
      />

      {state.error ? <p className="mt-3 text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">{state.success}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="gradient-primary mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
      >
        {isPending ? "Salvando..." : "Cadastrar Expositor"}
      </button>
    </form>
  );
}
