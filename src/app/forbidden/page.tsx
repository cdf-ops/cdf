import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="surface-card max-w-lg rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Acesso negado</p>
        <h1 className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Você não tem permissão para esta área
        </h1>
        <p className="mt-3 text-sm text-muted">
          Se precisar de acesso, peça para um Super-ADM revisar seu perfil no sistema.
        </p>
        <Link
          href="/events"
          className="gradient-primary mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        >
          Voltar para Eventos
        </Link>
      </div>
    </main>
  );
}

