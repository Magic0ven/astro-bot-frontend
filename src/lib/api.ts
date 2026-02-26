const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  users:         ()                             => get("/api/users"),
  signals:       (uid: string, limit = 100)     => get(`/api/users/${uid}/signals?limit=${limit}`),
  positions:     (uid: string)                  => get(`/api/users/${uid}/positions`),
  equity:        (uid: string)                  => get(`/api/users/${uid}/equity`),
  trades:        (uid: string, limit = 200)     => get(`/api/users/${uid}/trades?limit=${limit}`),
  stats:         (uid: string)                  => get(`/api/users/${uid}/stats`),
  latestSignal:  (uid: string)                  => get(`/api/users/${uid}/latest-signal`),
  ohlcv:         (symbol = "BTC/USDT", tf = "4h", limit = 500) =>
                   get(`/api/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${tf}&limit=${limit}`),
  ticker:        () => get<Record<string, number>>("/api/ticker"),
  predictionsCalendar: (untilYear?: number, asset?: string) => {
    const params = new URLSearchParams();
    if (untilYear) params.set("until_year", String(untilYear));
    if (asset) params.set("asset", asset);
    const q = params.toString();
    return get<import("@/lib/types").PredictionsCalendarResponse>(
      `/api/predictions/calendar${q ? `?${q}` : ""}`
    );
  },
  openPaperTrade: (body: {
    user_id: string; side: string; entry: number;
    sl: number; tp: number; notional: number; signal?: string;
  }) => post("/api/paper/trade", body),
  closePaperTrade: (uid: string, index: number) => del(`/api/paper/trade/${uid}/${index}`),
};

// SWR fetcher
export const fetcher = (url: string) =>
  fetch(`${BASE}${url}`).then(r => r.json());
