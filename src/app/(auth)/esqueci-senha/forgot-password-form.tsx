"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/alterar-senha?recovery=1")}`,
    });
    setPending(false);
    setMessage("Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.");
  }

  return (
    <form onSubmit={requestRecovery} className="surface-card w-full max-w-md rounded-2xl p-8">
      <h1 className="font-headline text-3xl font-extrabold tracking-tight">Recuperar senha</h1>
      <p className="mt-2 text-sm text-muted">Informe o e-mail usado no Clube do Frio.</p>
      <label className="mt-6 block text-sm font-semibold">
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
        />
      </label>
      {message ? <p className="mt-4 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="gradient-primary mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Enviando..." : "Enviar link de recuperação"}
      </button>
      <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-[var(--primary)]">
        Voltar ao login
      </Link>
    </form>
  );
}
