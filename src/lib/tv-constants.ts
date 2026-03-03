/** TradingView Charting Library — copy from perpx-app into public/charting_library/ */
export const CHARTING_LIBRARY_PATH = "/charting_library";
export const CHARTING_LIBRARY_STANDALONE = `${CHARTING_LIBRARY_PATH}/charting_library.standalone.js`;

export const TV_RESOLUTIONS: Record<string, string> = {
  "1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "1D",
};

/** Fixed OHLCV range: 2025-01-01 00:00:00 UTC to latest candle. */
export const OHLCV_START_TIMESTAMP = 1735689600;
