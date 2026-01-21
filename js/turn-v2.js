// js/turn-v2.js
import { AppState, suitSymbol, notifyStateChange } from "./state-v2.js";
import { renderUnified } from "./ui-v2.js";
import { getHeroCards, getBoardCards } from "./cards-dom.js";
import { buildHandSnapshot } from "./hand-snapshot.js";
import { pickPostflopActionV2, formatAction } from "./postflop-engine-v2.js";

/**
 * ✅ Turn v2 alineado al JSON postflop-srp-initiative-v2:
 * - handTier/outs/blockers vienen directo de buildHandSnapshot()
 * - turnDynamic usa: STATIC | AGGRESSOR | DEFENDER
 * - boardCompletedDraw / heroCompletedDraw coherentes
 * - guarda turnAdvice para la UI unificada
 */

function snapshotToHandTier(snapshot) {
  const ht = snapshot?.handTier;
  if (ht === "MUY_FUERTE" || ht === "FUERTE" || ht === "MEDIA" || ht === "AIRE")
    return ht;
  return "AIRE";
}

function calcOutsFromSnapshot(snapshot) {
  const o = Number(snapshot?.outs);
  return Number.isFinite(o) ? o : 0;
}

function blockersFromSnapshot(snapshot) {
  return !!snapshot?.hasBlockersForBluff;
}

function getVillainProfile() {
  const sel = document.getElementById("villainProfile");
  const v = String(sel?.value || "DEFAULT")
    .toUpperCase()
    .trim();
  if (v === "BAD" || v === "GOOD") return v;
  return "DEFAULT";
}

function handTierValue(tier) {
  if (tier === "MUY_FUERTE") return 3;
  if (tier === "FUERTE") return 2;
  if (tier === "MEDIA") return 1;
  return 0;
}

function computeTurnDynamic(heroCards, flop3, turnCard) {
  // JSON: "STATIC" | "AGGRESSOR" | "DEFENDER"
  if (!flop3 || flop3.length !== 3 || !turnCard?.rank) return "STATIC";

  const flopSnapshot = buildHandSnapshot(heroCards, flop3);
  const turnSnapshot = buildHandSnapshot(heroCards, [...flop3, turnCard]);

  const flopTier = handTierValue(snapshotToHandTier(flopSnapshot));
  const turnTier = handTierValue(snapshotToHandTier(turnSnapshot));
  const tierDelta = turnTier - flopTier;

  const flopOuts = Number.isFinite(flopSnapshot?.outs) ? flopSnapshot.outs : 0;
  const turnOuts = Number.isFinite(turnSnapshot?.outs) ? turnSnapshot.outs : 0;
  const outsDelta = turnOuts - flopOuts;

  if (tierDelta > 0 || outsDelta > 0) return "AGGRESSOR";
  if (tierDelta < 0 || outsDelta < 0) return "DEFENDER";
  return "STATIC";
}

function didBoardCompleteFlush(flop3, turnCard) {
  // Se completa flush en board si flop era 2-tone y cae el 3er palo
  if (!flop3 || flop3.length !== 3 || !turnCard?.suit) return false;

  const suits = flop3.map((c) => c.suit);
  const counts = suits.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {});
  const hasTwoTone = Object.values(counts).some((v) => v === 2);

  return hasTwoTone && suits.includes(turnCard.suit);
}

function didHeroCompleteDraw(snapshotTurn) {
  // Si en turn ya tenemos una mano hecha grande, lo tratamos como "completamos"
  const made =
    snapshotTurn?.madeCategory || snapshotTurn?.madeCategory === ""
      ? snapshotTurn.madeCategory
      : snapshotTurn?.madeCategory;
  const m = snapshotTurn?.madeCategory || "none";
  return [
    "straight",
    "flush",
    "full_house",
    "quads",
    "straight_flush",
  ].includes(m);
}

function badgeTypeFromAction(a) {
  const A = String(a || "").toUpperCase();
  if (A.includes("FOLD")) return "fold";
  if (A.includes("CALL")) return "call";
  if (A.includes("RAISE") || A.includes("BET")) return "raise";
  return "check";
}
// --- OFFENSIVO SECO (TURN) helpers ---

const RANK_VAL = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function maxBoardRank(cards) {
  let m = 0;
  for (const c of cards || []) {
    const v = RANK_VAL[c?.rank] || 0;
    if (v > m) m = v;
  }
  return m;
}

function isTurnTextureDynamic(flop3, turnCard) {
  if (!flop3 || flop3.length !== 3 || !turnCard?.rank) return false;
  const turnVal = RANK_VAL[turnCard.rank] || 0;
  if (!turnVal) return false;

  const flopVals = flop3
    .map((c) => RANK_VAL[c?.rank] || 0)
    .filter(Boolean);

  for (let i = 0; i < flopVals.length; i++) {
    for (let j = i + 1; j < flopVals.length; j++) {
      const minVal = Math.min(turnVal, flopVals[i], flopVals[j]);
      const maxVal = Math.max(turnVal, flopVals[i], flopVals[j]);
      if (maxVal - minVal <= 4) return true;
    }
  }

  const suits = flop3.map((c) => c?.suit).filter(Boolean);
  const suitCounts = suits.reduce(
    (acc, s) => ((acc[s] = (acc[s] || 0) + 1), acc),
    {},
  );
  const maxSuit = Math.max(0, ...Object.values(suitCounts));
  return maxSuit <= 1 && suits.includes(turnCard.suit);
}

function heroHasTopPair(heroCards, boardCards) {
  // Top pair = el héroe tiene una pareja con la carta más alta del board
  const top = maxBoardRank(boardCards);
  if (!top) return false;
  const targetRanks = new Set(
    (boardCards || [])
      .filter((c) => (RANK_VAL[c?.rank] || 0) === top)
      .map((c) => c.rank),
  );
  const heroRanks = (heroCards || []).map((c) => c.rank);
  return heroRanks.some((r) => targetRanks.has(r));
}

function heroHasTopTwoPair(heroCards, boardCards) {
  const vals = (boardCards || [])
    .map((c) => RANK_VAL[c?.rank] || 0)
    .filter(Boolean)
    .sort((a, b) => b - a);
  const unique = [...new Set(vals)];
  const top = unique[0] || 0;
  const second = unique[1] || 0;
  if (!top || !second) return false;
  const topRank = Object.keys(RANK_VAL).find((k) => RANK_VAL[k] === top);
  const secondRank = Object.keys(RANK_VAL).find((k) => RANK_VAL[k] === second);
  if (!topRank || !secondRank) return false;
  const heroRanks = (heroCards || []).map((c) => c.rank);
  return heroRanks.includes(topRank) && heroRanks.includes(secondRank);
}

function isPocketOverpair(heroCards, boardCards) {
  // Overpair = pocket pair del héroe > carta más alta del board
  if (!heroCards || heroCards.length !== 2) return false;
  const r1 = heroCards[0]?.rank;
  const r2 = heroCards[1]?.rank;
  if (!r1 || !r2 || r1 !== r2) return false;
  const heroVal = RANK_VAL[r1] || 0;
  const top = maxBoardRank(boardCards);
  return heroVal > top;
}

function heroTopPairKickerValue(heroCards, boardCards) {
  if (!heroHasTopPair(heroCards, boardCards)) return 0;
  const top = maxBoardRank(boardCards);
  const heroVals = (heroCards || []).map((c) => RANK_VAL[c?.rank] || 0);
  const kickerVals = heroVals.filter((v) => v !== top);
  return Math.max(0, ...kickerVals);
}

function heroHasSecondPair(heroCards, boardCards) {
  const vals = (boardCards || [])
    .map((c) => RANK_VAL[c?.rank] || 0)
    .filter(Boolean)
    .sort((a, b) => b - a);
  const unique = [...new Set(vals)];
  const second = unique[1] || 0;
  if (!second) return false;
  const secondRank = Object.keys(RANK_VAL).find((k) => RANK_VAL[k] === second);
  if (!secondRank) return false;
  const heroRanks = (heroCards || []).map((c) => c.rank);
  return heroRanks.includes(secondRank);
}

function isUnderpair(heroCards, boardCards) {
  if (!heroCards || heroCards.length !== 2) return false;
  const r1 = heroCards[0]?.rank;
  const r2 = heroCards[1]?.rank;
  if (!r1 || !r2 || r1 !== r2) return false;
  const heroVal = RANK_VAL[r1] || 0;
  const top = maxBoardRank(boardCards);
  return heroVal > 0 && heroVal < top;
}

function isValidSemiBluff(snapshotTurn) {
  const flags = snapshotTurn?.flags || {};
  const outs = calcOutsFromSnapshot(snapshotTurn);
  return (
    outs >= 4 ||
    flags.hasGutshot ||
    flags.hasOESD ||
    flags.hasFlushDraw
  );
}

function classifyOffensiveDryTurnStrength(
  snapshotTurn,
  heroCards,
  boardCards,
) {
  const made = snapshotTurn?.madeCategory || "none";
  const flags = snapshotTurn?.flags || {};
  const hasTopPair = heroHasTopPair(heroCards, boardCards);
  const kickerVal = heroTopPairKickerValue(heroCards, boardCards);
  const hasRedraw =
    flags.hasFlushDraw || flags.hasGutshot || flags.hasOESD;

  if (
    [
      "straight",
      "flush",
      "full_house",
      "quads",
      "straight_flush",
      "trips",
    ].includes(made)
  )
    return "VERY_STRONG";
  if (made === "two_pair" && heroHasTopTwoPair(heroCards, boardCards))
    return "VERY_STRONG";

  if (made === "two_pair") return "STRONG";
  if (isPocketOverpair(heroCards, boardCards)) return "STRONG";
  if (hasTopPair && (kickerVal >= RANK_VAL.Q || hasRedraw)) return "STRONG";

  if (!hasTopPair && isValidSemiBluff(snapshotTurn)) return "SEMI_BLUFF";
  if (hasTopPair && hasRedraw) return "STRONG";
  if (hasTopPair) return "MEDIUM_SD";
  if (heroHasSecondPair(heroCards, boardCards)) return "MEDIUM_SD";
  if (isUnderpair(heroCards, boardCards)) return "MEDIUM_SD";
  if (isValidSemiBluff(snapshotTurn)) return "SEMI_BLUFF";

  return "AIR";
}

export function calcularTurnV2() {
  const pre = AppState.lastDecisionContext;
  const flopCtx = AppState.lastPostflopContext;

  if (!pre || pre.actionType === "fold" || pre.actionType === "check") return;
  if (!flopCtx?.flop || flopCtx.flop.length !== 3) return;

  const hero = getHeroCards();
  const { flop, turn } = getBoardCards();
  if (!turn?.rank || !turn?.suit) return;

  // BoardType viene del flop (ya clasificado)
  const boardType = flopCtx.flopCategory;

  // Snapshot en turn (hero + flop + turn)
  const snapshotTurn = buildHandSnapshot(hero, [...flop, turn]);

  const handTier = snapshotToHandTier(snapshotTurn);
  const outs = calcOutsFromSnapshot(snapshotTurn);

  const turnDynamic = computeTurnDynamic(hero, flopCtx.flop, turn);
  const boardCompletedDraw = didBoardCompleteFlush(flopCtx.flop, turn);
  const heroCompletedDraw = didHeroCompleteDraw(snapshotTurn);
  const blockers = blockersFromSnapshot(snapshotTurn);

  const engineCtx = {
    pos: flopCtx.pos || "IP",
    street: "TURN",
    boardType,
    handTier,
    outs,

    villainProfile: getVillainProfile(),

    // memoria del flop
    flopAction: flopCtx.flopAction || flopCtx?.flopAdvice?.action || null,
    flopSize: flopCtx.flopSize ?? flopCtx?.flopAdvice?.size ?? null,
    flopPlan: flopCtx.flopPlan || flopCtx?.flopAdvice?.plan || "NONE",
    xrOutcome:
      flopCtx.xrOutcome && flopCtx.xrOutcome !== "UNKNOWN"
        ? flopCtx.xrOutcome
        : ["XR", "XR_SEMI"].includes(flopCtx.flopPlan || "")
          ? "FAIL"
          : "UNKNOWN",

    turnDynamic,
    heroCompletedDraw,
    boardCompletedDraw,
    hasBlockersForBluff: blockers,
  };

  const act = pickPostflopActionV2(AppState.postflopRules, engineCtx);

  // ✅ OVERRIDE QUIRÚRGICO: SOLO OFENSIVO_SECO en TURN (según tu guía)
  if (engineCtx.boardType === "OFENSIVO_SECO") {
    const board4 = [...flop, turn];
    const isStatic = engineCtx.turnDynamic === "STATIC";
    const isDynamic =
      engineCtx.turnDynamic !== "STATIC" ||
      isTurnTextureDynamic(flopCtx.flop, turn);
    const strength = classifyOffensiveDryTurnStrength(
      snapshotTurn,
      hero,
      board4,
    );

    // Guía OFENSIVO SECO - TURN:
    // Estático: BET grande con fuerte/semifarol/aire; CHECK con manos medias (SD)
    if (isStatic && strength === "MEDIUM_SD") {
      act.action = "CHECK";
      act.size = null;
      act.plan = "SD_CONTROL";
      act.reason =
        "Ofensivo seco (turn estático): mano media / valor SD -> CHECK (guía).";
      act.ruleId = "OVERRIDE_ODRY_TURN_STATIC_MEDIUM_CHECK";
    }

    // Dinámico: BET grande con fuerte o semifarol 4+ outs; CHECK con manos medias, SD y aire
    if (isDynamic) {
      const allowBet =
        strength === "VERY_STRONG" ||
        strength === "STRONG" ||
        strength === "SEMI_BLUFF";

      if (allowBet) {
        act.action = "BET";
        act.size = 75;
        act.plan = "VALUE_OR_SEMI";
        act.reason =
          "Ofensivo seco (turn dinámico): valor o semifarol -> BET 75 (guía).";
        act.ruleId = "OVERRIDE_ODRY_TURN_DYNAMIC_BET";
      } else {
        act.action = "CHECK";
        act.size = null;
        act.plan = "SD_CONTROL";
        act.reason =
          "Ofensivo seco (turn dinámico): mano media/aire -> CHECK (guía).";
        act.ruleId = "OVERRIDE_ODRY_TURN_DYNAMIC_CHECK";
      }
    }
  }

  // DOM (legacy)
  const turnBoardText = document.getElementById("turnBoardText");
  const turnExplanation = document.getElementById("turnExplanation");
  const turnActionBadge = document.getElementById("turnActionBadge");

  const flopStr = flop.map((c) => c.rank + suitSymbol(c.suit)).join("  ");
  const turnStr = turn.rank + suitSymbol(turn.suit);

  if (turnBoardText)
    turnBoardText.textContent = `Board turn: ${flopStr}  ${turnStr}`;
  if (turnExplanation) turnExplanation.textContent = act.reason || "—";
  if (turnActionBadge) {
    const lbl = formatAction(act.action, act.size);
    const badgeType = badgeTypeFromAction(act.action);
    turnActionBadge.textContent = lbl;
    turnActionBadge.className = "badge badge-" + badgeType;
  }

  // ✅ Guardar contexto para UI unificada + river
  AppState.lastTurnContext = {
    flop,
    turn,
    boardType,
    pos: engineCtx.pos,
    handTier,
    outs,
    turnDynamic,
    heroCompletedDraw,
    boardCompletedDraw,
    xrOutcome: engineCtx.xrOutcome || "UNKNOWN",

    // advice
    action: act.action,
    size: act.size ?? null,
    plan: act.plan ?? "NONE",
    reason: act.reason ?? "—",
    ruleId: act.ruleId ?? null,

    // ✅ NUEVO: objeto advice para usar directo en UI
    turnAdvice: {
      id: act.ruleId ?? null,
      action: act.action,
      size: act.size ?? null,
      plan: act.plan ?? "NONE",
      reason: act.reason ?? "—",
    },
  };

  renderUnified();
  notifyStateChange();
}

export function initTurnV2() {
  const ids = ["turnRank", "turnSuit"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("change", () => calcularTurnV2());
  });
}
