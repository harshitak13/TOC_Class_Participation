/**
 * CYK Parser Pro — Backend Server
 * Express + WebSocket server for real-time parsing, session history,
 * batch analysis, grammar comparison, and complexity analytics.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const { cykParse, convertToCNF, generateStrings, analyzeGrammar, computeComplexity } = require('./cyk-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true });
app.use('/api/', limiter);

// ─── In-memory Session Store ──────────────────────────────────────────────────
const sessions = new Map();   // sessionId → { history[], grammar }
const sharedGrammars = new Map(); // shareId → grammar snapshot

function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { history: [], grammar: null, created: Date.now() });
  return sessions.get(id);
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), sessions: sessions.size, version: '2.0.0' });
});

// Full CYK parse with steps
app.post('/api/parse', (req, res) => {
  try {
    const { rules, startSymbol, input, sessionId } = req.body;
    if (!rules || !Array.isArray(rules)) return res.status(400).json({ error: 'rules required' });
    if (!input || typeof input !== 'string') return res.status(400).json({ error: 'input required' });

    const tokens = input.trim().split(/\s+/).filter(Boolean);
    const result = cykParse(rules, startSymbol || 'S', tokens);

    // Save to session history
    if (sessionId) {
      const sess = getSession(sessionId);
      sess.history.push({ timestamp: Date.now(), input, rules, startSymbol, accepted: result.accepted });
      if (sess.history.length > 100) sess.history.shift();
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CNF conversion
app.post('/api/cnf', (req, res) => {
  try {
    const { rules, startSymbol } = req.body;
    const result = convertToCNF(rules, startSymbol || 'S');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// String generation
app.post('/api/generate', (req, res) => {
  try {
    const { rules, startSymbol, maxLength = 5, limit = 50 } = req.body;
    const strings = generateStrings(rules, startSymbol || 'S', maxLength, limit);
    res.json({ strings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Grammar analysis
app.post('/api/analyze', (req, res) => {
  try {
    const { rules, startSymbol } = req.body;
    const analysis = analyzeGrammar(rules, startSymbol || 'S');
    res.json(analysis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Complexity report
app.post('/api/complexity', (req, res) => {
  try {
    const { rules, startSymbol, input } = req.body;
    const tokens = input.trim().split(/\s+/).filter(Boolean);
    const report = computeComplexity(rules, startSymbol || 'S', tokens);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Batch parse multiple strings
app.post('/api/batch', (req, res) => {
  try {
    const { rules, startSymbol, inputs } = req.body;
    if (!Array.isArray(inputs)) return res.status(400).json({ error: 'inputs must be array' });
    if (inputs.length > 50) return res.status(400).json({ error: 'max 50 strings per batch' });

    const results = inputs.map(input => {
      const tokens = input.trim().split(/\s+/).filter(Boolean);
      const r = cykParse(rules, startSymbol || 'S', tokens);
      return { input, accepted: r.accepted, treeCount: r.trees.length };
    });

    res.json({ results, total: results.length, accepted: results.filter(r => r.accepted).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Session history
app.get('/api/session/:id/history', (req, res) => {
  const sess = getSession(req.params.id);
  res.json({ history: sess.history });
});

app.delete('/api/session/:id/history', (req, res) => {
  const sess = getSession(req.params.id);
  sess.history = [];
  res.json({ ok: true });
});

// Grammar share/load
app.post('/api/share', (req, res) => {
  const { rules, startSymbol, name } = req.body;
  const id = uuidv4().slice(0, 8);
  sharedGrammars.set(id, { rules, startSymbol, name: name || 'Untitled', created: Date.now() });
  res.json({ shareId: id, url: `/share/${id}` });
});

app.get('/api/share/:id', (req, res) => {
  const g = sharedGrammars.get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  res.json(g);
});

// List all built-in presets
app.get('/api/presets', (req, res) => {
  res.json({ presets: Object.keys(require('./presets')) });
});

app.get('/api/presets/:name', (req, res) => {
  const presets = require('./presets');
  const p = presets[req.params.name];
  if (!p) return res.status(404).json({ error: 'Unknown preset' });
  res.json(p);
});

// Serve built frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));

// ─── WebSocket — Streaming Step-by-Step Parse ────────────────────────────────
wss.on('connection', (ws) => {
  let aborted = false;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'parse_stream') {
      aborted = false;
      const { rules, startSymbol, input } = msg;
      const tokens = input.trim().split(/\s+/).filter(Boolean);

      ws.send(JSON.stringify({ type: 'start', n: tokens.length }));

      try {
        const result = cykParse(rules, startSymbol || 'S', tokens);

        for (let i = 0; i < result.steps.length; i++) {
          if (aborted || ws.readyState !== WebSocket.OPEN) break;
          ws.send(JSON.stringify({ type: 'step', step: result.steps[i], index: i, total: result.steps.length }));
          await delay(60);
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'done', accepted: result.accepted, treeCount: result.trees.length, trees: result.trees, derivation: result.derivation }));
        }
      } catch (e) {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    }

    if (msg.type === 'abort') aborted = true;
  });
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`\n🚀 CYK Parser Pro backend running on http://localhost:${PORT}\n`));
