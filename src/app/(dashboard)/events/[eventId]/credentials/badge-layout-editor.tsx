"use client";

import { useMemo, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  BADGE_FONT_FAMILIES,
  BADGE_PAGE_HEIGHT,
  BADGE_PAGE_WIDTH,
  BADGE_PANEL_HEIGHT,
  BADGE_PANEL_WIDTH,
  DEFAULT_BADGE_LAYOUT,
  REQUIRED_BADGE_ELEMENTS,
  constrainBadgeElement,
  getBadgeQuadrantBounds,
  type BadgeElementId,
  type BadgeFontFamily,
  type BadgeLayout,
  type BadgeLayoutElement,
  type BadgeQuadrant,
} from "@/lib/badges/layout";

type BadgeLayoutEditorProps = {
  eventId: string;
  initialLayout: BadgeLayout;
  backgroundUrl: string | null;
  participantLabel: string;
  sponsorLabel: string;
  action: (formData: FormData) => void | Promise<void>;
};

type SnapGuides = { quadrant: BadgeQuadrant; vertical: boolean; horizontal: boolean } | null;

const SNAP_TOLERANCE_PX = 10;
const FONT_CSS: Record<BadgeFontFamily, string> = {
  Inter: '"Badge Inter", sans-serif',
  Manrope: '"Badge Manrope", sans-serif',
  Montserrat: '"Badge Montserrat", sans-serif',
  Poppins: '"Badge Poppins", sans-serif',
  Roboto: '"Badge Roboto", sans-serif',
};

const preview: Record<BadgeElementId, string> = {
  category: "PARTICIPANTE",
  personName: "Daniel Jesus",
  sponsorCompany: "Samsung",
  sponsorJobTitle: "Gerente comercial",
  checkinQr: "QR CHECK-IN",
  personNumber: "9668",
  eventLogo: "LOGO DO EVENTO",
  eventName: "Circuito dos Instaladores",
  eventLocation: "Hotel Tannenhof - Joinville/SC",
  eventDates: "22 e 23 de outubro",
  eventTime: "17h às 23h",
  certificateQr: "QR CERTIFICADO",
  socialQr: "QR REDES",
  facebook: "Clube do Frio",
  instagram: "@ClubeDoFrio",
  youtube: "Clube do Frio",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function BadgeLayoutEditor(props: BadgeLayoutEditorProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState(props.initialLayout);
  const [selectedId, setSelectedId] = useState<BadgeElementId>("personName");
  const [snapGuides, setSnapGuides] = useState<SnapGuides>(null);
  const selected = layout.elements.find((item) => item.id === selectedId) ?? layout.elements[0];
  const layoutJson = useMemo(() => JSON.stringify(layout), [layout]);
  const hiddenElements = layout.elements.filter((element) => !element.visible);

  function updateElement(id: BadgeElementId, patch: Partial<BadgeLayoutElement>) {
    setLayout((current) => ({
      elements: current.elements.map((element) =>
        element.id === id ? constrainBadgeElement({ ...element, ...patch }) : element
      ),
    }));
  }

  function startDrag(element: BadgeLayoutElement, event: React.PointerEvent<HTMLButtonElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    setSelectedId(element.id);
    const rect = canvas.getBoundingClientRect();
    const scaleX = BADGE_PAGE_WIDTH / rect.width;
    const scaleY = BADGE_PAGE_HEIGHT / rect.height;
    const offsetX = (event.clientX - rect.left) * scaleX - element.x;
    const offsetY = (event.clientY - rect.top) * scaleY - element.y;
    const bounds = getBadgeQuadrantBounds(element.quadrant);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    event.currentTarget.setPointerCapture(event.pointerId);

    function move(pointerEvent: PointerEvent) {
      let x = (pointerEvent.clientX - rect.left) * scaleX - offsetX;
      let y = (pointerEvent.clientY - rect.top) * scaleY - offsetY;
      const vertical = Math.abs(x + element.width / 2 - centerX) <= SNAP_TOLERANCE_PX * scaleX;
      const horizontal = Math.abs(y + element.height / 2 - centerY) <= SNAP_TOLERANCE_PX * scaleY;
      if (vertical) x = centerX - element.width / 2;
      if (horizontal) y = centerY - element.height / 2;
      setSnapGuides(vertical || horizontal ? { quadrant: element.quadrant, vertical, horizontal } : null);
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

  function startResize(element: BadgeLayoutElement, event: React.PointerEvent<HTMLSpanElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    const rect = canvas.getBoundingClientRect();
    const scaleX = BADGE_PAGE_WIDTH / rect.width;
    const scaleY = BADGE_PAGE_HEIGHT / rect.height;
    const startX = event.clientX;
    const startY = event.clientY;
    const bounds = getBadgeQuadrantBounds(element.quadrant);
    const fontSize = element.fontSize ?? 18;
    const minimumScale = Math.max(20 / element.width, 20 / element.height, element.kind === "text" ? 8 / fontSize : 0);
    const maximumScale = Math.min(
      (bounds.x + bounds.width - element.x) / element.width,
      (bounds.y + bounds.height - element.y) / element.height,
      element.kind === "text" ? 72 / fontSize : Number.POSITIVE_INFINITY
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
    const bounds = getBadgeQuadrantBounds(selected.quadrant);
    updateElement(selected.id, axis === "horizontal"
      ? { x: bounds.x + (bounds.width - selected.width) / 2 }
      : { y: bounds.y + (bounds.height - selected.height) / 2 });
  }

  function restoreElement() {
    const fallback = DEFAULT_BADGE_LAYOUT.elements.find((element) => element.id === selected.id);
    if (fallback) updateElement(selected.id, fallback);
  }

  const selectedToolbarTop = selected.y >= 42 ? selected.y - 38 : selected.y + selected.height + 8;
  const selectedBounds = getBadgeQuadrantBounds(selected.quadrant);
  const toolbarLeft = clamp(selected.x, selectedBounds.x + 4, selectedBounds.x + selectedBounds.width - 178);

  return (
    <form action={props.action} className="space-y-5">
      <input type="hidden" name="event_id" value={props.eventId} />
      <input type="hidden" name="layout_json" value={layoutJson} />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-[var(--foreground)]">
          Arte-base A4 vertical
          <input name="badge_background" type="file" accept="image/png,image/jpeg" className="mt-1.5 block w-full rounded-xl border bg-white px-3 py-3 text-sm" />
          <span className="mt-1 block text-xs font-normal text-muted">PNG ou JPG, preferencialmente 2480 × 3508, até 10 MB.</span>
        </label>
        <label className="text-sm font-semibold text-[var(--foreground)]">
          Rótulo do participante
          <input name="participant_label" required maxLength={40} defaultValue={props.participantLabel} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold text-[var(--foreground)]">
          Rótulo do patrocinador
          <input name="sponsor_label" required maxLength={40} defaultValue={props.sponsorLabel} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
        </label>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="surface-card p-3">
          <div ref={canvasRef} className="relative mx-auto aspect-[210/297] w-full max-w-[760px] overflow-hidden border bg-white [container-type:inline-size]">
            {props.backgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.backgroundUrl} alt="Arte-base da credencial" className="pointer-events-none absolute inset-0 h-full w-full object-cover" draggable={false} />
            ) : <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#fff,#eceff1)]" />}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 border-l border-dashed border-red-500/60" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 border-t border-dashed border-red-500/60" />

            {snapGuides ? (() => {
              const bounds = getBadgeQuadrantBounds(snapGuides.quadrant);
              return <>
                {snapGuides.vertical ? <div className="pointer-events-none absolute z-30 border-l-2 border-cyan-500" style={{ left: `${((bounds.x + bounds.width / 2) / BADGE_PAGE_WIDTH) * 100}%`, top: `${(bounds.y / BADGE_PAGE_HEIGHT) * 100}%`, height: `${(bounds.height / BADGE_PAGE_HEIGHT) * 100}%` }} /> : null}
                {snapGuides.horizontal ? <div className="pointer-events-none absolute z-30 border-t-2 border-cyan-500" style={{ left: `${(bounds.x / BADGE_PAGE_WIDTH) * 100}%`, top: `${((bounds.y + bounds.height / 2) / BADGE_PAGE_HEIGHT) * 100}%`, width: `${(bounds.width / BADGE_PAGE_WIDTH) * 100}%` }} /> : null}
              </>;
            })() : null}

            {layout.elements.filter((item) => item.visible).map((element) => (
              <button
                key={element.id}
                type="button"
                onPointerDown={(event) => startDrag(element, event)}
                onClick={() => setSelectedId(element.id)}
                className={`absolute z-10 flex touch-none select-none items-center justify-center overflow-visible border px-1 text-center font-bold ${element.id === "personName" ? "bg-white shadow-sm" : "bg-white/75 backdrop-blur-[1px]"} ${selected.id === element.id ? "cursor-move border-[var(--primary)] ring-2 ring-[var(--primary)]/30" : "border-black/20"}`}
                style={{
                  left: `${(element.x / BADGE_PAGE_WIDTH) * 100}%`, top: `${(element.y / BADGE_PAGE_HEIGHT) * 100}%`,
                  width: `${(element.width / BADGE_PAGE_WIDTH) * 100}%`, height: `${(element.height / BADGE_PAGE_HEIGHT) * 100}%`,
                  color: element.color,
                  fontFamily: FONT_CSS[element.fontFamily ?? "Inter"],
                  fontSize: `clamp(7px, ${((element.fontSize ?? 14) / BADGE_PAGE_WIDTH) * 100}cqw, 72px)`,
                }}
              >
                <span className="block max-h-full max-w-full overflow-hidden">{preview[element.id]}</span>
                {selected.id === element.id ? (
                  <span
                    aria-label={`Redimensionar ${element.label}`}
                    onPointerDown={(event) => startResize(element, event)}
                    className="absolute -bottom-2 -right-2 z-40 h-5 w-5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-[var(--primary)] shadow-md"
                  />
                ) : null}
              </button>
            ))}

            {selected.visible ? (
              <div className="absolute z-50 flex h-8 items-center gap-1 rounded-lg border bg-white/95 px-1 shadow-lg backdrop-blur" style={{ left: `${(toolbarLeft / BADGE_PAGE_WIDTH) * 100}%`, top: `${(selectedToolbarTop / BADGE_PAGE_HEIGHT) * 100}%` }}>
                <button type="button" onClick={() => centerElement("horizontal")} className="h-6 rounded px-2 text-[10px] font-bold text-[var(--primary)]" title="Centralizar horizontalmente">Centro H</button>
                <button type="button" onClick={() => centerElement("vertical")} className="h-6 rounded px-2 text-[10px] font-bold text-[var(--primary)]" title="Centralizar verticalmente">Centro V</button>
                {!REQUIRED_BADGE_ELEMENTS.has(selected.id) ? <button type="button" onClick={() => updateElement(selected.id, { visible: false })} className="h-6 rounded px-2 text-[10px] font-bold text-red-700">Ocultar</button> : null}
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-center text-xs text-muted">Arraste para mover. Use a alça azul para redimensionar. As guias azuis indicam o encaixe magnético no centro.</p>
        </div>

        <aside className="surface-card h-fit max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl p-4 xl:sticky xl:top-24">
          <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
            Componente
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value as BadgeElementId)} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm normal-case tracking-normal">
              {layout.elements.map((element) => <option key={element.id} value={element.id}>{element.label}{element.visible ? "" : " (oculto)"}</option>)}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => centerElement("horizontal")} className="rounded-lg border bg-white px-2 py-2 text-xs font-bold text-[var(--primary)]">Centralizar H</button>
            <button type="button" onClick={() => centerElement("vertical")} className="rounded-lg border bg-white px-2 py-2 text-xs font-bold text-[var(--primary)]">Centralizar V</button>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={selected.visible} disabled={REQUIRED_BADGE_ELEMENTS.has(selected.id)} onChange={(event) => updateElement(selected.id, { visible: event.target.checked })} />
            {REQUIRED_BADGE_ELEMENTS.has(selected.id) ? "Componente obrigatório" : "Exibir componente"}
          </label>

          {selected.kind === "text" ? (
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold uppercase text-[var(--outline)]">Fonte
                <select value={selected.fontFamily ?? "Inter"} onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value as BadgeFontFamily })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm normal-case text-[var(--foreground)]">
                  {BADGE_FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold uppercase text-[var(--outline)]">Tamanho
                  <input type="number" min={8} max={72} value={Math.round(selected.fontSize ?? 18)} onChange={(event) => updateElement(selected.id, { fontSize: Number(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-bold uppercase text-[var(--outline)]">Cor
                  <input type="color" value={selected.color ?? "#09050a"} onChange={(event) => updateElement(selected.id, { color: event.target.value })} className="mt-1 h-10 w-full rounded-lg border bg-white p-1" />
                </label>
              </div>
            </div>
          ) : null}

          <details className="mt-4 rounded-lg border bg-[var(--surface-container-low)] p-3">
            <summary className="cursor-pointer text-xs font-bold uppercase text-[var(--outline)]">Ajuste preciso</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["x", "y", "width", "height"] as const).map((field) => (
                <label key={field} className="text-xs font-bold uppercase text-[var(--outline)]">{field}
                  <input type="number" step="1" value={Math.round(selected[field])} onChange={(event) => updateElement(selected.id, { [field]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--foreground)]" />
                </label>
              ))}
            </div>
          </details>

          {hiddenElements.length ? (
            <div className="mt-4 rounded-lg border border-dashed p-3">
              <p className="text-xs font-bold uppercase text-[var(--outline)]">Componentes ocultos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {hiddenElements.map((element) => <button key={element.id} type="button" onClick={() => { setSelectedId(element.id); updateElement(element.id, { visible: true }); }} className="rounded-full bg-[var(--surface-container)] px-3 py-1.5 text-xs font-semibold">Mostrar {element.label}</button>)}
              </div>
            </div>
          ) : null}

          <button type="button" onClick={restoreElement} className="mt-4 w-full rounded-lg border bg-white px-3 py-2 text-xs font-bold text-[var(--foreground)]">Restaurar componente</button>
          <div className="mt-4 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-xs text-muted">Quadrante fixo: {selected.quadrant}. Limite: {Math.round(BADGE_PANEL_WIDTH)} × {Math.round(BADGE_PANEL_HEIGHT)}.</div>
          <SubmitButton pendingLabel="Salvando..." className="gradient-primary mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold text-white">Salvar modelo compartilhado</SubmitButton>
        </aside>
      </div>
    </form>
  );
}
