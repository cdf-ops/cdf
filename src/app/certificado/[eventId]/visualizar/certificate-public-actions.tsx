"use client";

import { useState } from "react";

type CertificatePublicActionsProps = {
  downloadUrl: string;
  shareUrl: string;
  eventName: string;
};

export function CertificatePublicActions({ downloadUrl, shareUrl, eventName }: CertificatePublicActionsProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const shareText = `Meu certificado de participação no ${eventName} está disponível.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Link copiado para compartilhar.");
    } catch {
      setNotice("Não foi possível copiar automaticamente. Toque e segure no link da página para copiar.");
    }
  }

  async function shareCertificate() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Certificado - ${eventName}`,
          text: shareText,
          url: shareUrl,
        });
        setNotice("Compartilhamento iniciado.");
        return;
      } catch {
        await copyShareLink();
        return;
      }
    }

    await copyShareLink();
  }

  return (
    <div className="grid gap-3">
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className="gradient-primary flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white"
      >
        Baixar Certificado em PDF
      </a>
      <button
        type="button"
        onClick={shareCertificate}
        className="flex h-12 items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-white px-5 text-sm font-semibold text-[var(--foreground)]"
      >
        Compartilhar
      </button>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="flex h-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700"
      >
        Compartilhar no WhatsApp
      </a>
      <button
        type="button"
        onClick={copyShareLink}
        className="flex h-12 items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-white px-5 text-sm font-semibold text-[var(--foreground)]"
      >
        Copiar link
      </button>
      <button
        type="button"
        disabled
        className="flex h-12 items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-5 text-sm font-semibold text-[var(--outline)]"
      >
        Receber por e-mail em breve
      </button>
      {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
    </div>
  );
}
