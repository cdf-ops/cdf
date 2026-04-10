"use client";

import { useActionState } from "react";
import {
  createParticipantAction,
  type CreateParticipantState,
} from "@/app/(dashboard)/events/[eventId]/participants/actions";

type CreateParticipantFormProps = {
  eventId: string;
  eventDays: { id: string; date: string }[];
  canCreate: boolean;
};

const INITIAL_STATE: CreateParticipantState = {
  error: null,
  success: null,
};

export function CreateParticipantForm({ eventId, eventDays, canCreate }: CreateParticipantFormProps) {
  const [state, action, isPending] = useActionState(createParticipantAction, INITIAL_STATE);

  if (!canCreate) {
    return null;
  }

  return (
    <form action={action} className="surface-card mb-6 rounded-xl p-5">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="mb-3">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Novo Participante</h3>
        <p className="text-sm text-muted">Cadastro rápido para recepção (mesmos campos da inscrição).</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          name="full_name"
          required
          placeholder="Nome completo"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        <select
          name="document_type"
          defaultValue="CPF"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="CPF">CPF</option>
          <option value="PASSAPORTE">Passaporte</option>
          <option value="RNE">RNE</option>
          <option value="OUTRO">Outro</option>
        </select>
        <input
          name="document_number"
          required
          placeholder="Documento"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="E-mail"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="phone"
          required
          placeholder="Telefone"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="profession"
          required
          placeholder="Profissão"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="state"
          required
          placeholder="Estado"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        <input
          name="city"
          required
          placeholder="Cidade"
          className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--outline-variant)]/45 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Dias do Evento</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {eventDays.map((day) => (
            <label key={day.id} className="inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs">
              <input type="checkbox" name="selected_days" value={day.id} />
              {new Date(day.date).toLocaleDateString("pt-BR")}
            </label>
          ))}
        </div>
      </div>

      {state.error ? <p className="mt-3 text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">{state.success}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="gradient-primary mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
      >
        {isPending ? "Salvando..." : "Salvar Participante"}
      </button>
    </form>
  );
}

