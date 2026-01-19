// js/hand-eval.js
// Evalúa mano del HERO + board (hasta 7 cartas) y devuelve:
// - categoría (high_card, pair, two_pair, trips, straight, flush, full_house, quads, straight_flush)
// - ranks relevantes (para desempates)
// - flags útiles (hasFlushDraw, hasOESD, hasGutshot)

const RANK_TO_VAL = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

function uniq(arr) { return [...new Set(arr)]; }

function countBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function getStraightHigh(valsUniqueSortedAsc) {
  let vals = [...valsUniqueSortedAsc];
  if (vals.includes(14)) vals.unshift(1); // wheel
  let run = 1;
  let bestHigh = 0;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] === vals[i - 1] + 1) {
      run++;
      if (run >= 5) bestHigh = vals[i] === 1 ? 5 : vals[i];
    } else if (vals[i] !== vals[i - 1]) {
      run = 1;
    }
  }
  return bestHigh;
}

function pickTopKickers(valsDesc, excludeVals = [], k = 5) {
  const ex = new Set(excludeVals);
  const out = [];
  for (const v of valsDesc) {
    if (ex.has(v)) continue;
    out.push(v);
    if (out.length === k) break;
  }
  return out;
}

function buildHandLabel(category) {
  const map = {
    straight_flush: "Straight Flush",
    quads: "Poker",
    full_house: "Full House",
    flush: "Color",
    straight: "Escalera",
    trips: "Trío",
    two_pair: "Doble par",
    pair: "Par",
    high_card: "Carta alta",
  };
  return map[category] || category;
}

export function evaluate7(heroCards, boardCards) {
  const cards = [...(heroCards || []), ...(boardCards || [])].filter(Boolean);
  if (cards.length < 5) {
    return { ok: false, reason: "faltan cartas", category: "", label: "", ranks: [], flags: {} };
  }

  const vals = cards.map((c) => RANK_TO_VAL[c.rank] || 0).filter(Boolean);
  const valsDesc = [...vals].sort((a, b) => b - a);
  const valsUniqueAsc = uniq(vals).sort((a, b) => a - b);

  // suits
  const suitsMap = countBy(cards, (c) => c.suit);
  const flushSuit = [...suitsMap.entries()].find(([s, c]) => c >= 5)?.[0] || null;

  // counts por rank
  const ranksMap = countBy(cards, (c) => RANK_TO_VAL[c.rank] || 0);
  const groups = [...ranksMap.entries()]
    .map(([v, count]) => ({ v, count }))
    .sort((a, b) => b.count - a.count || b.v - a.v);

  // straight + straight flush
  const straightHigh = getStraightHigh(valsUniqueAsc);

  let straightFlushHigh = 0;
  if (flushSuit) {
    const flushVals = cards
      .filter((c) => c.suit === flushSuit)
      .map((c) => RANK_TO_VAL[c.rank])
      .filter(Boolean);
    const flushUniqueAsc = uniq(flushVals).sort((a, b) => a - b);
    straightFlushHigh = getStraightHigh(flushUniqueAsc);
  }

  // --- categoría principal ---
  let category = "high_card";
  let ranks = [];

  if (straightFlushHigh) {
    category = "straight_flush";
    ranks = [straightFlushHigh];
  } else if (groups[0]?.count === 4) {
    category = "quads";
    const quad = groups[0].v;
    const kicker = pickTopKickers(valsDesc, [quad], 1)[0] || 0;
    ranks = [quad, kicker];
  } else if (groups[0]?.count === 3 && groups[1]?.count >= 2) {
    category = "full_house";
    const trips = groups[0].v;
    const pair = groups[1].v;
    ranks = [trips, pair];
  } else if (flushSuit) {
    category = "flush";
    const flushValsDesc = cards
      .filter((c) => c.suit === flushSuit)
      .map((c) => RANK_TO_VAL[c.rank])
      .filter(Boolean)
      .sort((a, b) => b - a)
      .slice(0, 5);
    ranks = flushValsDesc;
  } else if (straightHigh) {
    category = "straight";
    ranks = [straightHigh];
  } else if (groups[0]?.count === 3) {
    category = "trips";
    const trips = groups[0].v;
    const kickers = pickTopKickers(valsDesc, [trips], 2);
    ranks = [trips, ...kickers];
  } else if (groups[0]?.count === 2 && groups[1]?.count === 2) {
    category = "two_pair";
    const p1 = Math.max(groups[0].v, groups[1].v);
    const p2 = Math.min(groups[0].v, groups[1].v);
    const kicker = pickTopKickers(valsDesc, [p1, p2], 1)[0] || 0;
    ranks = [p1, p2, kicker];
  } else if (groups[0]?.count === 2) {
    category = "pair";
    const pair = groups[0].v;
    const kickers = pickTopKickers(valsDesc, [pair], 3);
    ranks = [pair, ...kickers];
  } else {
    category = "high_card";
    ranks = valsDesc.slice(0, 5);
  }

  // --- draws (simple) ---
  const maxSuitCount = Math.max(...[...suitsMap.values()], 0);
  const hasFlushDraw = maxSuitCount === 4; // 4 al mismo palo (sin ser flush)
  const hasOESD = detectOESD(cards);
  const hasGutshot = !hasOESD && detectGutshot(cards);

  return {
    ok: true,
    category,
    label: buildHandLabel(category),
    ranks,
    flags: { hasFlushDraw, hasOESD, hasGutshot },
  };
}

// Detectores simples de draws (hero+board)
function detectOESD(cards) {
  const vals = uniq(cards.map((c) => RANK_TO_VAL[c.rank]).filter(Boolean)).sort((a, b) => a - b);
  const vals2 = vals.includes(14) ? [1, ...vals] : vals;
  for (let i = 0; i < vals2.length; i++) {
    const window = vals2.slice(i, i + 4);
    if (window.length < 4) break;
    if (window[3] - window[0] === 3) return true;
  }
  return false;
}

function detectGutshot(cards) {
  const vals = uniq(cards.map((c) => RANK_TO_VAL[c.rank]).filter(Boolean)).sort((a, b) => a - b);
  const vals2 = vals.includes(14) ? [1, ...vals] : vals;
  for (let start = 1; start <= 10; start++) {
    const need = [start, start + 1, start + 2, start + 3, start + 4];
    const have = need.filter((v) => vals2.includes(v)).length;
    if (have === 4) return true;
  }
  return false;
}

