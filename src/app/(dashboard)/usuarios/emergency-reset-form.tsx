"use client";

import { useActionState, useState } from "react";
import {
  emergencyPasswordResetAction,
  type EmergencyResetState,
} from "@/app/(dashboard)/usuarios/actions";

const INITIAL_STATE: EmergencyResetState = {
  error: null,
  success: null,
  temporaryPassword: null,
};

export function EmergencyResetForm({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(emergencyPasswordResetAction, INITIAL_STATE);

  if (!open && !state.temporaryPassword) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
      >
        Acesso emergencial
      </button>
    );
  }

  return (
    <div className="min-w-64 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
      {state.temporaryPassword ? (
        <>
          <p className="text-xs font-bold text-amber-900">Senha temporária — exibida somente agora</p>
          <code className="mt-2 block select-all rounded-lg bg-white px-3 py-2 text-sm font-bold text-[var(--foreground)]">
            {state.temporaryPassword}
          </code>
          <p className="mt-2 text-xs text-amber-800">{state.success}</p>
        </>
      ) : (
        <form action={action}>
          <input type="hidden" name="user_id" value={userId} />
          <p className="text-xs font-bold text-amber-900">Confirmar reset de {email}</p>
          <textarea
            name="reason"
            required
            minLength={5}
            placeholder="Motivo: suporte presencial no evento"
            className="mt-2 min-h-16 w-full rounded-lg border bg-white px-3 py-2 text-xs"
          />
          <label className="mt-2 flex items-start gap-2 text-xs text-amber-900">
            <input name="confirmed" value="yes" type="checkbox" required className="mt-0.5" />
            Identidade, perfil e empresa foram conferidos presencialmente.
          </label>
          {state.error ? <p className="mt-2 text-xs font-semibold text-red-700">{state.error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-70"
            >
              {pending ? "Gerando..." : "Gerar senha"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
