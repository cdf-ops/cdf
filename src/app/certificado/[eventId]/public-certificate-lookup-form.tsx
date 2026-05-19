"use client";

import Link from "next/link";
import { useActionState } from "react";
import { lookupPublicCertificate, type PublicCertificateLookupState } from "@/app/certificado/[eventId]/actions";

type PublicCertificateLookupFormProps = {
  eventId: string;
};

const INITIAL_STATE: PublicCertificateLookupState = {
  error: null,
  eligibleDays: [],
};

export function PublicCertificateLookupForm({ eventId }: PublicCertificateLookupFormProps) {
  const [actionState, action, isPending] = useActionState(lookupPublicCertificate, INITIAL_STATE);
  const state = actionState ?? INITIAL_STATE;

  return (
    <div className="surface-card mt-6 rounded-2xl p-5 shadow-sm">
      <form action={action} className="space-y-4">
        <input type="hidden" name="event_id" value={eventId} />

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Tipo de Documento</label>
          <select
            name="document_type"
            defaultValue="CPF"
            className="h-12 w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          >
            <option value="CPF">CPF</option>
            <option value="PASSAPORTE">Passaporte</option>
            <option value="RNE">RNE</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Número do Documento</label>
          <input
            name="document_number"
            required
            inputMode="text"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            placeholder="Digite como usou na inscrição"
          />
        </div>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="gradient-primary h-12 w-full rounded-xl px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Verificando..." : "Acessar Certificado"}
        </button>
      </form>

      {state.eligibleDays.length > 1 ? (
        <div className="mt-5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4">
          <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">Escolha o dia do certificado</h2>
          <div className="mt-3 grid gap-2">
            {state.eligibleDays.map((day) => (
              <Link
                key={day.id}
                href={`/certificado/${eventId}/visualizar?token=${encodeURIComponent(day.token)}`}
                className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-sm"
              >
                {new Date(`${day.date}T12:00:00`).toLocaleDateString("pt-BR")}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
