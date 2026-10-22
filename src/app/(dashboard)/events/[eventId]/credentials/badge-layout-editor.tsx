"use client";

import { useMemo, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  BADGE_PAGE_HEIGHT,
  BADGE_PAGE_WIDTH,
  BADGE_PANEL_HEIGHT,
  BADGE_PANEL_WIDTH,
  constrainBadgeElement,
  type BadgeElementId,
  type BadgeLayout,
  type BadgeLayoutElement,
} from "@/lib/badges/layout";

type BadgeLayoutEditorProps = {
  eventId: string;
  initialLayout: BadgeLayout;
  backgroundUrl: string | null;
  participantLabel: string;
  sponsorLabel: string;
  action: (formData: FormData) => void | Promise<void>;
};

const preview: Record<BadgeElementId, string> = {
  category: "PARTICIPANTE",
  personName: "Daniel Jesus",
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

export function BadgeLayoutEditor(props: BadgeLayoutEditorProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState(props.initialLayout);
  const [selectedId, setSelectedId] = useState<BadgeElementId>("personName");
  const selected = layout.elements.find((item) => item.id === selectedId) ?? layout.elements[0];
  const layoutJson = useMemo(() => JSON.stringify(layout), [layout]);

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
    setSelectedId(element.id);
    const rect = canvas.getBoundingClientRect();
    const scaleX = BADGE_PAGE_WIDTH / rect.width;
    const scaleY = BADGE_PAGE_HEIGHT / rect.height;
    const offsetX = (event.clientX - rect.left) * scaleX - element.x;
    const offsetY = (event.clientY - rect.top) * scaleY - element.y;
    event.currentTarget.setPointerCapture(event.pointerId);

    function move(pointerEvent: PointerEvent) {
      updateElement(element.id, {
        x: (pointerEvent.clientX - rect.left) * scaleX - offsetX,
        y: (pointerEvent.clientY - rect.top) * scaleY - offsetY,
      });
    }
    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="surface-card p-3">
          <div ref={canvasRef} className="relative mx-auto aspect-[210/297] w-full max-w-[760px] overflow-hidden border bg-white [container-type:inline-size]">
            {props.backgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.backgroundUrl} alt="Arte-base da credencial" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff,#eceff1)]" />
            )}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 border-l border-dashed border-red-500/60" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 border-t border-dashed border-red-500/60" />
            {layout.elements.filter((item) => item.visible).map((element) => (
              <button
                key={element.id}
                type="button"
                onPointerDown={(event) => startDrag(element, event)}
                onClick={() => setSelectedId(element.id)}
                className={`absolute z-10 flex select-none items-center justify-center overflow-hidden border bg-white/75 px-1 text-center font-bold backdrop-blur-[1px] ${selected.id === element.id ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/30" : "border-black/20"}`}
                style={{
                  left: `${(element.x / BADGE_PAGE_WIDTH) * 100}%`, top: `${(element.y / BADGE_PAGE_HEIGHT) * 100}%`,
                  width: `${(element.width / BADGE_PAGE_WIDTH) * 100}%`, height: `${(element.height / BADGE_PAGE_HEIGHT) * 100}%`,
                  color: element.color, fontSize: `clamp(7px, ${((element.fontSize ?? 14) / BADGE_PAGE_WIDTH) * 100}cqw, 72px)`,
                }}
              >
                {preview[element.id]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-muted">As linhas vermelhas representam as dobras. Os elementos ficam limitados ao quadrante de origem.</p>
        </div>

        <aside className="surface-card h-fit rounded-xl p-4">
          <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
            Componente
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value as BadgeElementId)} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm normal-case tracking-normal">
              {layout.elements.map((element) => <option key={element.id} value={element.id}>{element.label}</option>)}
            </select>
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={selected.visible} onChange={(event) => updateElement(selected.id, { visible: event.target.checked })} />
            Exibir componente
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["x", "y", "width", "height"] as const).map((field) => (
              <label key={field} className="text-xs font-bold uppercase text-[var(--outline)]">{field}
                <input type="number" step="1" value={Math.round(selected[field])} onChange={(event) => updateElement(selected.id, { [field]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--foreground)]" />
              </label>
            ))}
          </div>
          {selected.kind === "text" ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold uppercase text-[var(--outline)]">Tamanho
                <input type="number" min={8} max={72} value={selected.fontSize ?? 18} onChange={(event) => updateElement(selected.id, { fontSize: Number(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-bold uppercase text-[var(--outline)]">Cor
                <input type="color" value={selected.color ?? "#09050a"} onChange={(event) => updateElement(selected.id, { color: event.target.value })} className="mt-1 h-10 w-full rounded-lg border bg-white p-1" />
              </label>
            </div>
          ) : null}
          <div className="mt-4 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-xs text-muted">
            Quadrante fixo: {selected.quadrant}. Limite: {Math.round(BADGE_PANEL_WIDTH)} × {Math.round(BADGE_PANEL_HEIGHT)}.
          </div>
          <SubmitButton pendingLabel="Salvando..." className="gradient-primary mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold text-white">Salvar modelo compartilhado</SubmitButton>
        </aside>
      </div>
    </form>
  );
}
