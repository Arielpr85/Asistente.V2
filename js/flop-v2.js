// js/flop-v2.js
import { AppState, POS_ORDER, rankIndexAsc, notifyStateChange } from "./state-v2.js";
import { renderUnified } from "./ui-v2.js";
import { getHeroCards, getBoardCards } from "./cards-dom.js";
import { buildHandSnapshot } from "./hand-snapshot.js";
import { pickPostflopActionV2, formatAction } from "./postflop-engine-v2.js";

/* ========= FLOP: boardType alineado al JSON ========= */

function classifyFlopToBoardType(flop) {
  const ranks = flop.map((c) => c.rank);
  const suits = flop.map((c) => c.suit);

  const uniqueRanks = new Set(ranks);
  const uniqueSuits = new Set(suits);

  const isPaired = uniqueRanks.size < 3;
  const isMonotone = uniqueSuits.size === 1;
  const isTwoTone = uniqueSuits.size === 2;

  const sorted = [...ranks].sort((a, b) => rankIndexAsc(a) - rankIndexAsc(b));
  const low = sorted[0];
  const high = sorted[2];
  const gap = rankIndexAsc(high) - rankIndexAsc(low);
  const isConnected = gap <= 4;

  const hasA = ranks.includes("A");
  const hasK = ranks.includes("K");
  const hasQ = ranks.includes("Q");
  const hasJ = ranks.includes("J");
  const hasT = ranks.includes("T");

  if (isMonotone) return "MONOCOLOR";

  if (isPaired) {
    const counts = ranks.reduce((m, r) => ((m[r] = (m[r] || 0) + 1), m), {});
    const pairRank = Object.keys(counts).find((r) => counts[r] >= 2) || sorted[1];

    if (["A", "K", "Q", "J", "T"].includes(pairRank)) return "PAREADO_OFENSIVO";
    if (["2", "3", "4", "5", "6", "7", "8"].includes(pairRank)) return "PAREADO_DEFENSIVO";
    return "PAREADO_NEUTRO";
  }

  const isCoord = isConnected || isTwoTone;

  if (isCoord) {
    if (hasA || hasK) return "OFENSIVO_COORD";
    if (hasQ || hasJ) return "NEUTRO_COORD";

    const valsDesc = [...ranks].map(rankIndexAsc).sort((a, b) => b - a);
    const hi = valsDesc[0],
      mid = valsDesc[1];

    if (hi >= 10 && mid >= 8) return "OFENSIVO_COORD";
    return "DEFENSIVO_COORD";
  }

  if (hasA || hasK || hasQ) return "OFENSIVO_SECO";
  if (hasJ || hasT) return "NEUTRO_SECO";
  return "DEFENSIVO_SECO";
}

/* ========= Snapshot (nuevo) -> handTier/outs/blockers ========= */

function snapshotToHandTier(snapshot) {
  // ✅ ahora buildHandSnapshot ya devuelve handTier listo
  const ht = snapshot?.handTier;
  if (ht === "MUY_FUERTE" || ht === "FUERTE" || ht === "MEDIA" || ht === "AIRE") return ht;
  return "AIRE";
}

function calcOutsFromSnapshot(snapshot) {
  // ✅ ahora buildHandSnapshot ya devuelve outs
  const o = Number(snapshot?.outs);
  return Number.isFinite(o) ? o : 0;
}

function blockersFromSnapshot(snapshot) {
  return !!snapshot?.hasBlockersForBluff;
}

/* ========= Posición postflop (IP/OOP) ========= */

function computePostflopPos(ctx) {
  const hero = ctx?.heroPos || "";
  const vill = ctx?.villainPos || "";

  const heroIndex = POS_ORDER.indexOf(hero);
  const villIndex = POS_ORDER.indexOf(vill);

  // Si tenemos villain (vsOpen / vs3bet), calculamos real
  if (vill && heroIndex >= 0 && villIndex >= 0) {
    return heroIndex > villIndex ? "IP" : "OOP";
  }

  // Heurística cuando no sabemos quién pagó (first in / overlimp):
  if (hero === "SB") return "OOP";
  return "IP";
}

/* ========= UI helpers ========= */

function badgeTypeFromAction(a) {
  const A = String(a || "").toUpperCase();
  if (A.includes("FOLD")) return "fold";
  if (A.includes("CALL")) return "call";
  if (A.includes("RAISE") || A.includes("BET")) return "raise";
  return "check";
}

function getVillainProfile() {
  // ✅ opcional: si existe en HTML
  const sel = document.getElementById("villainProfile");
  const v = String(sel?.value || "DEFAULT").toUpperCase().trim();
  if (v === "BAD" || v === "GOOD") return v;
  return "DEFAULT";
}

/* ========= MAIN ========= */

export function calcularPostflopV2() {
  const ctx = AppState.lastDecisionContext;

  if (!ctx || ctx.actionType === "fold" || ctx.actionType === "check") {
    AppState.lastPostflopContext = null;
    renderUnified();
    notifyStateChange();
    return;
  }

  const hero = getHeroCards();
  const { flop } = getBoardCards();

  if (!flop || flop.length !== 3) {
    AppState.lastPostflopContext = null;
    renderUnified();
    notifyStateChange();
    return;
  }

  const snapshot = buildHandSnapshot(hero, flop);
  const boardType = classifyFlopToBoardType(flop);

  const handTier = snapshotToHandTier(snapshot);
  const outs = calcOutsFromSnapshot(snapshot);
  const pos = computePostflopPos(ctx);

  // ✅ JSON v2: turnDynamic usa STATIC/AGGRESSOR/DEFENDER (en flop ponemos STATIC)
  const engineCtx = {
    pos, // "IP" | "OOP"
    street: "FLOP",
    boardType,
    handTier,
    outs,

    // nuevos inputs del json (si no se usan en flop, igual no molesta)
    villainProfile: getVillainProfile(),

    // “memoria” (en flop todavía no hay)
    flopAction: null,
    flopSize: null,
    flopPlan: null,
    xrOutcome: "UNKNOWN",

    heroCompletedDraw: false,
    boardCompletedDraw: false,
    turnDynamic: "STATIC",
    hasBlockersForBluff: blockersFromSnapshot(snapshot),
  };

  const act = pickPostflopActionV2(AppState.postflopRules, engineCtx);

  const actionLabel = formatAction(act.action, act.size);
  const badgeType = badgeTypeFromAction(act.action);

  // DOM legacy (si lo tenés)
  const postflopExplanation = document.getElementById("postflopExplanation");
  const postflopActionBadge = document.getElementById("postflopActionBadge");

  if (postflopExplanation) postflopExplanation.textContent = act.reason || "—";
  if (postflopActionBadge) {
    postflopActionBadge.textContent = actionLabel;
    postflopActionBadge.className = "badge badge-" + badgeType;
  }

  // ✅ Guardamos contexto para TURN/RIVER + UI unificada
  AppState.lastPostflopContext = {
    flop,
    flopCategory: boardType,
    flopBadgeType: badgeType,

    pos,
    handTier,
    outs,

    // línea elegida (compat viejo)
    flopAction: act.action,
    flopSize: act.size ?? null,
    flopPlan: act.plan ?? "NONE",
    xrOutcome: "UNKNOWN",

    // ✅ NUEVO: lo que ui-v2.js busca (flopAdvice)
    flopAdvice: {
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

export function initFlopV2() {
  const ids = ["flop1Rank", "flop1Suit", "flop2Rank", "flop2Suit", "flop3Rank", "flop3Suit"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("change", () => calcularPostflopV2());
  });
}

