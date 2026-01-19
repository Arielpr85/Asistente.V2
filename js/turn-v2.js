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

function computeTurnDynamic(pos, flop3, turnCard) {
  // JSON: "STATIC" | "AGGRESSOR" | "DEFENDER"
  if (!flop3 || flop3.length !== 3 || !turnCard?.rank) return "STATIC";

  const flopRanks = flop3.map((c) => c.rank);

  const isOvercard =
    ["A", "K", "Q"].includes(turnCard.rank) &&
    !flopRanks.includes(turnCard.rank);

  const isPairingBoard = flopRanks.includes(turnCard.rank);

  // Heurística simple y estable:
  // - Overcards grandes y pares suelen favorecer al agresor (más presión percibida).
  // - Si no, lo dejamos STATIC (neutral) para no inventar DEFENDER sin lógica sólida.
  if (isOvercard || isPairingBoard) return "AGGRESSOR";

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

function isBigOvercardTurn(flop3, turnCard) {
  if (!flop3 || flop3.length !== 3 || !turnCard?.rank) return false;
  const flopRanks = flop3.map((c) => c.rank);
  return (
    ["A", "K", "Q"].includes(turnCard.rank) &&
    !flopRanks.includes(turnCard.rank)
  );
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

function isStrongMade(snapshotTurn, heroCards, boardCards, flop3, turnCard) {
  const made = snapshotTurn?.madeCategory || "none";
  if (
    [
      "trips",
      "straight",
      "flush",
      "full_house",
      "quads",
      "straight_flush",
    ].includes(made)
  )
    return true;
  if (made === "two_pair") return true;
  if (isPocketOverpair(heroCards, boardCards)) return true;

  // Top pair SOLO lo subimos a "fuerte" si el turn fue overcard grande (tipo Test 2)
  if (
    made === "pair" &&
    heroHasTopPair(heroCards, boardCards) &&
    isBigOvercardTurn(flop3, turnCard)
  ) {
    return true;
  }

  return false;
}

function isMediumShowdown(
  snapshotTurn,
  heroCards,
  boardCards,
  flop3,
  turnCard,
) {
  const made = snapshotTurn?.madeCategory || "none";

  // “Mano media / SD” en ofensivo seco: top pair normal (no overcard grande), pares, etc.
  if (made === "pair") {
    if (
      heroHasTopPair(heroCards, boardCards) &&
      !isBigOvercardTurn(flop3, turnCard)
    )
      return true;
    return true; // otros pares = SD en general
  }

  return false;
}

function isAir(snapshotTurn) {
  const made = snapshotTurn?.madeCategory || "none";
  return made === "high_card" || snapshotToHandTier(snapshotTurn) === "AIRE";
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

  const turnDynamic = computeTurnDynamic(
    flopCtx.pos || "IP",
    flopCtx.flop,
    turn,
  );
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

    turnDynamic,
    heroCompletedDraw,
    boardCompletedDraw,
    hasBlockersForBluff: blockers,
  };

  const act = pickPostflopActionV2(AppState.postflopRules, engineCtx);

  // ✅ OVERRIDE QUIRÚRGICO: SOLO OFENSIVO_SECO en TURN (según tu guía)
  if (engineCtx.boardType === "OFENSIVO_SECO") {
    const board4 = [...flop, turn];
    const strong = isStrongMade(snapshotTurn, hero, board4, flopCtx.flop, turn);
    const medium = isMediumShowdown(
      snapshotTurn,
      hero,
      board4,
      flopCtx.flop,
      turn,
    );
    const air = isAir(snapshotTurn);
    const semi = engineCtx.outs >= 4; // guía: semifarol 4+ outs

    const isStatic = engineCtx.turnDynamic === "STATIC";
    const isDynamic = engineCtx.turnDynamic !== "STATIC"; // AGGRESSOR (en tu modelo actual)

    // Guía OFENSIVO SECO - TURN:
    // Estático: BET grande con fuerte/semifarol/aire; CHECK con manos medias (SD)
    if (isStatic && medium) {
      act.action = "CHECK";
      act.size = null;
      act.plan = "SD_CONTROL";
      act.reason =
        "Ofensivo seco (turn estático): mano media / valor SD -> CHECK (guía).";
      act.ruleId = "OVERRIDE_ODRY_TURN_STATIC_MEDIUM_CHECK";
    }

    // Dinámico: BET grande con fuerte o semifarol 4+ outs; CHECK con manos medias, SD y aire
    if (isDynamic) {
      const made = snapshotTurn?.madeCategory || "none";
      const isPair = made === "pair";
      const isHigh = made === "high_card";

      // Dinámico (guía): CHECK con mano media y con aire.
      // Permitimos BET grande solo si: strong (valor real) o semi (outs>=4).
      if ((isPair || isHigh) && !strong && !semi) {
        act.action = "CHECK";
        act.size = null;
        act.plan = "SD_CONTROL";
        act.reason =
          "Ofensivo seco (turn dinámico): mano media/aire -> CHECK (guía).";
        act.ruleId = "OVERRIDE_ODRY_TURN_DYNAMIC_PAIR_HIGH_CHECK";
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
