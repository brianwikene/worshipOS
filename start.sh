#!/bin/bash
set -euo pipefail

echo "🚀 Starting WorshipOS..."

# Default repo root (override by passing a path)
ROOT_DIR="${1:-$HOME/worshipos}"

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "❌ Repo folder not found: $ROOT_DIR"
  echo "   Tip: run: mkdir -p \"$ROOT_DIR\" (or pass the correct path)"
  exit 1
fi

cd "$ROOT_DIR"

API_PID=""

cleanup() {
  if [[ -n "${API_PID}" ]]; then
    echo "🛑 Stopping API (pid ${API_PID})..."
    kill "${API_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Start Colima if available (macOS)
if command -v colima >/dev/null 2>&1; then
  if ! colima status >/dev/null 2>&1; then
    echo "🧊 Starting Colima..."
    colima start
  fi
fi

# Prefer `docker compose`, fallback to `docker-compose`
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

echo "🐳 Starting Docker containers..."
$COMPOSE up -d

echo "⏳ Waiting for database..."
sleep 3

# Start API if folder exists
if [[ -d "api" ]]; then
  echo "🧠 Starting Express API..."
  (cd api && node index.js) &
  API_PID="$!"
else
  echo "ℹ️ No ./api directory found — skipping API start."
fi

# Start UI
if [[ ! -d "ui" ]]; then
  echo "❌ No ./ui directory found — cannot start UI."
  exit 1
fi

echo "🖥️ Starting Svelte dev server..."
cd ui

if [[ -f "yarn.lock" ]]; then
  echo "📦 Using Yarn..."
  yarn dev
else
  echo "📦 No yarn.lock found — using npm..."
  npm run dev
fi
