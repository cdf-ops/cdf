"use client";

import { useActionState, useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import {
  submitPublicRegistration,
  type PublicRegistrationState,
} from "@/app/inscricao/[eventId]/actions";
import { formatDateOnly } from "@/lib/date-time";
import { isValidBrazilianPhone } from "@/lib/domain/contacts";
import { isValidCpf } from "@/lib/domain/documents";
import {
  EXHIBITOR_CONSENT_TEXT,
  EXHIBITOR_MINIMUM_DATA_NOTICE,
} from "@/lib/exhibitors/data-sharing";

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
type FormField =
  | "fullName"
  | "documentNumber"
  | "email"
  | "phone"
  | "state"
  | "city"
  | "profession"
  | "selectedDays";

type RegistrationFormValues = {
  fullName: string;
  documentNumber: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  profession: string;
  selectedDays: string[];
};

const EMPTY_FORM_VALUES: RegistrationFormValues = {
  fullName: "",
  documentNumber: "",
  email: "",
  phone: "",
  state: "",
  city: "",
  profession: "",
  selectedDays: [],
};

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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validateForm(values: RegistrationFormValues, documentType: DocumentType) {
  const errors: Partial<Record<FormField, string>> = {};

  if (values.fullName.trim().length < 3) errors.fullName = "Informe o nome completo.";
  if (documentType === "CPF") {
    const cpfDigits = values.documentNumber.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      errors.documentNumber = "O CPF deve ter 11 números.";
    } else if (!isValidCpf(values.documentNumber)) {
      errors.documentNumber = "CPF inválido. Revise os números.";
    }
  } else if (values.documentNumber.trim().length < 3) {
    errors.documentNumber = "Informe o número do documento.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }
  if (!isValidBrazilianPhone(values.phone)) {
    errors.phone = "Informe DDD e telefone com 10 ou 11 números.";
  }
  if (!/^[A-Za-z]{2}$/.test(values.state.trim())) {
    errors.state = "Informe a sigla do estado com 2 letras.";
  }
  if (values.city.trim().length < 2) errors.city = "Informe a cidade.";
  if (values.profession.trim().length < 2) errors.profession = "Informe a profissão.";
  if (!values.selectedDays.length) errors.selectedDays = "Selecione ao menos um dia.";

  return errors;
}

export function PublicRegistrationForm({ eventId, eventDays, embedded = false }: PublicRegistrationFormProps) {
  const [documentType, setDocumentType] = useState<DocumentType>("CPF");
  const [values, setValues] = useState<RegistrationFormValues>(EMPTY_FORM_VALUES);
  const [touched, setTouched] = useState<Partial<Record<FormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [exhibitorDataSharing, setExhibitorDataSharing] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const registrationAction = useCallback(
    async (previousState: PublicRegistrationState, formData: FormData) => {
      const nextState = await submitPublicRegistration(previousState, formData);
      if (nextState.success) {
        setDocumentType("CPF");
        setValues(EMPTY_FORM_VALUES);
        setTouched({});
        setSubmitAttempted(false);
        setExhibitorDataSharing(true);
        formRef.current?.reset();
      }
      return nextState;
    },
    []
  );
  const [state, action, isPending] = useActionState(registrationAction, INITIAL_STATE);
  const documentInputConfig = DOCUMENT_INPUT_CONFIG[documentType];
  const errors = useMemo(() => validateForm(values, documentType), [documentType, values]);

  function handleDocumentTypeChange(nextDocumentType: DocumentType) {
    setDocumentType(nextDocumentType);
    setValues((current) => ({
      ...current,
      documentNumber: formatDocumentNumber(
        current.documentNumber.replace(/[^\p{L}\p{N}]/gu, ""),
        nextDocumentType
      ),
    }));
  }

  function updateValue(field: Exclude<FormField, "selectedDays">, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function markTouched(field: FormField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function toggleDay(dayId: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      selectedDays: checked
        ? [...current.selectedDays, dayId]
        : current.selectedDays.filter((item) => item !== dayId),
    }));
    markTouched("selectedDays");
  }

  function shouldShowError(field: FormField, live = false) {
    return Boolean(errors[field] && (submitAttempted || touched[field] || live));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitAttempted(true);
    if (Object.keys(errors).length) {
      event.preventDefault();
      const firstInvalidField = Object.keys(errors)[0] as FormField;
      const inputName = firstInvalidField === "selectedDays" ? "selected_days" : {
        fullName: "full_name",
        documentNumber: "document_number",
        email: "email",
        phone: "phone",
        state: "state",
        city: "city",
        profession: "profession",
      }[firstInvalidField];
      formRef.current?.querySelector<HTMLElement>(`[name="${inputName}"]`)?.focus();
    }
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onSubmit={handleSubmit}
      className={`surface-card mt-6 rounded-2xl p-6 ${embedded ? "" : "md:p-8"}`}
    >
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
            value={values.fullName}
            onChange={(event) => updateValue("fullName", event.target.value)}
            onBlur={() => markTouched("fullName")}
            aria-invalid={shouldShowError("fullName")}
            aria-describedby="full-name-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10 ${
              shouldShowError("fullName") ? "border-red-500" : "border-[var(--outline-variant)]/50 focus:border-[var(--primary)]"
            }`}
          />
          {shouldShowError("fullName") ? (
            <p id="full-name-feedback" className="mt-1.5 text-xs font-semibold text-red-600">{errors.fullName}</p>
          ) : null}
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
            value={values.documentNumber}
            onChange={(event) => updateValue("documentNumber", formatDocumentNumber(event.target.value, documentType))}
            onBlur={() => markTouched("documentNumber")}
            inputMode={documentType === "CPF" ? "numeric" : "text"}
            maxLength={documentInputConfig.maxLength}
            placeholder={documentInputConfig.placeholder}
            aria-invalid={shouldShowError("documentNumber", Boolean(values.documentNumber))}
            aria-describedby="document-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10 ${
              shouldShowError("documentNumber", Boolean(values.documentNumber))
                ? "border-red-500"
                : "border-[var(--outline-variant)]/50 focus:border-[var(--primary)]"
            }`}
          />
          {shouldShowError("documentNumber", Boolean(values.documentNumber)) ? (
            <p id="document-feedback" className="mt-1.5 text-xs font-semibold text-red-600">{errors.documentNumber}</p>
          ) : values.documentNumber && documentType === "CPF" ? (
            <p id="document-feedback" className="mt-1.5 text-xs font-semibold text-emerald-700">CPF válido.</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">E-mail</label>
          <input
            name="email"
            type="email"
            required
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            onBlur={() => markTouched("email")}
            autoComplete="email"
            aria-invalid={shouldShowError("email", Boolean(values.email))}
            aria-describedby="email-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10 ${
              shouldShowError("email", Boolean(values.email))
                ? "border-red-500"
                : "border-[var(--outline-variant)]/50 focus:border-[var(--primary)]"
            }`}
          />
          {shouldShowError("email", Boolean(values.email)) ? (
            <p id="email-feedback" className="mt-1.5 text-xs font-semibold text-red-600">{errors.email}</p>
          ) : values.email ? (
            <p id="email-feedback" className="mt-1.5 text-xs font-semibold text-emerald-700">E-mail válido.</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Telefone (DDD)</label>
          <input
            name="phone"
            required
            value={values.phone}
            onChange={(event) => updateValue("phone", formatPhone(event.target.value))}
            onBlur={() => markTouched("phone")}
            inputMode="tel"
            autoComplete="tel"
            maxLength={15}
            placeholder="(11) 99999-9999"
            aria-invalid={shouldShowError("phone", Boolean(values.phone))}
            aria-describedby="phone-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10 ${
              shouldShowError("phone", Boolean(values.phone))
                ? "border-red-500"
                : "border-[var(--outline-variant)]/50 focus:border-[var(--primary)]"
            }`}
          />
          {shouldShowError("phone", Boolean(values.phone)) ? (
            <p id="phone-feedback" className="mt-1.5 text-xs font-semibold text-red-600">{errors.phone}</p>
          ) : values.phone ? (
            <p id="phone-feedback" className="mt-1.5 text-xs font-semibold text-emerald-700">Telefone válido.</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Estado</label>
          <input
            name="state"
            required
            value={values.state}
            onChange={(event) => updateValue("state", event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2))}
            onBlur={() => markTouched("state")}
            maxLength={2}
            placeholder="SP"
            aria-invalid={shouldShowError("state", Boolean(values.state))}
            aria-describedby="state-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm uppercase outline-none focus:ring-2 focus:ring-[var(--primary)]/10 ${
              shouldShowError("state", Boolean(values.state))
                ? "border-red-500"
                : "border-[var(--outline-variant)]/50 focus:border-[var(--primary)]"
            }`}
          />
          {shouldShowError("state", Boolean(values.state)) ? (
            <p id="state-feedback" className="mt-1.5 text-xs font-semibold text-red-600">{errors.state}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Cidade</label>
          <input
            name="city"
            required
            value={values.city}
            onChange={(event) => updateValue("city", event.target.value)}
            onBlur={() => markTouched("city")}
            aria-invalid={shouldShowError("city")}
            aria-describedby="city-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10 ${
              shouldShowError("city") ? "border-red-500" : "border-[var(--outline-variant)]/50 focus:border-[var(--primary)]"
            }`}
          />
          {shouldShowError("city") ? (
            <p id="city-feedback" className="mt-1.5 text-xs font-semibold text-red-600">{errors.city}</p>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Profissão</label>
          <input
            name="profession"
            required
            value={values.profession}
            onChange={(event) => updateValue("profession", event.target.value)}
            onBlur={() => markTouched("profession")}
            aria-invalid={shouldShowError("profession")}
            aria-describedby="profession-feedback"
            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10 ${
              shouldShowError("profession") ? "border-red-500" : "border-[var(--outline-variant)]/50 focus:border-[var(--primary)]"
            }`}
          />
          {shouldShowError("profession") ? (
            <p id="profession-feedback" className="mt-1.5 text-xs font-semibold text-red-600">{errors.profession}</p>
          ) : null}
        </div>
      </div>

      <fieldset
        className={`mt-6 rounded-xl border bg-[var(--surface-container-low)] p-4 ${
          shouldShowError("selectedDays") ? "border-red-500" : "border-[var(--outline-variant)]/35"
        }`}
        aria-describedby="selected-days-feedback"
      >
        <legend className="px-1 font-headline text-lg font-bold tracking-tight text-[var(--foreground)]">Dias do Evento</legend>
        <p className="mt-1 text-sm text-muted">Selecione os dias em que você pretende participar.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {eventDays.map((day) => (
            <label
              key={day.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--outline-variant)]/45 bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="selected_days"
                value={day.id}
                checked={values.selectedDays.includes(day.id)}
                onChange={(event) => toggleDay(day.id, event.target.checked)}
              />
              <span>{formatDateOnly(day.date)}</span>
            </label>
          ))}
        </div>
        {shouldShowError("selectedDays") ? (
          <p id="selected-days-feedback" className="mt-2 text-xs font-semibold text-red-600">{errors.selectedDays}</p>
        ) : null}
      </fieldset>

      <div className="mt-5 space-y-3">
        <p className="rounded-xl border border-[var(--outline-variant)]/35 bg-[var(--surface-container-low)] p-4 text-xs leading-5 text-muted">
          Ao concluir a inscrição, seus dados serão utilizados pela organização para gestão do evento,
          comunicação, credenciamento e controle de participação.
        </p>
        <div className="rounded-xl border border-[var(--outline-variant)]/35 bg-white p-4">
          <p className="text-sm font-bold text-[var(--foreground)]">Identificação durante a visita aos estandes</p>
          <p className="mt-1 text-xs leading-5 text-muted">{EXHIBITOR_MINIMUM_DATA_NOTICE}</p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-soft)]/20 p-4">
          <input
            type="checkbox"
            name="exhibitor_data_sharing"
            checked={exhibitorDataSharing}
            onChange={(event) => setExhibitorDataSharing(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
          />
          <span>
            <span className="block text-sm font-bold text-[var(--foreground)]">
              Autorizar dados adicionais
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted">{EXHIBITOR_CONSENT_TEXT}</span>
            <span className="mt-2 block text-xs font-semibold text-[var(--foreground)]">
              Esta escolha é opcional e não interfere na sua inscrição ou entrada no evento.
            </span>
          </span>
        </label>
      </div>

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
