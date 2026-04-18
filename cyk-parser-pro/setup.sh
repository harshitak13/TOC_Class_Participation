#!/usr/bin/env bash
# CYK Parser Pro v2 — Quick Setup Script
set -e

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   CYK Parser Pro v2 — Setup Script   ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Install from: https://nodejs.org (v18 or later)"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js v18+ required. You have: $(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install backend deps
echo ""
echo "📦 Installing backend dependencies..."
npm install

# Install frontend deps
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "✅ All dependencies installed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  🚀  Development mode:"
echo "      npm run dev"
echo "      → Frontend: http://localhost:5173"
echo "      → Backend:  http://localhost:3001"
echo ""
echo "  🏭  Production mode:"
echo "      npm run build && npm start"
echo "      → App: http://localhost:3001"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
