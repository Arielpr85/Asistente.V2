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
  // 1) Mapear fuerza a handTier (para el JSON nuevo)
  // ---------------------------
  let handTier = "AIRE";

  // MUY_FUERTE (nuts-ish)
  if (
    madeCategory === "straight" ||
    madeCategory === "flush" ||
    madeCategory === "full_house" ||
    madeCategory === "quads" ||
    madeCategory === "straight_flush"
  ) {
    handTier = "MUY_FUERTE";
  }
  // FUERTE (valor claro)
  else if (madeCategory === "trips" || madeCategory === "two_pair") {
    handTier = "FUERTE";
  }
  // MEDIA (SDV / pares)
  else if (madeCategory === "pair") {
    handTier = "MEDIA";
  }
  // AIRE (high card sin nada)
  else {
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

  // ---------------------------
  // 3) Blockers para bluff (heurístico simple)
  // Para empezar: si tenemos A o K como high card (o en la mano) lo tratamos como blocker.
  // (mejorarlo después con blockers reales al board/range)
  // ---------------------------
  const heroRanks = (heroCards || []).map((c) => c?.rank).filter(Boolean);
  const hasHighBlocker = heroRanks.includes("A") || heroRanks.includes("K");
  const hasBlockersForBluff = handTier === "AIRE" && (hasHighBlocker || outs >= 4);

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





