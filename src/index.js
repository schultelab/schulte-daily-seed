/**
 * schulte-daily-seed — the exact seed algorithm behind SchulteLab's daily
 * challenge (https://schultelab.org/daily-challenge/).
 *
 * One UTC date → one integer seed → one deterministic grid, identical for
 * every player worldwide. Zero dependencies, works in browsers and Node 18+.
 *
 * This file is byte-for-byte the same logic as the site's production code
 * (src/schulte/challenge.ts + src/schulte/engine.ts). If the output here
 * differs from the website, the website is wrong — that's the point of
 * open-sourcing it.
 */

/** mulberry32 — small fast deterministic PRNG (same as site engine). */
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates shuffle driven by the seeded PRNG. */
export function shuffle(arr, rand) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Classical poems stream for poem-mode grids (public domain texts). */
export const POEM_STREAM = (
  '床前明月光疑是地上霜举头望明月低头思故乡' +
  '春眠不觉晓处处闻啼鸟夜来风雨声花落知多少' +
  '白日依山尽黄河入海流欲穷千里目更上一层楼' +
  '红豆生南国春来发几枝愿君多采撷此物最相思' +
  '远上寒山石径斜白云生处有人家停车坐爱枫林晚霜叶红于二月花'
)

/** Ordered target values the player must click, 1st → last. */
export function targetSequence(size, content) {
  const n = size * size
  if (content === 'numbers') return Array.from({ length: n }, (_, i) => String(i + 1))
  if (content === 'letters') {
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : ''))
  }
  return POEM_STREAM.slice(0, n).split('')
}

/**
 * Build the shuffled grid for a size/content/seed.
 * A cell is { seqIdx, value } — the player clicks seqIdx 0,1,2… in order
 * (position-based identity, because poem grids contain duplicate chars).
 */
export function generateGrid(size, content, seed) {
  const rand = seed === undefined ? Math.random : rng(seed)
  const cells = targetSequence(size, content).map((value, seqIdx) => ({ seqIdx, value }))
  return shuffle(cells, rand)
}

/**
 * Numeric seed for a UTC date — YYYYMMDD as an integer, e.g. 2026-09-01 →
 * 20260901. Same date, same seed, same board, everywhere on Earth.
 */
export function dailySeed(d = new Date()) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/* ---------- async challenge links (zero-backend "beat my time") ---------- */

function b64encode(json) {
  if (typeof btoa !== 'undefined') return btoa(unescape(encodeURIComponent(json)))
  return Buffer.from(json, 'utf8').toString('base64')
}

function b64decode(b64) {
  if (typeof atob !== 'undefined') return decodeURIComponent(escape(atob(b64)))
  return Buffer.from(b64, 'base64').toString('utf8')
}

/**
 * Encode a challenge payload { v:1, seed, size, mode, content, t } into a
 * base64url string — the whole board state + the challenger's time (ms)
 * travels in the URL, no backend involved.
 */
export function encodeChallenge(p) {
  return b64encode(JSON.stringify(p)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a base64url challenge string, or null when malformed. */
export function decodeChallenge(s) {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const p = JSON.parse(b64decode(b64))
    if (p && p.v === 1 && typeof p.seed === 'number' && typeof p.t === 'number') return p
    return null
  } catch {
    return null
  }
}
