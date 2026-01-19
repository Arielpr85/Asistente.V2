// js/cards-dom.js

// ---------------------------
// Helpers básicos de lectura del DOM
// ---------------------------
export function getCard(rankId, suitId) {
  const r = document.getElementById(rankId)?.value || "";
  const s = document.getElementById(suitId)?.value || "";
  if (!r || !s) return null;
  return { rank: r, suit: s };
}

// ---------------------------
// HERO
// ---------------------------
export function getHeroCards() {
  const c1 = getCard("card1Rank", "card1Suit");
  const c2 = getCard("card2Rank", "card2Suit");

  // siempre devuelve array (0, 1 o 2 cartas)
  return [c1, c2].filter(Boolean);
}

// ---------------------------
// BOARD (estructurado para postflop V2)
// ---------------------------
export function getBoardCards() {
  const flop1 = getCard("flop1Rank", "flop1Suit");
  const flop2 = getCard("flop2Rank", "flop2Suit");
  const flop3 = getCard("flop3Rank", "flop3Suit");
  const turn = getCard("turnRank", "turnSuit");
  const river = getCard("riverRank", "riverSuit");

  return {
    // siempre array (0 a 3)
    flop: [flop1, flop2, flop3].filter(Boolean),

    // null o carta
    turn: turn || null,
    river: river || null,
  };
}

// ---------------------------
// Helpers opcionales (NO rompen nada)
// Útiles para el engine postflop
// ---------------------------
export function hasCompleteFlop(board) {
  return Array.isArray(board?.flop) && board.flop.length === 3;
}

export function hasTurn(board) {
  return !!board?.turn;
}

export function hasRiver(board) {
  return !!board?.river;
}

