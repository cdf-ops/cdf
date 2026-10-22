"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EventNavigationSection } from "@/app/(dashboard)/events/[eventId]/event-navigation";

type EventMobileNavProps = {
  sections: EventNavigationSection[];
};

export function EventMobileNav({ sections }: EventMobileNavProps) {
  const pathname = usePathname();

  return (
    <div className="mt-4 space-y-3 lg:hidden">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`event-mobile-nav-${section.id}`}>
          <h2
            id={`event-mobile-nav-${section.id}`}
            className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]"
          >
            {section.label}
          </h2>
          <nav className="-mx-1 mt-1.5 flex snap-x gap-2 overflow-x-auto px-1 pb-1" aria-label={section.label}>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 text-sm font-semibold transition ${
                    active
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "ghost-border bg-[var(--surface-container-lowest)] text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </section>
      ))}
    </div>
  );
}
