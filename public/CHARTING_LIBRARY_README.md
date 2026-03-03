# Full chart (TradingView) — add charting_library

For the **full chart with all widgets**, copy the TradingView Charting Library from your perpx-app (or any project that has it):

```bash
# Replace PERPX_APP_DIR with the real path to your perpx-app folder, e.g.:
#   ~/projects/perpx-app
#   ../perpx-app
#   /Users/akagami/perpx-app

cp -R PERPX_APP_DIR/public/charting_library ./public/
```

Example if perpx-app is next to astro-bot-frontend:

```bash
cp -R ../perpx-app/public/charting_library ./public/
```

You need:
- `public/charting_library/charting_library.standalone.js`
- The rest of the files in `public/charting_library/`

Without it, the page uses the basic chart (no 404 — it falls back automatically).
