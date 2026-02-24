#!/bin/bash
# Start both backend API and frontend dev server

echo "Starting Astro-Bot Dashboard..."
echo ""

# Start FastAPI backend in background
echo "[1/2] Starting FastAPI backend on :8000"
cd "$(dirname "$0")/backend"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 2

# Start Next.js frontend
echo "[2/2] Starting Next.js frontend on :3000"
cd "$(dirname "$0")"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  Astro-Bot Dashboard running                 │"
echo "│  Frontend → http://localhost:3000            │"
echo "│  Backend  → http://localhost:8000            │"
echo "│  API docs → http://localhost:8000/docs       │"
echo "└─────────────────────────────────────────────┘"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C and kill both
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
