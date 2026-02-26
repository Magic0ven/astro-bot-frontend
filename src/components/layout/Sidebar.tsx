"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CandlestickChart, ListOrdered,
  Radio, Terminal, ChevronRight, Zap, ShieldCheck, Target,
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/",            label: "Dashboard",    icon: LayoutDashboard },
  { href: "/chart",       label: "Chart",        icon: CandlestickChart },
  { href: "/predictions", label: "Predictions",  icon: Target },
  { href: "/positions",   label: "Positions",    icon: ListOrdered },
  { href: "/signals",     label: "Signals",      icon: Radio },
  { href: "/paper",       label: "Paper Trading",icon: Terminal },
  { href: "/admin",       label: "Admin",        icon: ShieldCheck },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-56 flex flex-col bg-surface border-r border-border z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-blue/10 border border-blue/30 flex items-center justify-center">
          <Zap size={16} className="text-blue" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Astro-Bot</p>
          <p className="text-[10px] text-muted">Slope Around Medium</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                active
                  ? "bg-blue/10 text-blue border border-blue/20"
                  : "text-muted hover:text-text hover:bg-surface2"
              )}
            >
              <Icon size={16} className={active ? "text-blue" : "text-muted group-hover:text-text"} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} className="text-blue" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="dot-live" />
          <span className="text-[11px] text-muted">BTC/USDT · Hyperliquid</span>
        </div>
      </div>
    </aside>
  );
}
