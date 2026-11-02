"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestSuperAdminRecoveryAction, type ForgotPasswordState } from "@/app/(auth)/esqueci-senha/actions";

const INITIAL_STATE: ForgotPasswordState = { message: null };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestSuperAdminRecoveryAction, INITIAL_STATE);
  return (
    <form action={action} className="surface-card w-full max-w-md rounded-2xl p-8">
      <h1 className="font-headline text-3xl font-extrabold tracking-tight">Recuperar senha</h1>
      <p className="mt-2 text-sm text-muted">A recuperação por e-mail é exclusiva para Super Administradores.</p>
      <label className="mt-6 block text-sm font-semibold">E-mail
        <input name="email" type="email" required className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
      </label>
      {state.message ? <p className="mt-4 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="gradient-primary mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-70">
        {pending ? "Enviando..." : "Enviar link de recuperação"}
      </button>
      <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-[var(--primary)]">Voltar ao login</Link>
    </form>
  );
}
