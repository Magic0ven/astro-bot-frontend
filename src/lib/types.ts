export interface User {
  id:      string;
  name:    string;
  bot_dir: string;
  color:   string;
}

/** Single day in the predictions calendar (numerology till Dec 31) */
export interface PredictionsCalendarDay {
  date:      string;
  udn:       number;
  resonance: boolean;
  multiplier: number;
  label:     string;
}

export interface PredictionsCalendarResponse {
  unavailable?:   boolean;
  reason?:        string;
  hint?:          string;
  tried_paths?:   string[];
  asset:          string | null;
  life_path_number: number | null;
  from:           string | null;
  to:             string | null;
  days:           PredictionsCalendarDay[];
}

/** Full signal payload from bot (console-style display) */
export interface FullSignalPayload {
  action?: string;
  asset?: string;
  symbol?: string;
  current_price?: number;
  stop_loss?: number;
  target?: number;
  position_size_usdt?: number;
  effective_capital?: number;
  capital_pct?: number;
  western_score?: number;
  vedic_score?: number;
  western_medium?: number;
  vedic_medium?: number;
  western_slope?: number;
  vedic_slope?: number;
  western_signal?: string;
  vedic_signal?: string;
  filter_reason?: string;
  ema_value?: number;
  ema_filter?: string;
  numerology_label?: string;
  numerology_mult?: number;
  universal_day_number?: number;
  life_path_number?: number;
  nakshatra?: string;
  nakshatra_multiplier?: number;
  moon_fast?: boolean;
  retrograde_western?: string[];
  retrograde_vedic?: string[];
  timestamp?: string;
}

export interface Signal {
  id:                  number;
  timestamp:           string;
  symbol:              string;
  action:              string;
  western_score:       number | null;
  vedic_score:         number | null;
  western_signal:      string | null;
  vedic_signal:        string | null;
  nakshatra:           string | null;
  entry_price:         number | null;
  stop_loss:           number | null;
  target:              number | null;
  position_size_usdt:  number | null;
  paper:               number;   // 1 = paper, 0 = live
  close_price:         number | null;
  pnl:                 number | null;
  result:              string | null;
  notes:               string | null;
  /** JSON string of FullSignalPayload — parse to show full console-style detail */
  full_signal?:        string | null;
}

export interface Position {
  side:     string;
  signal:   string;
  entry:    number;
  sl:       number;
  tp:       number;
  notional: number;
  risk:     number;
  age:      number;
  open_ts:  string;
  paper?:   boolean;
}

export interface EquityState {
  peak_equity?: number;
  paper_pnl?:   number;
  paper_wins?:  number;
  paper_losses?: number;
  paper_trades?: number;
}

export interface Stats {
  trades:         number;
  wins:           number;
  losses:         number;
  win_rate:       number;
  total_pnl:      number;
  avg_win:        number;
  avg_loss:       number;
  peak_equity:    number;
  paper_pnl:      number;
  open_positions: number;
}

export interface OHLCVCandle {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export type ActionType =
  | "STRONG_BUY"
  | "STRONG_SELL"
  | "WEAK_BUY"
  | "WEAK_SELL"
  | "NO_TRADE"
  | "HOLD"
  | "COLLECTING_DATA";

export const ACTION_COLOR: Record<string, string> = {
  STRONG_BUY:      "text-green",
  STRONG_SELL:     "text-red",
  WEAK_BUY:        "text-cyan",
  WEAK_SELL:       "text-orange",
  NO_TRADE:        "text-muted",
  HOLD:            "text-muted",
  COLLECTING_DATA: "text-purple",
};

export const ACTION_BG: Record<string, string> = {
  STRONG_BUY:      "bg-green/10 text-green border border-green/20",
  STRONG_SELL:     "bg-red/10 text-red border border-red/20",
  WEAK_BUY:        "bg-cyan/10 text-cyan border border-cyan/20",
  WEAK_SELL:       "bg-orange/10 text-orange border border-orange/20",
  NO_TRADE:        "bg-surface2 text-muted border border-border",
  HOLD:            "bg-surface2 text-muted border border-border",
  COLLECTING_DATA: "bg-purple/10 text-purple border border-purple/20",
};
