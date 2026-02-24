"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface Props {
  title:          string;
  userId:         string;
  onUserChange:   (id: string) => void;
}

export default function Header({ title, userId, onUserChange }: Props) {
  const [users, setUsers]   = useState<User[]>([]);
  const [now, setNow]       = useState(new Date());

  useEffect(() => {
    api.users().then((u) => setUsers(u as User[])).catch(() => {});
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
      <h1 className="text-base font-semibold text-text">{title}</h1>

      <div className="flex items-center gap-3">
        {/* UTC clock */}
        <span className="mono text-xs text-muted">
          {now.toUTCString().slice(17, 25)} UTC
        </span>

        {/* User selector */}
        {users.length > 1 && (
          <div className="flex items-center gap-2">
            <Users size={14} className="text-muted" />
            <select
              value={userId}
              onChange={(e) => onUserChange(e.target.value)}
              className="bg-surface2 border border-border text-text text-xs rounded-md px-2 py-1 outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
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
