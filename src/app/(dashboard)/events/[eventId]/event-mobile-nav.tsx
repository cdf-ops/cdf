"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type EventMobileNavProps = {
  items: {
    href: string;
    label: string;
  }[];
};

export function EventMobileNav({ items }: EventMobileNavProps) {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Módulos do evento">
      {items.map((item) => {
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
  );
}
