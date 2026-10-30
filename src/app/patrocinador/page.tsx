import { redirect } from "next/navigation";
import { SponsorLoginForm } from "@/app/patrocinador/login-form";
import { getSponsorSession } from "@/lib/sponsors/session";

export default async function SponsorLoginPage() {
  if (await getSponsorSession()) redirect("/patrocinador/portal");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="surface-card w-full max-w-md rounded-3xl p-6 shadow-xl sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">Clube do Frio</p>
        <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-tight">Acesso do patrocinador</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Use o usuário e a senha compartilhados pela sua empresa.</p>
        <SponsorLoginForm />
      </section>
    </main>
  );
}

