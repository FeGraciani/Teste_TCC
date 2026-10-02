"use client";

import {
  CalendarDays,
  CalendarPlus,
  Clock,
  House,
  Menu,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Tag,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { NavIcon, NavItem } from "@/config/navigation";
import { cn } from "@/shared/lib/cn";
import { useCounters } from "./counters-provider";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  calendarPlus: CalendarPlus,
  calendar: CalendarDays,
  messages: MessageCircle,
  shield: ShieldCheck,
  user: UserRound,
  clock: Clock,
  users: Users,
  stethoscope: Stethoscope,
  tag: Tag,
  scroll: ScrollText,
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const counters = useCounters();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item);
        const count = item.counter ? (counters[item.counter] ?? 0) : 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-semibold transition-colors",
                active ? "bg-quaresmeira-700 text-white" : "text-tinta hover:bg-quaresmeira-50",
              )}
            >
              <Icon className={cn("size-[1.15rem] shrink-0", active ? "text-white" : "text-quaresmeira-600")} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "grid min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold",
                    active ? "bg-white text-quaresmeira-800" : "bg-ipe-400 text-tinta",
                  )}
                >
                  {count > 99 ? "99+" : count}
                  <span className="sr-only">{item.counter === "unreadMessages" ? " não lidas" : " pendentes"}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Menu das áreas logadas no celular: abre sob a barra superior. */
export function MobileMenu({ items, footer }: { items: NavItem[]; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const counters = useCounters();
  const total = (counters.unreadMessages ?? 0) + (counters.pendingRequests ?? 0);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="menu-app"
        className="relative grid size-11 place-items-center rounded-xl text-tinta hover:bg-quaresmeira-50"
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
        {!open && total > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-ipe-400 ring-2 ring-papel" aria-hidden />}
      </button>
      {open && (
        <div
          id="menu-app"
          className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-t border-linha bg-papel px-4 pt-4 pb-10"
          key={pathname}
        >
          <nav aria-label="Menu principal">
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="mt-6 border-t border-linha pt-6">{footer}</div>
        </div>
      )}
    </div>
  );
}
