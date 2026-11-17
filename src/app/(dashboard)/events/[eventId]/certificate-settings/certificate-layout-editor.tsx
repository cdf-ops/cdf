"use client";

import { useMemo, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  CERTIFICATE_FONT_FAMILIES,
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  DEFAULT_CERTIFICATE_LAYOUT,
  constrainCertificateElement,
  type CertificateElementId,
  type CertificateFontFamily,
  type CertificateLayout,
  type CertificateLayoutElement,
} from "@/lib/certificates/layout";

type Props = {
  eventId: string;
  eventName: string;
  eventDate: string;
  initialLayout: CertificateLayout;
  action: (formData: FormData) => void | Promise<void>;
  eventLogoUrl: string | null;
  backgroundUrl: string | null;
  sponsorImageUrl: string | null;
};

type SnapGuides = { vertical: boolean; horizontal: boolean } | null;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const SNAP_TOLERANCE_PX = 10;
const FONT_CSS: Record<CertificateFontFamily, string> = {
  Inter: '"Badge Inter", sans-serif',
  Manrope: '"Badge Manrope", sans-serif',
  Montserrat: '"Badge Montserrat", sans-serif',
  Poppins: '"Badge Poppins", sans-serif',
  Roboto: '"Badge Roboto", sans-serif',
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

export function CertificateLayoutEditor(props: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState(props.initialLayout);
  const [selectedId, setSelectedId] = useState<CertificateElementId>("participantName");
  const [snapGuides, setSnapGuides] = useState<SnapGuides>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const selected = layout.elements.find((element) => element.id === selectedId) ?? layout.elements[0];
  const hiddenElements = layout.elements.filter((element) => !element.visible);
  const layoutJson = useMemo(() => JSON.stringify(layout), [layout]);

  function updateElement(id: CertificateElementId, patch: Partial<CertificateLayoutElement>) {
    setLayout((current) => ({
      elements: current.elements.map((element) =>
        element.id === id ? constrainCertificateElement({ ...element, ...patch }) : element
      ),
    }));
  }

  function validateImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const field = event.target.name;
    if (!file) {
      setFileErrors((current) => ({ ...current, [field]: "" }));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      event.target.value = "";
      setFileErrors((current) => ({ ...current, [field]: "O arquivo excede o limite de 10 MB." }));
      return;
    }
    setFileErrors((current) => ({ ...current, [field]: "" }));
  }

  function startDrag(element: CertificateLayoutElement, event: React.PointerEvent<HTMLButtonElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    setSelectedId(element.id);
    const rect = canvas.getBoundingClientRect();
    const scaleX = CERTIFICATE_WIDTH / rect.width;
    const scaleY = CERTIFICATE_HEIGHT / rect.height;
    const offsetX = (event.clientX - rect.left) * scaleX - element.x;
    const offsetY = (event.clientY - rect.top) * scaleY - element.y;
    event.currentTarget.setPointerCapture(event.pointerId);

    function move(pointerEvent: PointerEvent) {
      let x = (pointerEvent.clientX - rect.left) * scaleX - offsetX;
      let y = (pointerEvent.clientY - rect.top) * scaleY - offsetY;
      const vertical = Math.abs(x + element.width / 2 - CERTIFICATE_WIDTH / 2) <= SNAP_TOLERANCE_PX * scaleX;
      const horizontal = Math.abs(y + element.height / 2 - CERTIFICATE_HEIGHT / 2) <= SNAP_TOLERANCE_PX * scaleY;
      if (vertical) x = (CERTIFICATE_WIDTH - element.width) / 2;
      if (horizontal) y = (CERTIFICATE_HEIGHT - element.height) / 2;
      setSnapGuides(vertical || horizontal ? { vertical, horizontal } : null);
      updateElement(element.id, { x, y });
    }
    function stop() {
      setSnapGuides(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function startResize(element: CertificateLayoutElement, event: React.PointerEvent<HTMLSpanElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    const rect = canvas.getBoundingClientRect();
    const scaleX = CERTIFICATE_WIDTH / rect.width;
    const scaleY = CERTIFICATE_HEIGHT / rect.height;
    const startX = event.clientX;
    const startY = event.clientY;
    const fontSize = element.fontSize ?? 40;
    const minimumScale = Math.max(40 / element.width, 30 / element.height, element.kind === "text" ? 12 / fontSize : 0);
    const maximumScale = Math.min(
      (CERTIFICATE_WIDTH - element.x) / element.width,
      (CERTIFICATE_HEIGHT - element.y) / element.height,
      element.kind === "text" ? 140 / fontSize : Number.POSITIVE_INFINITY
    );
    function move(pointerEvent: PointerEvent) {
      const widthDelta = ((pointerEvent.clientX - startX) * scaleX) / element.width;
      const heightDelta = ((pointerEvent.clientY - startY) * scaleY) / element.height;
      const dominantDelta = Math.abs(widthDelta) >= Math.abs(heightDelta) ? widthDelta : heightDelta;
      const scale = clamp(1 + dominantDelta, minimumScale, maximumScale);
      updateElement(element.id, {
        width: element.width * scale,
        height: element.height * scale,
        fontSize: element.kind === "text" ? fontSize * scale : undefined,
      });
    }
    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function centerElement(axis: "horizontal" | "vertical") {
    updateElement(selected.id, axis === "horizontal"
      ? { x: (CERTIFICATE_WIDTH - selected.width) / 2 }
      : { y: (CERTIFICATE_HEIGHT - selected.height) / 2 });
  }

  function restoreElement() {
    const fallback = DEFAULT_CERTIFICATE_LAYOUT.elements.find((element) => element.id === selected.id);
    if (fallback) updateElement(selected.id, fallback);
  }

  function renderContent(element: CertificateLayoutElement) {
    if (element.id === "eventLogo" && props.eventLogoUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={props.eventLogoUrl} alt="" className="h-full w-full object-contain" draggable={false} />;
    }
    if (element.id === "sponsorImage" && props.sponsorImageUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={props.sponsorImageUrl} alt="" className="h-full w-full object-contain" draggable={false} />;
    }
    const text = element.id === "eventName" ? props.eventName : element.id === "eventDate"
      ? formatDate(props.eventDate) : element.text ?? previewValues[element.id];
    return <span className="block max-h-full max-w-full overflow-hidden px-2">{text}</span>;
  }

  const toolbarTop = selected.y >= 54 ? selected.y - 48 : selected.y + selected.height + 10;
  const toolbarLeft = clamp(selected.x, 8, CERTIFICATE_WIDTH - 520);

  return (
    <form action={props.action} className="space-y-6">
      <input type="hidden" name="event_id" value={props.eventId} />
      <input type="hidden" name="layout_json" value={layoutJson} />

      <div className="surface-card rounded-xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Papel de fundo do certificado</label>
            <input type="file" name="certificate_background" accept="image/png,image/jpeg" onChange={validateImage} className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white focus:border-[var(--primary)]" />
            <p className="mt-2 text-xs text-muted">PNG ou JPG, preferencialmente 1920 × 1080. Limite de 10 MB por arquivo.</p>
            {fileErrors.certificate_background ? <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{fileErrors.certificate_background}</p> : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Imagem do patrocinador</label>
            <input type="file" name="certificate_sponsor" accept="image/png,image/jpeg" onChange={validateImage} className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white focus:border-[var(--primary)]" />
            <p className="mt-2 text-xs text-muted">PNG ou JPG. Limite de 10 MB por arquivo.</p>
            {fileErrors.certificate_sponsor ? <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{fileErrors.certificate_sponsor}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="surface-card rounded-xl p-4">
          <div ref={canvasRef} className="relative aspect-video w-full overflow-hidden rounded-lg border border-[var(--outline-variant)] bg-white [container-type:inline-size]">
            {props.backgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.backgroundUrl} alt="Papel de fundo do certificado" className="pointer-events-none absolute inset-0 h-full w-full object-cover" draggable={false} />
            ) : <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#ffffff_0%,#f2f4f6_100%)]" />}
            {snapGuides?.vertical ? <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 border-l-2 border-cyan-500" /> : null}
            {snapGuides?.horizontal ? <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 border-t-2 border-cyan-500" /> : null}

            {layout.elements.filter((element) => element.visible).map((element) => (
              <button key={element.id} type="button" onPointerDown={(event) => startDrag(element, event)} onClick={() => setSelectedId(element.id)} className={`absolute z-10 flex touch-none select-none items-center justify-center overflow-visible border bg-white/70 text-center font-semibold shadow-sm backdrop-blur-sm ${selected.id === element.id ? "cursor-move border-[var(--primary)] ring-2 ring-[var(--primary)]/25" : "border-[var(--outline-variant)]"}`} style={{
                left: `${(element.x / CERTIFICATE_WIDTH) * 100}%`, top: `${(element.y / CERTIFICATE_HEIGHT) * 100}%`,
                width: `${(element.width / CERTIFICATE_WIDTH) * 100}%`, height: `${(element.height / CERTIFICATE_HEIGHT) * 100}%`,
                color: element.color, fontFamily: FONT_CSS[element.fontFamily ?? "Inter"],
                fontSize: `clamp(10px, ${((element.fontSize ?? 28) / CERTIFICATE_WIDTH) * 100}cqw, 140px)`, textAlign: element.align,
              }}>
                {renderContent(element)}
                {selected.id === element.id ? <span aria-label={`Redimensionar ${element.label}`} onPointerDown={(event) => startResize(element, event)} className="absolute -bottom-2 -right-2 z-40 h-5 w-5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-[var(--primary)] shadow-md" /> : null}
              </button>
            ))}

            {selected.visible ? <div className="absolute z-50 flex h-9 items-center gap-1 rounded-lg border bg-white/95 px-1 shadow-lg backdrop-blur" style={{ left: `${(toolbarLeft / CERTIFICATE_WIDTH) * 100}%`, top: `${(toolbarTop / CERTIFICATE_HEIGHT) * 100}%` }}>
              <button type="button" onClick={() => centerElement("horizontal")} className="h-7 rounded px-2 text-[10px] font-bold text-[var(--primary)]">Centro H</button>
              <button type="button" onClick={() => centerElement("vertical")} className="h-7 rounded px-2 text-[10px] font-bold text-[var(--primary)]">Centro V</button>
              <button type="button" onClick={() => updateElement(selected.id, { visible: false })} className="h-7 rounded px-2 text-[10px] font-bold text-red-700">Ocultar</button>
            </div> : null}
          </div>
          <p className="mt-2 text-center text-xs text-muted">Arraste para mover. Use a bolinha azul para redimensionar o elemento e o texto. As linhas azuis indicam o alinhamento magnético ao centro.</p>
        </div>

        <aside className="surface-card h-fit max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl p-4 xl:sticky xl:top-24">
          <h2 className="font-headline text-lg font-bold tracking-tight text-[var(--foreground)]">Elemento selecionado</h2>
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value as CertificateElementId)} className="mt-3 w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-3 py-2.5 text-sm outline-none">
            {layout.elements.map((element) => <option key={element.id} value={element.id}>{element.label}{element.visible ? "" : " (oculto)"}</option>)}
          </select>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => centerElement("horizontal")} className="rounded-lg border bg-white px-2 py-2 text-xs font-bold text-[var(--primary)]">Centralizar H</button>
            <button type="button" onClick={() => centerElement("vertical")} className="rounded-lg border bg-white px-2 py-2 text-xs font-bold text-[var(--primary)]">Centralizar V</button>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={selected.visible} onChange={(event) => updateElement(selected.id, { visible: event.target.checked })} />Exibir elemento</label>

          {selected.kind === "text" ? <div className="mt-4 space-y-3">
            {selected.text !== undefined ? <label className="block text-xs font-bold uppercase text-[var(--outline)]">Texto<textarea value={selected.text} rows={3} maxLength={180} onChange={(event) => updateElement(selected.id, { text: event.target.value })} className="mt-1 w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm normal-case tracking-normal text-[var(--foreground)]" /></label> : null}
            <label className="block text-xs font-bold uppercase text-[var(--outline)]">Fonte<select value={selected.fontFamily ?? "Inter"} onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value as CertificateFontFamily })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm normal-case text-[var(--foreground)]">{CERTIFICATE_FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold uppercase text-[var(--outline)]">Tamanho<input type="number" min={12} max={140} value={Math.round(selected.fontSize ?? 40)} onChange={(event) => updateElement(selected.id, { fontSize: Number(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-bold uppercase text-[var(--outline)]">Cor<input type="color" value={selected.color ?? "#191c1e"} onChange={(event) => updateElement(selected.id, { color: event.target.value })} className="mt-1 h-10 w-full rounded-lg border bg-white p-1" /></label>
            </div>
            <label className="block text-xs font-bold uppercase text-[var(--outline)]">Alinhamento<select value={selected.align ?? "center"} onChange={(event) => updateElement(selected.id, { align: event.target.value as CertificateLayoutElement["align"] })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm normal-case text-[var(--foreground)]"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
          </div> : null}

          <details className="mt-4 rounded-lg border bg-[var(--surface-container-low)] p-3"><summary className="cursor-pointer text-xs font-bold uppercase text-[var(--outline)]">Ajuste preciso</summary><div className="mt-3 grid grid-cols-2 gap-3">{(["x", "y", "width", "height"] as const).map((field) => <label key={field} className="text-xs font-bold uppercase text-[var(--outline)]">{field}<input type="number" step="1" value={Math.round(selected[field])} onChange={(event) => updateElement(selected.id, { [field]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--foreground)]" /></label>)}</div></details>
          {hiddenElements.length ? <div className="mt-4 rounded-lg border border-dashed p-3"><p className="text-xs font-bold uppercase text-[var(--outline)]">Elementos ocultos</p><div className="mt-2 flex flex-wrap gap-2">{hiddenElements.map((element) => <button key={element.id} type="button" onClick={() => { setSelectedId(element.id); updateElement(element.id, { visible: true }); }} className="rounded-full bg-[var(--surface-container)] px-3 py-1.5 text-xs font-semibold">Mostrar {element.label}</button>)}</div></div> : null}
          <button type="button" onClick={restoreElement} className="mt-4 w-full rounded-lg border bg-white px-3 py-2 text-xs font-bold text-[var(--foreground)]">Restaurar elemento</button>
          <SubmitButton pendingLabel="Salvando..." className="gradient-primary mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold text-white">Salvar configuração</SubmitButton>
        </aside>
      </div>
    </form>
  );
}
