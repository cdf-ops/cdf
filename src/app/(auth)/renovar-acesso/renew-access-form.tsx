"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RenewAccessForm({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendRenewalLink() {
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/renovar-acesso`,
      },
    });
    setPending(false);
    setMessage(
      error
        ? "Não foi possível enviar agora. Tente novamente ou procure a organização do evento."
        : "Enviamos um link para o seu e-mail corporativo. Abra o link para renovar o acesso por 30 dias."
    );
  }

  return (
    <div className="surface-card w-full max-w-lg rounded-2xl p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Segurança do expositor</p>
      <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight">Renove seu acesso</h1>
      <p className="mt-3 text-sm text-muted">
        O vínculo com a empresa precisa ser confirmado a cada 30 dias. Enviaremos a confirmação para:
      </p>
      <p className="mt-3 rounded-xl border bg-white px-4 py-3 font-semibold">{email}</p>
      {message ? <p className="mt-4 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{message}</p> : null}
      <button
        type="button"
        onClick={sendRenewalLink}
        disabled={pending}
        className="gradient-primary mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Enviando..." : "Enviar link de renovação"}
      </button>
      <p className="mt-4 text-xs text-muted">
        Sem acesso ao e-mail corporativo? Procure a organização para uma liberação presencial temporária.
      </p>
    </div>
  );
}
