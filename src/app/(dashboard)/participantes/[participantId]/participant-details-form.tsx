"use client";

import { useActionState } from "react";
import {
  updateParticipantDetailsAction,
  type ParticipantDetailState,
} from "@/app/(dashboard)/participantes/[participantId]/actions";

type ParticipantDetailsFormProps = {
  participant: {
    id: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    email: string;
    phone: string;
    state: string;
    city: string;
    profession: string;
  };
};

const INITIAL_STATE: ParticipantDetailState = {
  error: null,
  success: null,
};

export function ParticipantDetailsForm({ participant }: ParticipantDetailsFormProps) {
  const [state, action, isPending] = useActionState(updateParticipantDetailsAction, INITIAL_STATE);

  return (
    <form action={action} className="surface-card rounded-xl p-5">
      <input type="hidden" name="participant_id" value={participant.id} />
      <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Dados Cadastrais</h2>
      <p className="mt-1 text-sm text-muted">Atualize os dados globais usados nas inscrições e nos check-ins.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          name="full_name"
          required
          defaultValue={participant.fullName}
          placeholder="Nome completo"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] md:col-span-2"
        />
        <input
          name="document_type"
          required
          defaultValue={participant.documentType}
          placeholder="Tipo de documento"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="document_number"
          required
          defaultValue={participant.documentNumber}
          placeholder="Número do documento"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="email"
          type="email"
          required
          defaultValue={participant.email}
          placeholder="E-mail"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="phone"
          required
          defaultValue={participant.phone}
          placeholder="Telefone"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="state"
          required
          defaultValue={participant.state}
          placeholder="Estado"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="city"
          required
          defaultValue={participant.city}
          placeholder="Cidade"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="profession"
          required
          defaultValue={participant.profession}
          placeholder="Profissão"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] md:col-span-2"
        />
      </div>

      {state.error ? <p className="mt-3 text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">{state.success}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="gradient-primary mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
      >
        {isPending ? "Salvando..." : "Salvar Dados"}
      </button>
    </form>
  );
}
