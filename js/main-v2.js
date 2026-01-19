// js/main-v2.js
import {
  AppState,
  RANGES_STORAGE_KEY,
  RANGES_JSON_URL,
  ensureEmptyOption,
} from "./state-v2.js";
import {
  poblarSelectsPosiciones,
  poblarSelectsDeCartas,
  poblarSelectsFlop,
  poblarSelectTurn,
  poblarSelectRiver,
  renderUnified,
} from "./ui-v2.js";
import {
  updateCardOptionLocks,
  limpiarTodasLasCartas,
} from "./cards-locks-v2.js";
import { calcularAccionV2 as calcularAccion } from "./preflop-v2.js";
window.calcularAccionV2 = calcularAccion;
import { initFlopV2, calcularPostflopV2 } from "./flop-v2.js";
import { initTurnV2, calcularTurnV2 } from "./turn-v2.js";
import { initRiverV2, calcularRiverV2 } from "./river-v2.js";
import { loadPostflopRulesV2 } from "./postflop-engine-v2.js";
import "./postflop-tests-v2.js";

async function cargarJSONPreflop() {
  const stored = localStorage.getItem(RANGES_STORAGE_KEY);
  if (stored) {
    try {
      AppState.rangesData = JSON.parse(stored);
    } catch {}
  }
  if (!AppState.rangesData) {
    const res = await fetch(RANGES_JSON_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    AppState.rangesData = await res.json();
  }
  AppState.rangesData.positions ||= {};
  AppState.POSITIONS = Object.keys(AppState.rangesData.positions);
  if (!AppState.POSITIONS.length) {
    AppState.POSITIONS = ["UTG", "UTG1", "MP", "HJ", "CO", "BTN", "SB", "BB"];
  }
}

async function cargarJSONPostflopV2() {
  // ✅ Tu JSON nuevo (el que te pegué) debería estar en la raíz del proyecto:
  // /postflop-srp-initiative-v2.json
  //
  // Si lo guardaste con otro nombre (ej postflop-strategy.json),
  // cambiá el path acá.
  AppState.postflopRules = await loadPostflopRulesV2(
    "../postflop-srp-initiative-v2.json"
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarJSONPreflop();

  // ✅ Cargamos reglas postflop V2 una sola vez
  try {
    await cargarJSONPostflopV2();
  } catch (e) {
    console.error("[main-v2] Error cargando JSON postflop V2:", e);
    AppState.postflopRules = null;
  }

  poblarSelectsPosiciones(AppState.POSITIONS);
  poblarSelectsDeCartas();
  poblarSelectsFlop();
  poblarSelectTurn();
  poblarSelectRiver();

  // ✅ Asegurar placeholders en suits (y limpiar valores)
  [
    "card1Suit",
    "card2Suit",
    "flop1Suit",
    "flop2Suit",
    "flop3Suit",
    "turnSuit",
    "riverSuit",
  ].forEach((id) => {
    const sel = document.getElementById(id);
    ensureEmptyOption(sel, "-");
    if (sel) sel.value = "";
  });

  // ✅ NUEVO: asegurar un selector de perfil del rival (si existe en HTML)
  // Valores esperados por el JSON: DEFAULT | BAD | GOOD
  const villainProfile = document.getElementById("villainProfile");
  if (villainProfile) {
    ensureEmptyOption(villainProfile, "DEFAULT");
    // si está vacío, default
    if (!villainProfile.value) villainProfile.value = "DEFAULT";
  }

  document.getElementById("btnCalculate")?.addEventListener("click", () => {
    // 1) Preflop (setea lastDecisionContext)
    calcularAccion();

    // 2) Postflop (si ya están cargadas cartas)
    calcularPostflopV2();
    calcularTurnV2();
    calcularRiverV2?.(); // si el módulo river ya expone calcularRiverV2 (si no existe, no rompe)
  });

  const btnClearCards =
    document.getElementById("btnClearCards") ||
    document.getElementById("btnClear") ||
    document.querySelector(".btn-clear-cards") ||
    document.querySelector("[data-clear-cards]");

  btnClearCards?.addEventListener("click", (e) => {
    e.preventDefault();
    limpiarTodasLasCartas();
  });

  // ✅ Auto-recalc por cambios (flop/turn/river)
  initFlopV2();
  initTurnV2();
  initRiverV2();

  // ✅ NUEVO: cuando el grid (table-ui) dispare board:changed, recalculamos lo que corresponda
  document.addEventListener("board:changed", () => {
    // Recalculo seguro y barato (cada módulo decide si tiene datos suficientes)
    try {
      calcularPostflopV2();
    } catch {}
    try {
      calcularTurnV2();
    } catch {}
    try {
      calcularRiverV2?.();
    } catch {}
  });

  updateCardOptionLocks();
  renderUnified();

  // DEBUG (temporal)
  window.AppState = AppState;
});
