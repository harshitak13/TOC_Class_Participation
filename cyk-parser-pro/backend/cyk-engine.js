/**
 * CYK Engine — Pure computation module
 * Used by both backend REST API and WebSocket streaming.
 */

'use strict';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isTerminal(s) { return s === s.toLowerCase() && !/^[A-Z]/.test(s); }
function isNonTerminal(s) { return /^[A-Z]/.test(s); }
function cpDp(dp) { return dp.map(r => r.map(c => new Set(c))); }
function cpBP(bp) { return bp.map(r => r.map(c => c.map(e => ({ ...e })))); }

// ─── CYK Core ─────────────────────────────────────────────────────────────────
function cykParse(rules, startSym, tokens) {
  const n = tokens.length;
  if (!n) return { accepted: false, steps: [], trees: [], derivation: [] };

  const dp = Array.from({ length: n }, () => Array.from({ length: n }, () => new Set()));
  const bp = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
  const steps = [];

  // Diagonal — terminals
  for (let i = 0; i < n; i++) {
    const tok = tokens[i];
    rules.forEach((r, ri) => {
      if (r.rhs.length === 1 && r.rhs[0] === tok) {
        dp[i][i].add(r.lhs);
        bp[i][i].push({ sym: r.lhs, type: 't', tok, ri });
      }
    });
    steps.push({
      dp: cpDp(dp), bp: cpBP(bp), hi: i, hj: i, hk: -1,
      fi: -1, phase: 'diagonal',
      msg: `Diagonal dp[${i + 1}][${i + 1}] ← "${tok}" → {${[...dp[i][i]].join(', ') || '∅'}}`
    });
  }

  // Upper triangle
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1;
      for (let k = i; k < j; k++) {
        let lastFi = -1;
        rules.forEach((r, ri) => {
          if (r.rhs.length === 2) {
            const [B, C] = r.rhs;
            if (dp[i][k].has(B) && dp[k + 1][j].has(C)) {
              if (!dp[i][j].has(r.lhs)) { dp[i][j].add(r.lhs); lastFi = ri; }
              bp[i][j].push({ sym: r.lhs, type: 'b', B, C, k, ri });
            }
          }
        });
        steps.push({
          dp: cpDp(dp), bp: cpBP(bp), hi: i, hj: j, hk: k,
          fi: lastFi, phase: 'upper',
          msg: `len=${len} dp[${i + 1}][${j + 1}] k=${k + 1}: {${[...dp[i][j]].join(', ') || '∅'}}`
        });
      }
    }
  }

  const accepted = dp[0][n - 1].has(startSym);

  // Build parse trees
  const trees = [];
  buildTreesRec(bp, 0, n - 1, startSym, trees, 0);

  // Build derivation for first tree
  const derivation = trees.length ? buildDerivation(trees[0], startSym) : [];

  return { accepted, steps, trees, derivation, dpFinal: cpDp(dp), n };
}

// ─── Tree Building ────────────────────────────────────────────────────────────
function buildTreesRec(bp, i, j, sym, results, depth) {
  if (depth > 20 || results.length >= 8) return;
  if (!bp[i] || !bp[i][j]) return;
  const entries = bp[i][j].filter(e => e.sym === sym);
  if (!entries.length) return;

  const seen = new Set();
  entries.forEach(entry => {
    const key = JSON.stringify(entry);
    if (seen.has(key)) return; seen.add(key);
    if (entry.type === 't') {
      results.push({ label: sym, children: [{ label: entry.tok, leaf: true }] });
    } else {
      const lefts = [], rights = [];
      buildTreesRec(bp, i, entry.k, entry.B, lefts, depth + 1);
      buildTreesRec(bp, entry.k + 1, j, entry.C, rights, depth + 1);
      if (!lefts.length) lefts.push({ label: entry.B });
      if (!rights.length) rights.push({ label: entry.C });
      lefts.forEach(l => rights.forEach(r => {
        if (results.length < 8) results.push({ label: sym, children: [l, r] });
      }));
    }
  });
}

function buildDerivation(tree, startSym) {
  const steps = [{ sent: [startSym], rule: null }];
  function derive(node, s) {
    if (!node.children) return;
    const idx = s.indexOf(node.label);
    if (idx === -1) return;
    const rule = `${node.label}→${node.children.map(c => c.label).join(' ')}`;
    s.splice(idx, 1, ...node.children.map(c => c.label));
    steps.push({ sent: [...s], rule });
    node.children.forEach(c => { if (!c.leaf) derive(c, s); });
  }
  const s = [startSym];
  derive(tree, s);
  return steps;
}

// ─── CNF Converter ────────────────────────────────────────────────────────────
function convertToCNF(rawRules, startSym) {
  let r = rawRules.map(x => ({ lhs: x.lhs, rhs: [...x.rhs] }));
  const log = [];
  let ctr = 0;
  const newNT = () => `X${++ctr}`;

  // New start
  const S0 = startSym + '0';
  r.unshift({ lhs: S0, rhs: [startSym] });
  log.push({ name: 'START', desc: 'Introduce new start symbol', rules: r.map(x => ({ ...x, rhs: [...x.rhs] })) });

  // TERM — replace terminals in binary rules
  const termMap = {};
  const r2 = [];
  r.forEach(rule => {
    if (rule.rhs.length >= 2) {
      const newRhs = rule.rhs.map(s => { if (isTerminal(s)) { if (!termMap[s]) termMap[s] = newNT(); return termMap[s]; } return s; });
      r2.push({ lhs: rule.lhs, rhs: newRhs });
    } else r2.push({ ...rule, rhs: [...rule.rhs] });
  });
  Object.entries(termMap).forEach(([t, nt]) => r2.push({ lhs: nt, rhs: [t] }));
  log.push({ name: 'TERM', desc: 'Replace terminals in binary rules', rules: r2.map(x => ({ ...x, rhs: [...x.rhs] })) });

  // BIN — break rules with >2 symbols
  const r3 = [];
  r2.forEach(rule => {
    if (rule.rhs.length <= 2) { r3.push({ ...rule, rhs: [...rule.rhs] }); return; }
    let cur = rule.lhs;
    for (let i = 0; i < rule.rhs.length - 2; i++) {
      const nn = newNT();
      r3.push({ lhs: cur, rhs: [rule.rhs[i], nn] });
      cur = nn;
    }
    r3.push({ lhs: cur, rhs: [rule.rhs[rule.rhs.length - 2], rule.rhs[rule.rhs.length - 1]] });
  });
  log.push({ name: 'BIN', desc: 'Binarize long rules', rules: r3.map(x => ({ ...x, rhs: [...x.rhs] })) });

  // DEL — handle epsilon (simplified)
  log.push({ name: 'DEL', desc: 'Epsilon elimination (not applicable for strict CNF here)', rules: r3.map(x => ({ ...x, rhs: [...x.rhs] })) });

  // UNIT — eliminate unit productions (A→B where B is NT)
  const r4 = [...r3];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < r4.length; i++) {
      const rule = r4[i];
      if (rule.rhs.length === 1 && isNonTerminal(rule.rhs[0])) {
        const target = rule.rhs[0];
        const expand = r4.filter(x => x.lhs === target && !(x.rhs.length === 1 && isNonTerminal(x.rhs[0])));
        if (expand.length) {
          r4.splice(i, 1, ...expand.map(x => ({ lhs: rule.lhs, rhs: [...x.rhs] })));
          changed = true;
          break;
        }
      }
    }
  }
  log.push({ name: 'UNIT', desc: 'Eliminate unit productions (A→B)', rules: r4.map(x => ({ ...x, rhs: [...x.rhs] })) });

  return { cnfRules: r4, startSymbol: S0, log };
}

// ─── String Generator ─────────────────────────────────────────────────────────
function generateStrings(rules, startSym, maxLength, limit) {
  const found = new Set();
  const memo = new Map();

  function gen(sym, budget) {
    if (budget <= 0) return [];
    const key = `${sym}|${budget}`;
    if (memo.has(key)) return memo.get(key);
    const res = new Set();
    rules.filter(r => r.lhs === sym).forEach(r => {
      if (r.rhs.length === 1 && isTerminal(r.rhs[0])) {
        if (budget >= 1) res.add(r.rhs[0]);
      } else if (r.rhs.length === 2) {
        for (let lb = 1; lb < budget; lb++) {
          const lefts = gen(r.rhs[0], lb);
          const rights = gen(r.rhs[1], budget - lb);
          lefts.forEach(l => rights.forEach(r2 => { if (l || r2) res.add((l + ' ' + r2).trim()); }));
        }
      }
    });
    const arr = [...res].slice(0, 30);
    memo.set(key, arr);
    return arr;
  }

  for (let len = 1; len <= maxLength; len++) {
    memo.clear();
    gen(startSym, len).forEach(s => { if (s.trim()) found.add(s.trim()); });
  }

  return [...found]
    .sort((a, b) => a.split(' ').length - b.split(' ').length || a.localeCompare(b))
    .slice(0, limit);
}

// ─── Grammar Analysis ─────────────────────────────────────────────────────────
function analyzeGrammar(rules, startSym) {
  const nts = new Set(rules.map(r => r.lhs));
  const terminals = new Set();
  const nullable = new Set();
  const unit = [];
  const binary = [];
  const notCnf = [];

  rules.forEach(r => {
    r.rhs.forEach(s => { if (isTerminal(s)) terminals.add(s); });
    if (r.rhs.length === 1 && isTerminal(r.rhs[0])) binary.push(r);
    else if (r.rhs.length === 2 && r.rhs.every(isNonTerminal)) binary.push(r);
    else if (r.rhs.length === 1 && isNonTerminal(r.rhs[0])) unit.push(r);
    else notCnf.push(r);
  });

  // Reachability
  const reachable = new Set([startSym]);
  let changed = true;
  while (changed) {
    changed = false;
    rules.forEach(r => {
      if (reachable.has(r.lhs)) r.rhs.forEach(s => { if (isNonTerminal(s) && !reachable.has(s)) { reachable.add(s); changed = true; } });
    });
  }

  // Generating non-terminals (those that can eventually produce a terminal string)
  const generating = new Set();
  rules.forEach(r => { if (r.rhs.every(s => isTerminal(s))) generating.add(r.lhs); });
  changed = true;
  while (changed) {
    changed = false;
    rules.forEach(r => {
      if (!generating.has(r.lhs) && r.rhs.every(s => isTerminal(s) || generating.has(s))) {
        generating.add(r.lhs); changed = true;
      }
    });
  }

  const unreachable = [...nts].filter(s => !reachable.has(s));
  const nonproductive = [...nts].filter(s => !generating.has(s));
  const isCNF = notCnf.length === 0 && unit.length === 0;

  return {
    nonTerminals: [...nts],
    terminals: [...terminals],
    startSymbol: startSym,
    ruleCount: rules.length,
    isCNF,
    isAmbiguous: null, // requires actual ambiguity test
    unreachableSymbols: unreachable,
    nonproductiveSymbols: nonproductive,
    unitProductions: unit.map(r => `${r.lhs}→${r.rhs.join(' ')}`),
    binaryRules: binary.length,
    nonCNFRules: notCnf.map(r => `${r.lhs}→${r.rhs.join(' ')}`),
    reachable: [...reachable],
    generating: [...generating]
  };
}

// ─── Complexity Analytics ─────────────────────────────────────────────────────
function computeComplexity(rules, startSym, tokens) {
  const n = tokens.length;
  const r = rules.length;
  const theoreticalOps = n * n * n * r; // O(n³ * |G|)

  // Count actual operations
  let actualOps = 0;
  const dp = Array.from({ length: n }, () => Array.from({ length: n }, () => new Set()));

  for (let i = 0; i < n; i++) {
    const tok = tokens[i];
    rules.forEach(rule => {
      actualOps++;
      if (rule.rhs.length === 1 && rule.rhs[0] === tok) dp[i][i].add(rule.lhs);
    });
  }

  for (let len = 2; len <= n; len++) {
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1;
      for (let k = i; k < j; k++) {
        rules.forEach(rule => {
          actualOps++;
          if (rule.rhs.length === 2) {
            const [B, C] = rule.rhs;
            if (dp[i][k].has(B) && dp[k + 1][j].has(C)) dp[i][j].add(rule.lhs);
          }
        });
      }
    }
  }

  // Cell fill density
  let filledCells = 0;
  const totalCells = (n * (n + 1)) / 2;
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) if (dp[i][j].size > 0) filledCells++;

  return {
    inputLength: n,
    ruleCount: r,
    theoreticalOps,
    actualOps,
    efficiency: ((1 - actualOps / Math.max(theoreticalOps, 1)) * 100).toFixed(1),
    filledCells,
    totalCells,
    fillDensity: ((filledCells / Math.max(totalCells, 1)) * 100).toFixed(1),
    timeComplexity: 'O(n³ · |G|)',
    spaceComplexity: 'O(n²)',
    bigO: { n, r, n3r: n ** 3 * r }
  };
}

module.exports = { cykParse, convertToCNF, generateStrings, analyzeGrammar, computeComplexity };
