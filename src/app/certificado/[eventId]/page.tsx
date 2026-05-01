import { notFound } from "next/navigation";
import { PublicCertificateLookupForm } from "@/app/certificado/[eventId]/public-certificate-lookup-form";
import { createAdminClient } from "@/lib/supabase/admin";

type PublicCertificatePageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function PublicCertificatePage({ params }: PublicCertificatePageProps) {
  const { eventId } = await params;
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, name, location").eq("id", eventId).maybeSingle();

  if (!event) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8">
      <section className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Clube do Frio</p>
          <h1 className="mt-2 font-headline text-3xl font-extrabold leading-tight tracking-tight text-[var(--foreground)]">
            Certificado de Participação
          </h1>
          <p className="mt-3 text-base font-semibold text-[var(--foreground)]">{event.name}</p>
          <p className="mt-1 text-sm text-muted">{event.location}</p>
        </div>

        <PublicCertificateLookupForm eventId={event.id} />
      </section>
    </main>
  );
}
