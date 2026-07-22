"use client";

import { useActionState, useState } from "react";
import {
  submitPublicRegistration,
  type PublicRegistrationState,
} from "@/app/inscricao/[eventId]/actions";

type PublicRegistrationFormProps = {
  eventId: string;
  eventDays: { id: string; date: string }[];
  embedded?: boolean;
};

const INITIAL_STATE: PublicRegistrationState = {
  error: null,
  success: null,
  credentialUrl: null,
};

type DocumentType = "CPF" | "RNE" | "OUTRO";

const DOCUMENT_INPUT_CONFIG: Record<DocumentType, { maxLength?: number; placeholder?: string }> = {
  CPF: { maxLength: 14, placeholder: "111.111.111-11" },
  RNE: { maxLength: 9, placeholder: "A000000-0" },
  OUTRO: {},
};

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatRne(value: string) {
  const compactValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const initialLetter = compactValue.match(/[A-Z]/)?.[0] ?? "";
  const digits = compactValue.replace(/\D/g, "").slice(0, 7);

  if (!initialLetter) return "";
  if (digits.length <= 6) return `${initialLetter}${digits}`;
  return `${initialLetter}${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function formatDocumentNumber(value: string, documentType: DocumentType) {
  if (documentType === "CPF") return formatCpf(value);
  if (documentType === "RNE") return formatRne(value);
  return value;
}

export function PublicRegistrationForm({ eventId, eventDays, embedded = false }: PublicRegistrationFormProps) {
  const [state, action, isPending] = useActionState(submitPublicRegistration, INITIAL_STATE);
  const [documentType, setDocumentType] = useState<DocumentType>("CPF");
  const [documentNumber, setDocumentNumber] = useState("");
  const documentInputConfig = DOCUMENT_INPUT_CONFIG[documentType];

  function handleDocumentTypeChange(nextDocumentType: DocumentType) {
    setDocumentType(nextDocumentType);
    setDocumentNumber(formatDocumentNumber(documentNumber.replace(/[^\p{L}\p{N}]/gu, ""), nextDocumentType));
  }

  return (
    <form action={action} className={`surface-card mt-6 rounded-2xl p-6 ${embedded ? "" : "md:p-8"}`}>
      <input type="hidden" name="event_id" value={eventId} />
      <div className="hidden" aria-hidden="true">
        <label>
          Site
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Nome Completo</label>
          <input
            name="full_name"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Tipo de Documento</label>
          <select
            name="document_type"
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            value={documentType}
            onChange={(event) => handleDocumentTypeChange(event.target.value as DocumentType)}
          >
            <option value="CPF">CPF</option>
            <option value="RNE">RNE</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Número do Documento</label>
          <input
            name="document_number"
            required
            value={documentNumber}
            onChange={(event) => setDocumentNumber(formatDocumentNumber(event.target.value, documentType))}
            inputMode={documentType === "CPF" ? "numeric" : "text"}
            maxLength={documentInputConfig.maxLength}
            placeholder={documentInputConfig.placeholder}
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">E-mail</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Telefone (DDD)</label>
          <input
            name="phone"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Estado</label>
          <input
            name="state"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Cidade</label>
          <input
            name="city"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Profissão</label>
          <input
            name="profession"
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--outline-variant)]/35 bg-[var(--surface-container-low)] p-4">
        <h2 className="font-headline text-lg font-bold tracking-tight text-[var(--foreground)]">Dias do Evento</h2>
        <p className="mt-1 text-sm text-muted">Selecione os dias em que você pretende participar.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {eventDays.map((day) => (
            <label
              key={day.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--outline-variant)]/45 bg-white px-3 py-2 text-sm"
            >
              <input type="checkbox" name="selected_days" value={day.id} />
              <span>{new Date(day.date).toLocaleDateString("pt-BR")}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="mt-5 rounded-xl border border-[var(--outline-variant)]/35 bg-[var(--surface-container-low)] p-4 text-xs leading-5 text-muted">
        Ao concluir a inscrição, você concorda com o uso dos dados informados para a gestão deste evento,
        incluindo comunicação, credenciamento e controle de participação. Seus dados serão tratados de forma
        restrita a essas finalidades.
      </p>

      {state.error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <p>{state.success}</p>
          {state.credentialUrl ? (
            <a
              href={state.credentialUrl}
              className="mt-3 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-800"
            >
              Baixar minha credencial em PDF
            </a>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="gradient-primary mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Enviando..." : "Concluir Inscrição"}
      </button>
    </form>
  );
}
