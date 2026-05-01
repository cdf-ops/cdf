"use client";

import { useMemo, useRef, useState } from "react";
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  type CertificateElementId,
  type CertificateLayout,
  type CertificateLayoutElement,
} from "@/lib/certificates/layout";

type CertificateLayoutEditorProps = {
  eventId: string;
  eventName: string;
  eventDate: string;
  initialLayout: CertificateLayout;
  action: (formData: FormData) => void | Promise<void>;
  eventLogoUrl: string | null;
  backgroundUrl: string | null;
  sponsorImageUrl: string | null;
};

const previewValues: Record<CertificateElementId, string> = {
  text1: "CERTIFICADO",
  text2: "Certificamos que",
  text3: "participou de forma presencial no",
  eventName: "",
  eventDate: "",
  participantName: "Nome Completo do Participante",
  eventLogo: "Logo",
  sponsorImage: "Patrocinador",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDate(date: string) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "Data do Evento";
}

export function CertificateLayoutEditor({
  eventId,
  eventName,
  eventDate,
  initialLayout,
  action,
  eventLogoUrl,
  backgroundUrl,
  sponsorImageUrl,
}: CertificateLayoutEditorProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState(initialLayout);
  const [selectedId, setSelectedId] = useState<CertificateElementId>("participantName");

  const selected = layout.elements.find((element) => element.id === selectedId) ?? layout.elements[0];
  const layoutJson = useMemo(() => JSON.stringify(layout), [layout]);

  function updateElement(id: CertificateElementId, patch: Partial<CertificateLayoutElement>) {
    setLayout((current) => ({
      elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    }));
  }

  function startDrag(element: CertificateLayoutElement, event: React.PointerEvent<HTMLButtonElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    setSelectedId(element.id);
    const rect = canvas.getBoundingClientRect();
    const scaleX = CERTIFICATE_WIDTH / rect.width;
    const scaleY = CERTIFICATE_HEIGHT / rect.height;
    const offsetX = (event.clientX - rect.left) * scaleX - element.x;
    const offsetY = (event.clientY - rect.top) * scaleY - element.y;

    event.currentTarget.setPointerCapture(event.pointerId);

    function move(pointerEvent: PointerEvent) {
      const nextX = (pointerEvent.clientX - rect.left) * scaleX - offsetX;
      const nextY = (pointerEvent.clientY - rect.top) * scaleY - offsetY;
      updateElement(element.id, {
        x: clamp(Math.round(nextX), 0, CERTIFICATE_WIDTH - element.width),
        y: clamp(Math.round(nextY), 0, CERTIFICATE_HEIGHT - element.height),
      });
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function renderContent(element: CertificateLayoutElement) {
    if (element.id === "eventLogo" && eventLogoUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={eventLogoUrl} alt="" className="h-full w-full object-contain" draggable={false} />;
    }
    if (element.id === "sponsorImage" && sponsorImageUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={sponsorImageUrl} alt="" className="h-full w-full object-contain" draggable={false} />;
    }

    const text =
      element.id === "eventName"
        ? eventName
        : element.id === "eventDate"
          ? formatDate(eventDate)
          : element.text ?? previewValues[element.id];

    return <span className="block truncate px-2">{text}</span>;
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="layout_json" value={layoutJson} />

      <div className="surface-card rounded-xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Background do Certificado</label>
            <input
              type="file"
              name="certificate_background"
              accept="image/png,image/jpeg"
              className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white focus:border-[var(--primary)]"
            />
            <p className="mt-2 text-xs text-muted">Use PNG ou JPG em 1920 x 1080 para melhor resultado.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Imagem do Patrocinador</label>
            <input
              type="file"
              name="certificate_sponsor"
              accept="image/png,image/jpeg"
              className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white focus:border-[var(--primary)]"
            />
            <p className="mt-2 text-xs text-muted">PNG ou JPG, até 10 MB. Substitui a imagem atual.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="surface-card rounded-xl p-4">
          <div
            ref={canvasRef}
            className="relative aspect-video w-full [container-type:inline-size] overflow-hidden rounded-lg border border-[var(--outline-variant)] bg-white"
          >
            {backgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#ffffff_0%,#f2f4f6_100%)]" />
            )}

            {layout.elements.map((element) => (
              <button
                key={element.id}
                type="button"
                onPointerDown={(event) => startDrag(element, event)}
                onClick={() => setSelectedId(element.id)}
                className={`absolute flex select-none items-center justify-center overflow-hidden border bg-white/70 text-center font-semibold shadow-sm backdrop-blur-sm ${
                  selectedId === element.id ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/25" : "border-[var(--outline-variant)]"
                }`}
                style={{
                  left: `${(element.x / CERTIFICATE_WIDTH) * 100}%`,
                  top: `${(element.y / CERTIFICATE_HEIGHT) * 100}%`,
                  width: `${(element.width / CERTIFICATE_WIDTH) * 100}%`,
                  height: `${(element.height / CERTIFICATE_HEIGHT) * 100}%`,
                  color: element.color,
                  fontSize: `clamp(10px, ${((element.fontSize ?? 28) / CERTIFICATE_WIDTH) * 100}cqw, 140px)`,
                  textAlign: element.align,
                }}
              >
                {renderContent(element)}
              </button>
            ))}
          </div>
        </div>

        <aside className="surface-card rounded-xl p-4">
          <h2 className="font-headline text-lg font-bold tracking-tight text-[var(--foreground)]">Elemento</h2>
          <select
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value as CertificateElementId)}
            className="mt-3 w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-3 py-2.5 text-sm outline-none"
          >
            {layout.elements.map((element) => (
              <option key={element.id} value={element.id}>
                {element.label}
              </option>
            ))}
          </select>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["x", "y", "width", "height"] as const).map((field) => (
              <label key={field} className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">
                {field}
                <input
                  type="number"
                  value={selected[field]}
                  min={0}
                  max={field === "x" || field === "width" ? CERTIFICATE_WIDTH : CERTIFICATE_HEIGHT}
                  onChange={(event) => updateElement(selected.id, { [field]: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[var(--outline-variant)]/60 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none"
                />
              </label>
            ))}
          </div>

          {selected.kind === "text" ? (
            <div className="mt-4 space-y-3">
              {selected.text !== undefined ? (
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">
                  Texto
                  <textarea
                    value={selected.text}
                    rows={3}
                    maxLength={180}
                    onChange={(event) => updateElement(selected.id, { text: event.target.value })}
                    className="mt-1 w-full resize-none rounded-lg border border-[var(--outline-variant)]/60 bg-white px-3 py-2 text-sm normal-case tracking-normal text-[var(--foreground)] outline-none"
                  />
                </label>
              ) : null}
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">
                Tamanho
                <input
                  type="number"
                  value={selected.fontSize ?? 40}
                  min={12}
                  max={140}
                  onChange={(event) => updateElement(selected.id, { fontSize: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[var(--outline-variant)]/60 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">
                Cor
                <input
                  type="color"
                  value={selected.color ?? "#191c1e"}
                  onChange={(event) => updateElement(selected.id, { color: event.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--outline-variant)]/60 bg-white px-2"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">
                Alinhamento
                <select
                  value={selected.align ?? "center"}
                  onChange={(event) => updateElement(selected.id, { align: event.target.value as CertificateLayoutElement["align"] })}
                  className="mt-1 w-full rounded-lg border border-[var(--outline-variant)]/60 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none"
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </label>
            </div>
          ) : null}

          <button type="submit" className="mt-6 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
            Salvar Configuração
          </button>
        </aside>
      </div>
    </form>
  );
}
