"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const FALLBACK_USER: User = {
  id: "default",
  name: "Default",
  bot_dir: "default",
  color: "#58a6ff",
};

interface Props {
  title:        string;
  userId:       string;
  onUserChange: (id: string) => void;
}

export default function Header({ title, userId, onUserChange }: Props) {
  const [users, setUsers] = useState<User[]>([FALLBACK_USER]);
  const [now,   setNow]   = useState(new Date());

  const fetchUsers = useCallback(() => {
    api.users()
      .then((u) => {
        const list = Array.isArray(u) ? (u as User[]) : [];
        setUsers(list.length > 0 ? list : [FALLBACK_USER]);
      })
      .catch(() => setUsers([FALLBACK_USER]));
  }, []);

  useEffect(() => {
    fetchUsers();
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, [fetchUsers]);

  // When loaded list doesn't include current userId, switch to first available
  useEffect(() => {
    if (users.length > 0 && !users.some((u) => u.id === userId)) {
      onUserChange(users[0].id);
    }
  }, [users, userId, onUserChange]);

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

        {/* Bot selector — always show dropdown so user can switch when multiple bots exist */}
        <div className="relative flex items-center">
          <span className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0"
                style={{ background: color }} />

          <select
            value={users.some((u) => u.id === userId) ? userId : users[0]?.id ?? "default"}
            onChange={(e) => onUserChange(e.target.value)}
            className="appearance-none bg-surface2 border border-border text-text
                       text-xs rounded-md pl-2 pr-6 py-1 outline-none cursor-pointer
                       hover:border-blue/50 transition-colors min-w-[120px]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <ChevronDown size={11} className="absolute right-2 text-muted pointer-events-none" />
        </div>

        {/* Refresh users */}
        <button
          type="button"
          onClick={fetchUsers}
          className="p-1 rounded hover:bg-surface2 text-muted hover:text-text transition-colors"
          title="Refresh bot list"
        >
          <RefreshCw size={14} />
        </button>

        <div className="flex items-center gap-1 text-muted">
          <span className="text-[10px]">30s</span>
        </div>
      </div>
    </header>
  );
}
