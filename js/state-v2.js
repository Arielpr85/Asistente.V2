// js/state-v2.js
export const RANGES_STORAGE_KEY = "preflopRangesNL5_V2";
export const RANGES_JSON_URL = "ranges-nl5-9max.v2.json";

// ✅ Asegurate de que tu nuevo JSON se llame así (o cambiá el nombre acá)
export const POSTFLOP_JSON_URL = "postflop-strategy.json";

export const RANK_ORDER = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
export const RANK_ORDER_ASC = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
export const POS_ORDER = ["UTG", "UTG1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

export const AppState = {
  rangesData: null,
  postflopData: null,

  // ✅ si tu loader guarda "rulesets" directo o el json completo
  postflopRules: null,

  POSITIONS: [],
  lastDecisionContext: null,

  // ✅ Este contexto ahora debería guardar advice por calle:
  // lastPostflopContext.flopAdvice / turnAdvice / riverAdvice
  lastPostflopContext: null,

  lastTurnContext: null
};

export function ensureEmptyOption(select, label = "-") {
  if (!select) return;
  const hasEmpty = Array.from(select.options || []).some((o) => o.value === "");
  if (hasEmpty) return;
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = label;
  select.insertBefore(opt, select.firstChild || null);
}

export function rankIndexAsc(rank) {
  return RANK_ORDER_ASC.indexOf(rank);
}
export function rankIndexDesc(rank) {
  return RANK_ORDER.indexOf(rank);
}

export function normalizarMano(r1, r2, isSuited) {
  if (r1 === r2) return r1 + r2;

  const i1 = RANK_ORDER.indexOf(r1);
  const i2 = RANK_ORDER.indexOf(r2);

  let high = r1;
  let low = r2;
  if (i2 < i1) {
    high = r2;
    low = r1;
  }
  return high + low + (isSuited ? "s" : "o");
}

export function suitSymbol(s) {
  if (s === "s") return "♠";
  if (s === "h") return "♥";
  if (s === "d") return "♦";
  if (s === "c") return "♣";
  return "?";
}

// ========= ✅ Helpers nuevos para el JSON v2 (postflop) =========

// villanProfile en el JSON usa: DEFAULT | BAD | GOOD
export function normalizeVillainProfile(v) {
  const x = String(v || "").toUpperCase().trim();
  if (x === "BAD") return "BAD";
  if (x === "GOOD") return "GOOD";
  return "DEFAULT";
}

// flopAction: BET | CHECK
export function normalizeFlopAction(v) {
  const x = String(v || "").toUpperCase().trim();
  if (x === "BET") return "BET";
  if (x === "CHECK") return "CHECK";
  return "";
}

// turnDynamic: STATIC | AGGRESSOR | DEFENDER
export function normalizeTurnDynamic(v) {
  const x = String(v || "").toUpperCase().trim();
  if (x === "STATIC") return "STATIC";
  if (x === "AGGRESSOR") return "AGGRESSOR";
  if (x === "DEFENDER") return "DEFENDER";
  return "";
}

// xrOutcome: UNKNOWN | SUCCESS | FAIL
export function normalizeXrOutcome(v) {
  const x = String(v || "").toUpperCase().trim();
  if (x === "SUCCESS") return "SUCCESS";
  if (x === "FAIL") return "FAIL";
  return "UNKNOWN";
}

// ========= State change helpers (para módulos como river/turn/flop) =========
const _listeners = new Set();

export function getState() {
  return AppState;
}

export function onStateChange(fn) {
  if (typeof fn !== "function") return () => {};
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function notifyStateChange() {
  _listeners.forEach((fn) => {
    try {
      fn(AppState);
    } catch {}
  });
}

// state-v2.js (al final)
window.AppState = AppState;

