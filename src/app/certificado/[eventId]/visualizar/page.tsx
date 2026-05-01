import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificatePublicActions } from "@/app/certificado/[eventId]/visualizar/certificate-public-actions";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { issueCertificateForParticipant } from "@/lib/certificates/issue";
import { verifyCertificateAccessToken } from "@/lib/certificates/public-token";
import { createAdminClient } from "@/lib/supabase/admin";

type PublicCertificateViewPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function PublicCertificateViewPage({ params, searchParams }: PublicCertificateViewPageProps) {
  const { eventId } = await params;
  const { token = "" } = await searchParams;
  const payload = verifyCertificateAccessToken(token);

  if (!payload || payload.eventId !== eventId) {
    notFound();
  }

  const admin = createAdminClient();
  let certificate;
  try {
    certificate = await issueCertificateForParticipant(admin, {
      eventId: payload.eventId,
      eventDayId: payload.eventDayId,
      participantId: payload.participantId,
      issuedBy: null,
    });
  } catch {
    notFound();
  }

  const pdfUrl = await createAssetSignedUrl(admin, certificate.pdfPath);
  if (!pdfUrl) {
    notFound();
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/certificado/${eventId}/visualizar?token=${encodeURIComponent(
    token
  )}`;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto w-full max-w-5xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Certificado de Participação</p>
          <h1 className="mt-1 font-headline text-2xl font-extrabold leading-tight tracking-tight text-[var(--foreground)]">
            {certificate.participantName}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {certificate.eventName} | {new Date(`${certificate.eventDate}T12:00:00`).toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="surface-card overflow-hidden rounded-2xl p-2">
            <iframe title="Certificado" src={pdfUrl} className="h-[62vh] min-h-[360px] w-full rounded-xl bg-white" />
          </div>

          <aside className="surface-card rounded-2xl p-4">
            <CertificatePublicActions downloadUrl={pdfUrl} shareUrl={publicUrl} eventName={certificate.eventName} />
            <Link
              href={`/certificado/${eventId}`}
              className="mt-4 block text-center text-sm font-semibold text-[var(--primary)]"
            >
              Consultar outro documento
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
