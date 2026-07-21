"use client";

import { useState } from "react";

type CopyEmbedCodeButtonProps = {
  embedUrl: string;
};

export function CopyEmbedCodeButton({ embedUrl }: CopyEmbedCodeButtonProps) {
  const [copied, setCopied] = useState(false);
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="1100" style="border: 0;" title="Inscrição no evento"></iframe>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-container)]"
    >
      {copied ? "Código copiado" : "Copiar código embed"}
    </button>
  );
}
