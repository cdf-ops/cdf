"use client";

import { useState } from "react";
import { archiveEventAction } from "@/app/(dashboard)/events/actions";

type ArchiveEventFormProps = {
  eventId: string;
  eventName: string;
};

export function ArchiveEventForm({ eventId, eventName }: ArchiveEventFormProps) {
  const [confirmationName, setConfirmationName] = useState("");

  return (
    <form action={archiveEventAction} className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-6">
      <input type="hidden" name="event_id" value={eventId} />
      <h2 className="font-headline text-lg font-bold text-amber-900">Arquivar evento</h2>
      <p className="mt-2 text-sm leading-6 text-amber-800">
        O evento deixará de aparecer na operação diária, mas seus dados, inscrições e histórico serão preservados.
        Para confirmar, digite o nome exato: <span className="font-bold">{eventName}</span>.
      </p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          name="confirmation_name"
          value={confirmationName}
          onChange={(event) => setConfirmationName(event.target.value)}
          className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
          placeholder="Digite o nome exato do evento"
          required
        />
        <button
          type="submit"
          disabled={confirmationName !== eventName}
          className="rounded-xl bg-amber-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Arquivar evento
        </button>
      </div>
    </form>
  );
}
