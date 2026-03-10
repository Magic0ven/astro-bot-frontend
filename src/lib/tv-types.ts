/**
 * Minimal types for TradingView Charting Library integration.
 */

export type TVResolution = string;

export interface TVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TVSymbolInfo {
  name: string;
  full_name: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  minmov: number;
  pricescale: number;
  has_intraday?: boolean;
  supported_resolutions?: TVResolution[];
}

export interface TVPeriodParams {
  from: number;
  to: number;
  countBack: number;
  firstDataRequest: boolean;
}

export type TVHistoryCallback = (bars: TVBar[], meta?: { noData?: boolean }) => void;
export type TVErrorCallback = (err: string) => void;
export type TVResolveCallback = (symbolInfo: TVSymbolInfo) => void;
export type TVReadyCallback = (config: Record<string, unknown>) => void;

export interface TVDatafeed {
  onReady: (callback: TVReadyCallback) => void;
  resolveSymbol: (symbolName: string, onResolve: TVResolveCallback, onError: TVErrorCallback) => void;
  getBars: (
    symbolInfo: TVSymbolInfo,
    resolution: TVResolution,
    periodParams: TVPeriodParams,
    onResult: TVHistoryCallback,
    onError: TVErrorCallback
  ) => void;
  getMarks?: (symbolName: string, from: number, to: number, onData: (marks: TVMark[]) => void, resolution: string) => void;
}

export interface TVMark {
  id: string | number;
  time: number;
  color: string;
  text: string;
  label: string;
  labelFontColor: string;
  minSize?: number;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: TVWidgetOptions) => TVWidget;
    };
  }
}

export interface TVWidgetOptions {
  container: HTMLElement;
  library_path: string;
  datafeed: TVDatafeed;
  symbol?: string;
  interval?: string;
  locale?: string;
  disabled_features?: string[];
  enabled_features?: string[];
  theme?: "light" | "dark";
  custom_css_url?: string;
  fullscreen?: boolean;
  autosize?: boolean;
  overrides?: Record<string, unknown>;
}

/** Chart API returned by widget.activeChart() for drawings */
export interface TVChartApi {
  createShape?: (
    point: { time?: number; price?: number },
    options: { shape: string; lock?: boolean; disableSelection?: boolean; text?: string; overrides?: Record<string, unknown> }
  ) => Promise<unknown>;
  removeEntity?: (id: unknown) => void;
  resolution?: () => string;
  setResolution?: (res: string) => void;
}

export interface TVWidget {
  activeChart?: () => TVChartApi;
  onChartReady?: (callback: () => void) => void;
  remove?: () => void;
}
