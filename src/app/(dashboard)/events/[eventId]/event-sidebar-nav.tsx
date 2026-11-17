"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  resetEventNavigationOrderAction,
  saveEventNavigationOrderAction,
} from "@/app/(dashboard)/events/[eventId]/event-navigation-actions";
import type {
  EventNavigationOrder,
  EventNavigationSection,
} from "@/app/(dashboard)/events/[eventId]/event-navigation";

type Props = {
  eventId: string;
  sections: EventNavigationSection[];
};

type DraggingItem = { sectionId: EventNavigationSection["id"]; itemId: string } | null;

function navigationOrder(sections: EventNavigationSection[]): EventNavigationOrder {
  return Object.fromEntries(sections.map((section) => [section.id, section.items.map((item) => item.id)]));
}

export function EventSidebarNav({ eventId, sections }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sections);
  const [dragging, setDragging] = useState<DraggingItem>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function moveItem(sectionId: EventNavigationSection["id"], itemId: string, targetId: string) {
    if (itemId === targetId) return;
    setDraft((current) => current.map((section) => {
      if (section.id !== sectionId) return section;
      const from = section.items.findIndex((item) => item.id === itemId);
      const target = section.items.findIndex((item) => item.id === targetId);
      if (from < 0 || target < 0) return section;
      const items = [...section.items];
      const [moved] = items.splice(from, 1);
      items.splice(target, 0, moved);
      return { ...section, items };
    }));
  }

  function moveByOffset(sectionId: EventNavigationSection["id"], itemId: string, offset: -1 | 1) {
    setDraft((current) => current.map((section) => {
      if (section.id !== sectionId) return section;
      const from = section.items.findIndex((item) => item.id === itemId);
      const target = from + offset;
      if (from < 0 || target < 0 || target >= section.items.length) return section;
      const items = [...section.items];
      [items[from], items[target]] = [items[target], items[from]];
      return { ...section, items };
    }));
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveEventNavigationOrderAction(eventId, navigationOrder(draft));
        setEditing(false);
        router.refresh();
      } catch {
        setError("Não foi possível salvar a ordem dos módulos. Tente novamente.");
      }
    });
  }

  function reset() {
    setError("");
    startTransition(async () => {
      try {
        await resetEventNavigationOrderAction(eventId);
        setEditing(false);
        router.refresh();
      } catch {
        setError("Não foi possível restaurar a ordem padrão. Tente novamente.");
      }
    });
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-[var(--surface-container-lowest)] p-3">
          <p className="text-xs font-semibold leading-5 text-[var(--foreground)]">Arraste os módulos para ordenar.</p>
          <p className="mt-1 text-[11px] leading-4 text-muted">As seções são fixas. Um módulo nunca pode ser movido para outra seção.</p>
        </div>

        {draft.map((section) => (
          <section key={section.id} aria-labelledby={`event-nav-edit-${section.id}`}>
            <h2 id={`event-nav-edit-${section.id}`} className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">{section.label}</h2>
            <div className="mt-2 space-y-1.5">
              {section.items.map((item, index) => (
                <div
                  key={item.id}
                  draggable={!pending}
                  aria-grabbed={dragging?.itemId === item.id}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                    setDragging({ sectionId: section.id, itemId: item.id });
                  }}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(event) => {
                    if (dragging?.sectionId === section.id) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragging?.sectionId === section.id) moveItem(section.id, dragging.itemId, item.id);
                    setDragging(null);
                  }}
                  className={`flex items-center gap-2 rounded-lg border bg-white px-2 py-2 shadow-sm transition ${dragging?.itemId === item.id ? "border-[var(--primary)] opacity-60" : "border-[var(--outline-variant)]/55"}`}
                >
                  <span className="cursor-grab select-none text-base leading-none text-[var(--outline)] active:cursor-grabbing" aria-hidden="true">⋮⋮</span>
                  <span className="min-w-0 flex-1 text-xs font-semibold text-[var(--foreground)]">{item.label}</span>
                  <button type="button" disabled={pending || index === 0} onClick={() => moveByOffset(section.id, item.id, -1)} className="h-7 w-7 rounded-md border text-xs font-bold disabled:opacity-25" aria-label={`Mover ${item.label} para cima`}>↑</button>
                  <button type="button" disabled={pending || index === section.items.length - 1} onClick={() => moveByOffset(section.id, item.id, 1)} className="h-7 w-7 rounded-md border text-xs font-bold disabled:opacity-25" aria-label={`Mover ${item.label} para baixo`}>↓</button>
                </div>
              ))}
            </div>
          </section>
        ))}

        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} onClick={save} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{pending ? "Salvando..." : "Salvar ordem"}</button>
          <button type="button" disabled={pending} onClick={() => { setDraft(sections); setEditing(false); setError(""); }} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-60">Cancelar</button>
        </div>
        <button type="button" disabled={pending} onClick={reset} className="w-full rounded-lg border border-dashed bg-white px-3 py-2 text-xs font-semibold text-muted disabled:opacity-60">Restaurar ordem padrão</button>
      </div>
    );
  }

  return (
    <nav className="space-y-5" aria-label="Módulos do evento">
      <button type="button" onClick={() => { setDraft(sections); setEditing(true); }} className="w-full rounded-lg border border-dashed bg-white px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-container-lowest)]">Organizar módulos</button>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`event-nav-${section.id}`}>
          <h2 id={`event-nav-${section.id}`} className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">{section.label}</h2>
          <div className="mt-2 space-y-1">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={`block rounded-lg border-l-2 px-3 py-2.5 text-sm font-semibold transition ${active ? "border-[var(--primary)] bg-[var(--surface-container-lowest)] text-[var(--primary)]" : "border-transparent text-[var(--foreground)] hover:bg-[var(--surface-container-lowest)] hover:text-[var(--primary)]"}`}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
