// js/hand-snapshot.js
import { evaluate7 } from "./hand-eval.js";

/**
 * buildHandSnapshot(heroCards, boardCards)
 *
 * ✅ Adaptado al JSON postflop v2:
 * Devuelve:
 * - handTier: "MUY_FUERTE" | "FUERTE" | "MEDIA" | "AIRE"
 * - outs: number
 * - hasBlockersForBluff: boolean (heurístico simple)
 * - madeCategory/label/ranks/flags para debug
 */
const RANK_VAL = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const GOOD_KICKER_MIN = RANK_VAL.Q;

function getRankValue(rank) {
  return RANK_VAL[rank] || 0;
}

function getBoardRanks(boardCards) {
  return (boardCards || []).map((c) => c?.rank).filter(Boolean);
}

function getHeroRanks(heroCards) {
  return (heroCards || []).map((c) => c?.rank).filter(Boolean);
}

function getTopBoardRanks(boardCards) {
  const vals = getBoardRanks(boardCards)
    .map(getRankValue)
    .filter(Boolean)
    .sort((a, b) => b - a);
  const unique = [...new Set(vals)];
  return {
    top: unique[0] || 0,
    second: unique[1] || 0,
  };
}

function isPocketPair(heroCards) {
  if (!heroCards || heroCards.length !== 2) return false;
  const r1 = heroCards[0]?.rank;
  const r2 = heroCards[1]?.rank;
  return !!r1 && r1 === r2;
}

function isOverpair(heroCards, boardCards) {
  if (!isPocketPair(heroCards)) return false;
  const heroVal = getRankValue(heroCards[0]?.rank);
  const { top } = getTopBoardRanks(boardCards);
  return heroVal > top;
}

function hasTopPairGoodKicker(heroCards, boardCards) {
  if (!heroCards || heroCards.length !== 2) return false;
  const { top } = getTopBoardRanks(boardCards);
  if (!top) return false;
  const heroVals = heroCards.map((c) => getRankValue(c?.rank));
  if (!heroVals.includes(top)) return false;
  const kicker = heroVals.find((v) => v !== top) || 0;
  return kicker >= GOOD_KICKER_MIN;
}

function hasTopTwoPair(heroCards, boardCards) {
  if (!heroCards || heroCards.length !== 2) return false;
  const { top, second } = getTopBoardRanks(boardCards);
  if (!top || !second) return false;
  const heroVals = heroCards.map((c) => getRankValue(c?.rank));
  return heroVals.includes(top) && heroVals.includes(second);
}

export function buildHandSnapshot(heroCards, boardCards) {
  if (!heroCards?.length || !boardCards?.length) {
    return {
      handTier: "AIRE",
      outs: 0,
      hasBlockersForBluff: false,
      madeCategory: "none",
      label: "",
      ranks: [],
      flags: {},
    };
  }

  const evalRes = evaluate7(heroCards, boardCards);

  if (!evalRes.ok) {
    return {
      handTier: "AIRE",
      outs: 0,
      hasBlockersForBluff: false,
      madeCategory: "none",
      label: "",
      ranks: [],
      flags: {},
    };
  }

  const madeCategory = evalRes.category;
  const flags = evalRes.flags || {};

  // ---------------------------
  // 1) Mapear fuerza a handTier (alineado a TPGK / top two pair+)
  // ---------------------------
  let handTier = "AIRE";

  const isTopTwo = hasTopTwoPair(heroCards, boardCards);
  const isTopPairGood = hasTopPairGoodKicker(heroCards, boardCards);
  const isOver = isOverpair(heroCards, boardCards);

  // MUY_FUERTE (top two pair+)
  if (
    madeCategory === "straight" ||
    madeCategory === "flush" ||
    madeCategory === "full_house" ||
    madeCategory === "quads" ||
    madeCategory === "straight_flush" ||
    madeCategory === "trips" ||
    isTopTwo
  ) {
    handTier = "MUY_FUERTE";
  }
  // FUERTE (TPGK / two pair débil / overpair)
  else if (madeCategory === "two_pair" || isTopPairGood || isOver) {
    handTier = "FUERTE";
  }
  // MEDIA (pares que no entran en fuerte)
  else if (madeCategory === "pair") {
    handTier = "MEDIA";
  } else {
    handTier = "AIRE";
  }

  // ---------------------------
  // 2) Estimar outs (consistente con tu estrategia)
  // - flush draw = ~9 outs
  // - OESD = ~8 outs
  // - gutshot = ~4 outs
  // Si hay más de un draw, sumamos con cap simple.
  // ---------------------------
  let outs = 0;
  if (flags.hasFlushDraw) outs += 9;
  if (flags.hasOESD) outs += 8;
  if (flags.hasGutshot) outs += 4;

  // cap para no irnos a cualquier cosa (ej FD+OESD = 17 es válido)
  if (outs > 17) outs = 17;

  const isRiver = (boardCards || []).length >= 5;
  if (isRiver) outs = 0;

  // ---------------------------
  // 3) Blockers para bluff (heurístico simple)
  // Para empezar: si tenemos A o K como high card (o en la mano) lo tratamos como blocker.
  // (mejorarlo después con blockers reales al board/range)
  // ---------------------------
  const heroRanks = (heroCards || []).map((c) => c?.rank).filter(Boolean);
  const hasHighBlocker = heroRanks.includes("A") || heroRanks.includes("K");
  const hasBlockersForBluff =
    handTier === "AIRE" && (hasHighBlocker || (!isRiver && outs >= 4));

  return {
    handTier,
    outs,
    hasBlockersForBluff,
    madeCategory,
    label: evalRes.label,
    ranks: evalRes.ranks,
    flags,
  };
}


