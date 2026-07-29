"use client";

import { useEffect, useState } from "react";

export function LogoUploadField({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);
  const [message, setMessage] = useState("PNG ou JPG quadrado. Recomendamos 500 x 500 pixels, até 5 MB.");

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== currentLogoUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [currentLogoUrl, previewUrl]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (image.width !== image.height) {
        event.target.value = "";
        URL.revokeObjectURL(objectUrl);
        setMessage("A imagem precisa ser quadrada. Ajuste o recorte antes de enviar.");
        return;
      }
      if (previewUrl && previewUrl !== currentLogoUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(objectUrl);
      setMessage(
        image.width === 500
          ? "Formato ideal confirmado: 500 x 500 pixels."
          : `Imagem quadrada confirmada: ${image.width} x ${image.height} pixels.`
      );
    };
    image.onerror = () => {
      event.target.value = "";
      URL.revokeObjectURL(objectUrl);
      setMessage("Não foi possível ler a imagem selecionada.");
    };
    image.src = objectUrl;
  }

  return (
    <div className="grid gap-4 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
      <div className="flex aspect-square w-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--outline-variant)] bg-white p-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Prévia do logo da empresa" className="h-full w-full object-contain" />
        ) : (
          <span className="text-center text-xs font-semibold text-[var(--outline)]">Sem logo</span>
        )}
      </div>
      <div>
        <input
          type="file"
          name="company_logo"
          accept="image/png,image/jpeg"
          required
          onChange={handleChange}
          className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
        <p className="mt-2 text-xs text-muted" aria-live="polite">{message}</p>
      </div>
    </div>
  );
}
