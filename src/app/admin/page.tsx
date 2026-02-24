"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { User } from "@/lib/types";
import clsx from "clsx";
import {
  UserPlus, Trash2, Activity, AlertCircle,
  CheckCircle, Loader2, Terminal, ShieldCheck,
} from "lucide-react";

interface ServiceStatus {
  service: string;
  status:  string;
  running: boolean;
}

function UserCard({
  user, onRemove,
}: {
  user: User;
  onRemove: (id: string) => void;
}) {
  const { data: svc } = useSWR<ServiceStatus>(
    `/api/users/${user.id}/service-status`, fetcher,
    { refreshInterval: 15000 }
  );

  return (
    <div className="flex items-center justify-between bg-surface2 rounded-xl border border-border px-5 py-4">
      <div className="flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: user.color }}
        />
        <div>
          <p className="text-sm font-semibold text-text">{user.name}</p>
          <p className="text-xs text-muted mono">{user.id}</p>
          <p className="text-[11px] text-muted mt-0.5 truncate max-w-xs">{user.bot_dir}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {svc && (
          <div className={clsx(
            "flex items-center gap-1.5 text-xs mono px-2.5 py-1 rounded-full border",
            svc.running
              ? "bg-green/10 border-green/20 text-green"
              : "bg-red/10 border-red/20 text-red"
          )}>
            <Activity size={11} />
            {svc.status}
          </div>
        )}

        <button
          onClick={() => onRemove(user.id)}
          className="text-muted hover:text-red transition-colors p-1.5 rounded-lg hover:bg-red/10"
          title="Remove user"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

interface FormState {
  username:     string;
  display_name: string;
  wallet:       string;
  private_key:  string;
}

const EMPTY: FormState = { username: "", display_name: "", wallet: "", private_key: "" };

type Status = "idle" | "loading" | "success" | "error";

export default function AdminPage() {
  const { data: users = [], mutate } = useSWR<User[]>("/api/users", fetcher, { refreshInterval: 10000 });
  const [form,   setForm]   = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<Status>("idle");
  const [log,    setLog]    = useState("");
  const [errMsg, setErrMsg] = useState("");

  // Auto-fill username from display name
  useEffect(() => {
    if (form.display_name && !form.username) {
      setForm(f => ({
        ...f,
        username: form.display_name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20),
      }));
    }
  }, [form.display_name]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setLog(""); setErrMsg("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/users/register`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Unknown error");
      setLog(data.log ?? "");
      setStatus("success");
      setForm(EMPTY);
      mutate();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm(`Remove user '${userId}'? This will stop their bot service.`)) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/users/${userId}`,
        { method: "DELETE" }
      );
      mutate();
    } catch { /* silent */ }
  }

  return (
    <div className="flex-1 p-6 space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck size={20} className="text-blue" />
        <h1 className="text-lg font-semibold text-text">Admin — User Management</h1>
      </div>

      {/* Existing users */}
      <section className="space-y-3">
        <p className="text-xs text-muted font-medium uppercase tracking-wider">
          Active Bot Instances ({users.length})
        </p>
        {users.length === 0 && (
          <p className="text-sm text-muted py-4 text-center">No users yet.</p>
        )}
        {users.map(u => (
          <UserCard key={u.id} user={u} onRemove={handleRemove} />
        ))}
      </section>

      {/* Register form */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-5 max-w-xl">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-blue" />
          <h2 className="text-sm font-semibold text-text">Register New User</h2>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {[
            { key: "display_name" as const, label: "Display Name",        placeholder: "e.g. Alice Smith",          type: "text"     },
            { key: "username"     as const, label: "Username (Linux ID)",  placeholder: "e.g. alice (auto-filled)",  type: "text"     },
            { key: "wallet"       as const, label: "Hyperliquid Wallet",   placeholder: "0x...",                     type: "text"     },
            { key: "private_key"  as const, label: "Agent Wallet Priv Key",placeholder: "0x...",                    type: "password" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="text-xs text-muted block mb-1.5">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm mono text-text placeholder-muted outline-none focus:border-blue/50 transition-colors"
              />
            </div>
          ))}

          {/* Warning */}
          <div className="bg-orange/5 border border-orange/20 rounded-lg px-4 py-3 text-xs text-orange space-y-1">
            <p className="font-semibold">Before registering:</p>
            <p>• The server must have <span className="mono">sudo</span> access for the API process</p>
            <p>• Use a dedicated <strong>agent wallet</strong> — never your main Hyperliquid wallet</p>
            <p>• Bot starts in <strong>PAPER_TRADING=true</strong> mode by default</p>
          </div>

          {status === "error" && (
            <div className="flex items-start gap-2 text-xs text-red bg-red/5 border border-red/20 rounded-lg px-4 py-3">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <pre className="whitespace-pre-wrap font-mono">{errMsg}</pre>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center gap-2 text-xs text-green bg-green/5 border border-green/20 rounded-lg px-4 py-3">
              <CheckCircle size={13} />
              Bot provisioned successfully!
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className={clsx(
              "w-full py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2",
              "bg-blue/10 border-blue/30 text-blue hover:bg-blue/20",
              status === "loading" && "opacity-60 cursor-not-allowed"
            )}
          >
            {status === "loading"
              ? <><Loader2 size={14} className="animate-spin" /> Provisioning (this takes ~60s)…</>
              : <><UserPlus size={14} /> Register & Start Bot</>}
          </button>
        </form>

        {/* Script output log */}
        {log && (
          <div className="rounded-lg border border-border bg-surface2 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Terminal size={12} />
              Provision log
            </div>
            <pre className="text-[11px] mono text-muted whitespace-pre-wrap max-h-48 overflow-y-auto">
              {log}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
