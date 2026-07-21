"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const items = [
    { href: "/events", label: "Eventos", visible: true },
    { href: "/usuarios", label: "Usuários", visible: role === "super_adm" },
    { href: "/expositores", label: "Expositores", visible: ["super_adm", "organizador"].includes(role) },
    { href: "/participantes", label: "Participantes", visible: ["super_adm", "organizador"].includes(role) },
  ];

  return (
    <nav className="hidden items-center gap-4 md:flex">
      {items
        .filter((item) => item.visible)
        .map((item) => (
          <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? activeClass : inactiveClass}>
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
