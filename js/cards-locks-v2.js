// js/cards-locks-v2.js  (V2)
import { AppState } from "./state-v2.js";
import { renderUnified } from "./ui-v2.js";

const CARD_SLOTS = [
  { name: "card1", rankId: "card1Rank", suitId: "card1Suit" },
  { name: "card2", rankId: "card2Rank", suitId: "card2Suit" },
  { name: "flop1", rankId: "flop1Rank", suitId: "flop1Suit" },
  { name: "flop2", rankId: "flop2Rank", suitId: "flop2Suit" },
  { name: "flop3", rankId: "flop3Rank", suitId: "flop3Suit" },
  { name: "turn", rankId: "turnRank", suitId: "turnSuit" },
  { name: "river", rankId: "riverRank", suitId: "riverSuit" },
];

// ✅ NUEVO: además limpiamos el perfil del rival si existe
const OPTIONAL_RESET_IDS = ["villainProfile"];

function getSlotValue(slot) {
  const r = document.getElementById(slot.rankId)?.value || "";
  const s = document.getElementById(slot.suitId)?.value || "";
  return { rank: r, suit: s, key: r && s ? `${r}${s}` : "" };
}

function getUsedCardKeys(excludeSlotName) {
  const used = new Set();
  CARD_SLOTS.forEach((slot) => {
    if (slot.name === excludeSlotName) return;
    const v = getSlotValue(slot);
    if (v.key) used.add(v.key);
  });
  return used;
}

export function updateCardOptionLocks() {
  CARD_SLOTS.forEach((slot) => {
    const rankSel = document.getElementById(slot.rankId);
    const suitSel = document.getElementById(slot.suitId);
    if (!rankSel || !suitSel) return;

    const current = getSlotValue(slot);
    const used = getUsedCardKeys(slot.name);

    const slotSuit = suitSel.value || "";
    Array.from(rankSel.options).forEach((opt) => {
      const r = opt.value || "";
      if (!r) return;
      if (!slotSuit) {
        opt.disabled = false;
        return;
      }
      const k = `${r}${slotSuit}`;
      opt.disabled = used.has(k) && k !== current.key;
    });

    const slotRank = rankSel.value || "";
    Array.from(suitSel.options).forEach((opt) => {
      const s = opt.value || "";
      if (!s) return;
      if (!slotRank) {
        opt.disabled = false;
        return;
      }
      const k = `${slotRank}${s}`;
      opt.disabled = used.has(k) && k !== current.key;
    });
  });
}

export function limpiarTodasLasCartas() {
  const ids = [
    "card1Rank","card1Suit","card2Rank","card2Suit",
    "flop1Rank","flop1Suit","flop2Rank","flop2Suit","flop3Rank","flop3Suit",
    "turnRank","turnSuit","riverRank","riverSuit",
  ];

  // ✅ reset scenario
  const scenario = document.getElementById("scenario");
  if (scenario) {
    scenario.value = "nadie_abrió";
    scenario.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ✅ limpiar selects de cartas
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // ✅ reset extras opcionales (no rompe si no existen)
  OPTIONAL_RESET_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    // villainProfile: default DEFAULT (requerido por el JSON nuevo)
    if (id === "villainProfile") el.value = "DEFAULT";
    else el.value = "";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // ✅ limpiar estado app
  AppState.lastDecisionContext = null;
  AppState.lastPostflopContext = null;
  AppState.lastTurnContext = null;

  // si en algún lado viejo quedó global
  window.lastTurnContext = null;

  updateCardOptionLocks();
  renderUnified();

  // ✅ avisar a table-ui / módulos
  document.dispatchEvent(new CustomEvent("cards:cleared"));
}

document.addEventListener("change", (e) => {
  const id = e?.target?.id || "";
  const watched = new Set([
    "card1Rank","card1Suit","card2Rank","card2Suit",
    "flop1Rank","flop1Suit","flop2Rank","flop2Suit","flop3Rank","flop3Suit",
    "turnRank","turnSuit","riverRank","riverSuit",
  ]);
  if (watched.has(id)) updateCardOptionLocks();
});
