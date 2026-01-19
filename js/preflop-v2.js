// js/preflop-v2.js
// js/preflop-v2.js
import { AppState, normalizarMano } from "./state-v2.js";
import { renderUnified } from "./ui-v2.js";
import { calcularPostflopV2 } from "./flop-v2.js";
import { calcularTurnV2 } from "./turn-v2.js";

// ... el resto igual


const EMPTY = { call: [], threeBet: [], fourBet: [] };

function resolveVs(spotObj, villainPos) {
  if (!spotObj) return EMPTY;
  const key = "vs" + (villainPos || "");
  const slot = spotObj[key] ?? spotObj.default ?? EMPTY;

  return {
    call: Array.isArray(slot.call) ? slot.call : [],
    threeBet: Array.isArray(slot.threeBet) ? slot.threeBet : [],
    fourBet: Array.isArray(slot.fourBet) ? slot.fourBet : [],
  };
}

export function obtenerAccionDesdeJsonV2(heroPos, escenario, villainPos, hand) {
  const heroNode = AppState.rangesData?.positions?.[heroPos];
  if (!heroNode) {
    return {
      mainActionLabel: "Fold",
      actionType: "fold",
      explanation: "No hay datos para esa posición.",
    };
  }

  // FIRST IN
  if (escenario === "nadie_abrió") {
    const fi = heroNode.firstIn || {};
    if ((fi.openRaise || []).includes(hand)) {
      return {
        mainActionLabel: "Open Raise",
        actionType: "raise",
        explanation: "First In: Open Raise.",
      };
    }
    if ((fi.openLimp || []).includes(hand)) {
      return {
        mainActionLabel: "Open Limp",
        actionType: "call",
        explanation: "First In: Limp.",
      };
    }
    return {
      mainActionLabel: "Fold",
      actionType: "fold",
      explanation: "First In: fuera de rango.",
    };
  }

  // OVERLIMP / ISO
  if (escenario === "overlimp") {
    const ol = heroNode.overLimp || {};
    if ((ol.isoRaise || []).includes(hand)) {
      return {
        mainActionLabel: "IsoRaise",
        actionType: "raise",
        explanation: "Overlimp: IsoRaise.",
      };
    }
    if ((ol.overLimp || []).includes(hand)) {
      return {
        mainActionLabel: "Overlimp",
        actionType: "call",
        explanation: "Overlimp: Overlimp.",
      };
    }
    return {
      mainActionLabel: "Fold",
      actionType: "fold",
      explanation: "Overlimp: fuera de rango.",
    };
  }

  // VS OPEN
  if (escenario === "vsOpen") {
    const slot = resolveVs(heroNode.vsOpen, villainPos);
    if (slot.threeBet.includes(hand)) {
      return {
        mainActionLabel: "3bet vs OR",
        actionType: "raise",
        explanation: `Vs OR ${villainPos}: 3bet.`,
      };
    }
    if (slot.call.includes(hand)) {
      return {
        mainActionLabel: "Call vs OR",
        actionType: "call",
        explanation: `Vs OR ${villainPos}: call.`,
      };
    }
    return {
      mainActionLabel: "Fold",
      actionType: "fold",
      explanation: `Vs OR ${villainPos}: fuera de rango.`,
    };
  }

  // VS 3BET
  if (escenario === "vs3bet") {
    const slot = resolveVs(heroNode.vs3bet, villainPos);
    if (slot.fourBet.includes(hand)) {
      return {
        mainActionLabel: "4bet vs 3bet",
        actionType: "raise",
        explanation: `Vs 3bet ${villainPos}: 4bet.`,
      };
    }
    if (slot.call.includes(hand)) {
      return {
        mainActionLabel: "Call vs 3bet",
        actionType: "call",
        explanation: `Vs 3bet ${villainPos}: call.`,
      };
    }
    return {
      mainActionLabel: "Fold",
      actionType: "fold",
      explanation: `Vs 3bet ${villainPos}: fuera de rango.`,
    };
  }

  return {
    mainActionLabel: "Fold",
    actionType: "fold",
    explanation: "Escenario no soportado.",
  };
}

export function calcularAccionV2() {
  if (!AppState.rangesData) return;

  const heroPos = document.getElementById("heroPosition")?.value || "";
  const escenario = document.getElementById("scenario")?.value || "nadie_abrió";
  const villainPos = document.getElementById("villainPosition")?.value || "";

  if (!heroPos) {
    AppState.lastDecisionContext = {
      heroPos: "",
      escenario,
      villainPos: "",
      hand: "—",
      actionType: "check",
      mainActionLabel: "—",
      explanation: "Seleccioná tu posición (HERO).",
      heroDetail: null,
    };
    renderUnified();
    return;
  }

  const needsVillain = escenario === "vsOpen" || escenario === "vs3bet";
  if (needsVillain && !villainPos) {
    AppState.lastDecisionContext = {
      heroPos,
      escenario,
      villainPos: "",
      hand: "—",
      actionType: "check",
      mainActionLabel: "—",
      explanation: "Seleccioná la posición del VILLANO.",
      heroDetail: null,
    };
    renderUnified();
    return;
  }

  const c1Rank = document.getElementById("card1Rank")?.value || "";
  const c2Rank = document.getElementById("card2Rank")?.value || "";
  const c1Suit = document.getElementById("card1Suit")?.value || "";
  const c2Suit = document.getElementById("card2Suit")?.value || "";

  if (!c1Rank || !c2Rank || !c1Suit || !c2Suit) {
    AppState.lastDecisionContext = {
      heroPos,
      escenario,
      villainPos,
      hand: "—",
      actionType: "check",
      mainActionLabel: "—",
      explanation: "Seleccioná las 2 cartas del HERO (rango y palo).",
      heroDetail: null,
    };
    renderUnified();
    return;
  }

  const suitedFlag = c1Suit === c2Suit;
  const hand = normalizarMano(c1Rank, c2Rank, suitedFlag);

  const res = obtenerAccionDesdeJsonV2(heroPos, escenario, villainPos, hand);

  AppState.lastDecisionContext = {
    heroPos,
    escenario,
    villainPos,
    hand,
    actionType: res.actionType,
    mainActionLabel: res.mainActionLabel,
    explanation: res.explanation,
    heroDetail: { ranks: [c1Rank, c2Rank], suits: [c1Suit, c2Suit], suited: suitedFlag },
  };

  // En V2 por ahora NO llamamos flop/turn hasta migrarlos también,
  // así evitamos mezclar mundos.
  AppState.lastPostflopContext = null;
  AppState.lastTurnContext = null;

  renderUnified();
}

window.calcularAccionV2 = calcularAccionV2;
