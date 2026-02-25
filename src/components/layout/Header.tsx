"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface Props {
  title:        string;
  userId:       string;
  onUserChange: (id: string) => void;
}

export default function Header({ title, userId, onUserChange }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [now,   setNow]   = useState(new Date());

  useEffect(() => {
    api.users().then((u) => setUsers(u as User[])).catch(() => {});
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const activeUser = users.find((u) => u.id === userId);
  const color      = activeUser?.color ?? "#58a6ff";

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
      <h1 className="text-base font-semibold text-text">{title}</h1>

      <div className="flex items-center gap-3">
        {/* UTC clock */}
        <span className="mono text-xs text-muted">
          {now.toUTCString().slice(17, 25)} UTC
        </span>

        {/* Active user badge — always visible */}
        {users.length === 1 && activeUser && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
               style={{ borderColor: color + "40", background: color + "15" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs font-medium" style={{ color }}>
              {activeUser.name}
            </span>
          </div>
        )}

        {/* Multi-user dropdown */}
        {users.length > 1 && (
          <div className="relative flex items-center">
            {/* Colour dot for active user */}
            <span className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0"
                  style={{ background: color }} />

            <select
              value={userId}
              onChange={(e) => onUserChange(e.target.value)}
              className="appearance-none bg-surface2 border border-border text-text
                         text-xs rounded-md pl-2 pr-6 py-1 outline-none cursor-pointer
                         hover:border-blue/50 transition-colors"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>

            <ChevronDown size={11} className="absolute right-2 text-muted pointer-events-none" />
          </div>
        )}

        {/* Refresh hint */}
        <div className="flex items-center gap-1 text-muted">
          <RefreshCw size={11} />
          <span className="text-[10px]">auto 30s</span>
        </div>
      </div>
    </header>
  );
}
