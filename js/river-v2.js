// js/river-v2.js
import { AppState, suitSymbol, notifyStateChange } from "./state-v2.js";
import { renderUnified } from "./ui-v2.js";
import { getHeroCards, getBoardCards } from "./cards-dom.js";
import { buildHandSnapshot } from "./hand-snapshot.js";
import { pickPostflopActionV2, formatAction } from "./postflop-engine-v2.js";

/**
 * ✅ River v2 alineado al JSON postflop-srp-initiative-v2:
 * - handTier viene directo de buildHandSnapshot()
 * - turnDynamic enum correcto: STATIC|AGGRESSOR|DEFENDER
 * - villainProfile incluido
 * - hasBlockersForBluff viene del snapshot (heurístico consistente)
 * - guarda riverAdvice y lo pinta en los IDs legacy que ya tenés
 */

function snapshotToHandTier(snapshot) {
  const ht = snapshot?.handTier;
  if (ht === "MUY_FUERTE" || ht === "FUERTE" || ht === "MEDIA" || ht === "AIRE") return ht;
  return "AIRE";
}

function blockersFromSnapshot(snapshot) {
  return !!snapshot?.hasBlockersForBluff;
}

function getVillainProfile() {
  const sel = document.getElementById("villainProfile");
  const v = String(sel?.value || "DEFAULT").toUpperCase().trim();
  if (v === "BAD" || v === "GOOD") return v;
  return "DEFAULT";
}

function badgeTypeFromAction(a) {
  const A = String(a || "").toUpperCase();
  if (A.includes("FOLD")) return "fold";
  if (A.includes("CALL")) return "call";
  if (A.includes("RAISE") || A.includes("BET")) return "raise";
  return "check";
}

export function calcularRiverV2() {
  const flopCtx = AppState.lastPostflopContext;
  const turnCtx = AppState.lastTurnContext;

  if (!flopCtx?.flop || flopCtx.flop.length !== 3) return;
  if (!turnCtx?.turn) return;

  const hero = getHeroCards();
  const { flop, turn, river } = getBoardCards();
  if (!river?.rank || !river?.suit) return;

  const boardType = flopCtx.flopCategory;

  const snapshotRiver = buildHandSnapshot(hero, [...flop, turn, river]);
  const handTier = snapshotToHandTier(snapshotRiver);

  const ctx = {
    pos: flopCtx.pos || "IP",
    street: "RIVER",
    boardType,
    handTier,
    outs: 0, // en river no usamos outs

    villainProfile: getVillainProfile(),

    // memoria del flop
    flopAction: flopCtx.flopAction || flopCtx?.flopAdvice?.action || null,
    flopSize: flopCtx.flopSize ?? flopCtx?.flopAdvice?.size ?? null,
    flopPlan: flopCtx.flopPlan || flopCtx?.flopAdvice?.plan || "NONE",
    xrOutcome:
      turnCtx.xrOutcome && turnCtx.xrOutcome !== "UNKNOWN"
        ? turnCtx.xrOutcome
        : flopCtx.xrOutcome || "UNKNOWN",

    // memoria del turn (en JSON se usa en turn, pero lo dejamos por consistencia)
    turnDynamic: turnCtx.turnDynamic || "STATIC",
    heroCompletedDraw: !!turnCtx.heroCompletedDraw,
    boardCompletedDraw: !!turnCtx.boardCompletedDraw,

    hasBlockersForBluff: blockersFromSnapshot(snapshotRiver),
  };

  const act = pickPostflopActionV2(AppState.postflopRules, ctx);

  // Legacy DOM (lo que vos ya tenías en UI vieja/unificada)
  const rl = document.getElementById("u_river_line");
  const rc = document.getElementById("u_river_context");
  const ra = document.getElementById("u_river_action");

  const flopStr = flop.map((c) => c.rank + suitSymbol(c.suit)).join(" ");
  const turnStr = turn.rank + suitSymbol(turn.suit);
  const riverStr = river.rank + suitSymbol(river.suit);

  if (rl) {
    rl.textContent = `Board river: ${flopStr} ${turnStr} ${riverStr} · HERO: ${snapshotRiver?.label || "—"}`;
  }
  if (rc) rc.textContent = act.reason || "—";
  if (ra) {
    const lbl = formatAction(act.action, act.size);
    const badgeType = badgeTypeFromAction(act.action);
    ra.textContent = lbl;
    ra.className = "badge badge-" + badgeType + " mt-2";
  }

  // ✅ Guardar riverAdvice (por si después querés mostrarlo en otra parte)
  AppState.lastRiverContext = {
    flop,
    turn,
    river,
    boardType,
    pos: ctx.pos,
    handTier,
    xrOutcome: ctx.xrOutcome || "UNKNOWN",

    action: act.action,
    size: act.size ?? null,
    plan: act.plan ?? "NONE",
    reason: act.reason ?? "—",
    ruleId: act.ruleId ?? null,

    riverAdvice: {
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

export function initRiverV2() {
  const ids = ["riverRank", "riverSuit"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("change", () => calcularRiverV2());
  });
}
