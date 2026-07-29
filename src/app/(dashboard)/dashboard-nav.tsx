"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AppRole } from "@/lib/auth/roles";

type DashboardNavProps = {
  role: AppRole;
};

const activeClass = "border-b-2 border-[var(--primary)] pb-0.5 font-headline text-sm font-bold tracking-tight text-[var(--primary)]";
const inactiveClass = "text-sm font-semibold text-[var(--outline)] transition hover:text-[var(--primary)]";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({ role }: DashboardNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const items = [
    { href: "/events", label: "Eventos", visible: true },
    { href: "/equipe", label: "Equipe Geral", visible: role === "expositor" },
    { href: "/usuarios", label: "Usuários", visible: ["super_adm", "organizador"].includes(role) },
    { href: "/expositores", label: "Expositores", visible: ["super_adm", "organizador"].includes(role) },
    { href: "/participantes", label: "Participantes", visible: ["super_adm", "organizador"].includes(role) },
    { href: "/integracoes", label: "Integrações", visible: role === "super_adm" },
  ];
  const visibleItems = items.filter((item) => item.visible);

  return (
    <>
      <nav className="hidden items-center gap-4 md:flex" aria-label="Navegação principal">
        {visibleItems.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? activeClass : inactiveClass}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="mobile-dashboard-navigation"
          aria-label={isOpen ? "Fechar menu principal" : "Abrir menu principal"}
          onClick={() => setIsOpen((current) => !current)}
          className="ghost-border inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[var(--surface-container-lowest)] text-[var(--primary)]"
        >
          <span className="sr-only">{isOpen ? "Fechar menu" : "Abrir menu"}</span>
          <span aria-hidden="true" className="flex flex-col gap-1.5">
            <span className={`block h-0.5 w-5 bg-current transition ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-current transition ${isOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-current transition ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </span>
        </button>

        {isOpen ? (
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 top-[69px] z-40 bg-slate-950/20 backdrop-blur-[1px]"
            />
            <nav
              id="mobile-dashboard-navigation"
              aria-label="Navegação principal"
              className="shell-card fixed inset-x-3 top-[69px] z-50 rounded-2xl p-2 shadow-xl"
            >
              {visibleItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsOpen(false)}
                    className={`flex min-h-12 items-center rounded-xl px-4 text-base font-semibold transition ${
                      active
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--surface-container-lowest)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </>
        ) : null}
      </div>
    </>
  );
}
