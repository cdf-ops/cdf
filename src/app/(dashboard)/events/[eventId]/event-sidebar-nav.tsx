"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EventNavigationSection } from "@/app/(dashboard)/events/[eventId]/event-navigation";

type EventSidebarNavProps = {
  sections: EventNavigationSection[];
};

export function EventSidebarNav({ sections }: EventSidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5" aria-label="Módulos do evento">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`event-nav-${section.id}`}>
          <h2
            id={`event-nav-${section.id}`}
            className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]"
          >
            {section.label}
          </h2>
          <div className="mt-2 space-y-1">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg border-l-2 px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "border-[var(--primary)] bg-[var(--surface-container-lowest)] text-[var(--primary)]"
                      : "border-transparent text-[var(--foreground)] hover:bg-[var(--surface-container-lowest)] hover:text-[var(--primary)]"
                  }`}
                >
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
