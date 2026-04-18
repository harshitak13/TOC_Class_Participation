# CYK Parser Pro v2.0 🔬

A full-stack, production-grade CYK (Cocke–Younger–Kasami) parser simulator with real-time WebSocket streaming, REST API backend, batch analysis, complexity charts, grammar sharing, and much more.

---

## 🏗️ Architecture

```
cyk-parser-pro/
├── backend/
│   ├── server.js          # Express + WebSocket server
│   ├── cyk-engine.js      # Core parsing algorithms (pure JS module)
│   └── presets.js         # Built-in grammar presets
├── frontend/
│   ├── index.html         # Full SPA (Vite-served)
│   ├── vite.config.js     # Vite build config with API proxy
│   └── package.json
├── package.json           # Root (concurrently dev, build, start)
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (check: `node --version`)
- **npm 9+** (check: `npm --version`)

### 1. Install dependencies

```bash
# From project root
npm run install:all
```

This installs backend deps + frontend (Vite) deps.

### 2. Development mode (both servers)

```bash
npm run dev
```

This starts:
- **Backend** at `http://localhost:3001` (Express + WebSocket, via nodemon)
- **Frontend** at `http://localhost:5173` (Vite dev server with HMR + API proxy)

Open `http://localhost:5173` in your browser.

### 3. Production build

```bash
npm run build         # Builds frontend to frontend/dist/
npm start             # Serves everything from Express on port 3001
```

Then open `http://localhost:3001`.

---

## 📡 REST API Reference

All endpoints are at `http://localhost:3001/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health, uptime, version |
| `POST` | `/api/parse` | Full CYK parse with steps + trees |
| `POST` | `/api/cnf` | Convert grammar to CNF |
| `POST` | `/api/generate` | Generate strings from grammar |
| `POST` | `/api/analyze` | Deep grammar analysis |
| `POST` | `/api/complexity` | Complexity metrics + op counts |
| `POST` | `/api/batch` | Parse up to 50 strings at once |
| `GET` | `/api/presets` | List all presets |
| `GET` | `/api/presets/:name` | Get a specific preset |
| `POST` | `/api/share` | Create a share link for a grammar |
| `GET` | `/api/share/:id` | Load a shared grammar |
| `GET` | `/api/session/:id/history` | Get parse history for a session |
| `DELETE` | `/api/session/:id/history` | Clear session history |

### Example: Parse a string

```bash
curl -X POST http://localhost:3001/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {"lhs": "S", "rhs": ["A", "B"]},
      {"lhs": "S", "rhs": ["A", "C"]},
      {"lhs": "C", "rhs": ["S", "B"]},
      {"lhs": "A", "rhs": ["a"]},
      {"lhs": "B", "rhs": ["b"]}
    ],
    "startSymbol": "S",
    "input": "a a b b"
  }'
```

### Example: Batch parse

```bash
curl -X POST http://localhost:3001/api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [...],
    "startSymbol": "S",
    "inputs": ["a a b b", "a b", "a a a b b b"]
  }'
```

---

## ⚡ WebSocket Streaming

Connect to `ws://localhost:3001/ws` for real-time step streaming.

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.send(JSON.stringify({
  type: 'parse_stream',
  rules: [...],
  startSymbol: 'S',
  input: 'a a b b'
}));

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'step') {
    // msg.step — DP table snapshot, highlighted cell, fired rule
    // msg.index — current step index
    // msg.total — total steps
  }
  if (msg.type === 'done') {
    // msg.accepted — boolean
    // msg.trees — all parse trees
    // msg.derivation — leftmost derivation steps
  }
};

// Abort streaming
ws.send(JSON.stringify({ type: 'abort' }));
```

---

## ✨ Features

### Core Algorithm
- **CYK parsing** with full DP table construction
- **Step-by-step interactive mode** — forward, backward, jump to end
- **WebSocket real-time streaming** of parse steps with progress bar
- **Multiple parse trees** — full ambiguity detection (up to 8 trees)
- **Leftmost derivation** display for each parse tree
- **CNF auto-conversion** — START, TERM, BIN, DEL, UNIT steps

### UI Panels
| Tab | Feature |
|-----|---------|
| **DP Table** | Interactive table with hover tooltips showing dp[i][j] contents |
| **Parse Trees** | SVG tree visualization, export SVG/PNG/JSON, tree switching |
| **Derivation** | Step-by-step leftmost derivation with rule annotations |
| **CNF Steps** | Animated CNF conversion breakdown |
| **String Gen** | Generate all valid strings up to length N |
| **Grammar** | CNF validation, NT/T analysis, rule classification |
| **Batch** | Test 50 strings simultaneously |
| **Complexity** | O(n³|G|) analysis + Chart.js visualization |
| **History** | Persistent parse history with reload |
| **Share** | Backend-powered grammar sharing via share ID |

### Developer Features
- **Backend online/offline detection** — graceful fallback to local engine
- **Rate limiting** (120 req/min per IP via `express-rate-limit`)
- **Security headers** via `helmet`
- **HTTP request logging** via `morgan`
- **Session-based history** stored in memory
- **Keyboard shortcuts** — Arrow keys, Ctrl+Enter, number keys for tabs

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` (in input) | Parse string |
| `→` | Step forward |
| `←` | Step back |
| `Ctrl+Enter` | Run all steps |
| `Esc` | Reset |
| `Ctrl+G` | Generate strings |
| `Ctrl+B` | Run batch |
| `1` – `9` | Switch to tab N |

---

## 🧠 Built-in Grammar Presets

| Preset | Language | Description |
|--------|----------|-------------|
| `anbn` | {aⁿbⁿ \| n≥1} | Classic CFL — equal a's before b's |
| `eqab` | Equal a,b | Strings with same number of a and b |
| `palindrome` | Even palindromes | Palindromes over {a,b} |
| `arith` | Arithmetic | Simple expressions with + |
| `ambig` | Ambiguous | Intentionally ambiguous grammar |
| `dyck` | Dyck language | Balanced parentheses |
| `wcw` | ww^R | Strings followed by their reverse |

---

## 🔧 Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |

---

## 📦 Dependencies

### Backend
- `express` — HTTP server
- `ws` — WebSocket server
- `cors`, `helmet` — Security
- `morgan` — Request logging
- `express-rate-limit` — Rate limiting
- `uuid` — Share IDs

### Frontend (dev only)
- `vite` — Build tool + dev server
- `chart.js` — Complexity charts
- `html2canvas` — PNG export

---

## 🧪 Testing the API

```bash
# Health check
curl http://localhost:3001/api/health

# List presets
curl http://localhost:3001/api/presets

# Get a preset
curl http://localhost:3001/api/presets/anbn

# Grammar analysis
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"rules":[{"lhs":"S","rhs":["A","B"]},{"lhs":"A","rhs":["a"]},{"lhs":"B","rhs":["b"]}],"startSymbol":"S"}'
```

---

## 📄 License

MIT — use freely for educational purposes.
