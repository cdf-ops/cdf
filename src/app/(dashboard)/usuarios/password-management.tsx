"use client";

import { useActionState, useState } from "react";
import {
  managedPasswordResetAction,
  revealPasswordAction,
  type ManagedPasswordState,
  type RevealPasswordState,
} from "@/app/(dashboard)/usuarios/actions";

const RESET_INITIAL: ManagedPasswordState = { error: null, success: null };
const REVEAL_INITIAL: RevealPasswordState = { error: null, password: null };

export function PasswordManagement({ userId, email, canReveal }: { userId: string; email: string; canReveal: boolean }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [reset, resetAction, resetting] = useActionState(managedPasswordResetAction, RESET_INITIAL);
  const [reveal, revealAction, revealing] = useActionState(revealPasswordAction, REVEAL_INITIAL);

  return (
    <div className="flex min-w-64 flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {canReveal && reveal.password ? (
          <button type="button" onClick={() => setRevealed((value) => !value)} className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-900">
            {revealed ? "Ocultar senha" : "Mostrar senha"}
          </button>
        ) : canReveal ? (
          <form action={revealAction}>
            <input type="hidden" name="user_id" value={userId} />
            <button type="submit" disabled={revealing} className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-900">
              {revealing ? "Consultando..." : "Ver senha"}
            </button>
          </form>
        ) : null}
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
          {open ? "Cancelar" : "Redefinir senha"}
        </button>
      </div>

      {reveal.password && revealed ? <code className="select-all rounded-lg bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-950">{reveal.password}</code> : null}
      {reveal.error ? <p className="max-w-72 text-right text-xs text-red-700">{reveal.error}</p> : null}

      {open ? (
        <form action={resetAction} className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
          <input type="hidden" name="user_id" value={userId} />
          <p className="text-xs font-bold text-amber-950">Nova senha para {email}</p>
          <input name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="Nova senha" className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-xs" />
          <textarea name="reason" required minLength={5} placeholder="Motivo da alteração" className="mt-2 min-h-14 w-full rounded-lg border bg-white px-3 py-2 text-xs" />
          {reset.error ? <p className="mt-2 text-xs font-semibold text-red-700">{reset.error}</p> : null}
          {reset.success ? <p className="mt-2 text-xs font-semibold text-emerald-700">{reset.success}</p> : null}
          <button type="submit" disabled={resetting} className="mt-2 rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-70">
            {resetting ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
