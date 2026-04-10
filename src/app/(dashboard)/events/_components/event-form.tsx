"use client";

import { useMemo, useState } from "react";

type EventFormProps = {
  mode: "create" | "update";
  action: (formData: FormData) => void | Promise<void>;
  initialData?: {
    id: string;
    name: string;
    location: string;
    status: "rascunho" | "ativo" | "encerrado";
    details: string | null;
    dates: string[];
  };
};

function toInputDate(date: string) {
  return date.length > 10 ? date.slice(0, 10) : date;
}

export function EventForm({ mode, action, initialData }: EventFormProps) {
  const [dates, setDates] = useState<string[]>(
    initialData?.dates.length ? initialData.dates.map(toInputDate) : [new Date().toISOString().slice(0, 10)]
  );
  const [newDate, setNewDate] = useState("");

  const normalizedDateJson = useMemo(() => JSON.stringify(dates.filter(Boolean)), [dates]);

  function addDate() {
    if (!newDate || dates.includes(newDate)) {
      return;
    }
    setDates((current) => [...current, newDate].sort((a, b) => (a < b ? -1 : 1)));
    setNewDate("");
  }

  function removeDate(date: string) {
    if (dates.length === 1) {
      return;
    }
    setDates((current) => current.filter((item) => item !== date));
  }

  return (
    <form action={action} className="surface-card rounded-2xl p-6 md:p-8">
      {initialData?.id ? <input type="hidden" name="event_id" value={initialData.id} /> : null}
      <input type="hidden" name="dates_json" value={normalizedDateJson} />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Nome do Evento</label>
          <input
            name="name"
            defaultValue={initialData?.name ?? ""}
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            placeholder="Convenção Nacional de Refrigeração 2026"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Localização</label>
          <input
            name="location"
            defaultValue={initialData?.location ?? ""}
            required
            className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            placeholder="São Paulo, SP"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Status do Evento</label>
          <select
            name="status"
            defaultValue={initialData?.status ?? "rascunho"}
            className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          >
            <option value="rascunho">Rascunho</option>
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Detalhes do Evento</label>
          <textarea
            name="details"
            rows={5}
            defaultValue={initialData?.details ?? ""}
            className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            placeholder="Informações operacionais, público-alvo e observações."
          />
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4">
        <h2 className="font-headline text-lg font-bold tracking-tight text-[var(--foreground)]">Datas Selecionadas</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {dates.map((date) => (
            <span
              key={date}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)]/45 px-3 py-1.5 text-xs font-semibold text-[var(--primary)]"
            >
              {date}
              <button
                type="button"
                onClick={() => removeDate(date)}
                className="rounded-full px-1 text-[11px] transition hover:bg-[var(--primary)]/10"
                aria-label={`Remover data ${date}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="date"
            value={newDate}
            onChange={(event) => setNewDate(event.target.value)}
            className="rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
          <button
            type="button"
            onClick={addDate}
            className="rounded-xl border border-[var(--outline-variant)]/80 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-container)]"
          >
            Adicionar Data
          </button>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button type="submit" className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
          {mode === "create" ? "Salvar Evento" : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}

