// // js/postflop-fuzz-ui-flow-v2.js
// // Fuzz REALISTA: respeta el flujo PRE -> FLOP -> TURN -> RIVER usando la UI real (tabs).
// // Requiere que tu app ya esté cargada (main-v2.js) y que existan los IDs del HTML que pasaste.
// //
// // Uso:
// //   await runPostflopFuzzUIFlowV2({ n: 200 })
// // Devuelve: { total, ok, fail, skipped, stats, examples }
// //
// // Notas:
// // - Genera spots válidos por escenario.
// // - Setea escenario haciendo click en .scenario-btn[data-value="..."] (tu implementación real).
// // - Setea hero/villain por selects hidden (#heroPosition/#villainPosition).
// // - Setea cartas escribiendo selects (#card1Rank/#card1Suit etc) + dispatch change.

import { POS_ORDER } from "./state-v2.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function $(id) {
  return document.getElementById(id);
}

function dispatchChange(el) {
  if (!el) return;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(id, value) {
  const el = $(id);
  if (!el) return false;
  el.value = value;
  dispatchChange(el);
  return true;
}

function clickScenarioTab(value) {
  const btn = document.querySelector(`.scenario-btn[data-value="${value}"]`);
  if (!btn) return false;
  btn.click(); // tu table-ui.js ya dispara change del select internamente
  return true;
}

function clickCalculate() {
  const btn = $("btnCalculate");
  if (!btn) return false;
  btn.click();
  return true;
}

function clearAllCardsAndScenario() {
  const btn = $("btnClearCards");
  if (btn) btn.click();
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = ["s", "h", "d", "c"];

function cardKey(c) {
  return `${c.rank}${c.suit}`;
}

function drawUniqueCard(used) {
  let tries = 0;
  while (tries++ < 2000) {
    const c = { rank: sample(RANKS), suit: sample(SUITS) };
    const k = cardKey(c);
    if (!used.has(k)) {
      used.add(k);
      return c;
    }
  }
  return null;
}

function dealHandAndBoard() {
  const used = new Set();
  const hero1 = drawUniqueCard(used);
  const hero2 = drawUniqueCard(used);
  const flop1 = drawUniqueCard(used);
  const flop2 = drawUniqueCard(used);
  const flop3 = drawUniqueCard(used);
  const turn = drawUniqueCard(used);
  const river = drawUniqueCard(used);
  return { hero1, hero2, flop1, flop2, flop3, turn, river };
}

// Genera pares (hero,villain) válidos según escenario.
// Importante: tu lógica pos IP/OOP se basa en POS_ORDER y en hero/villain para vsOpen/vs3bet.
function genValidPositionsForScenario(scenarioValue) {
  // Para first in y overlimp tu computePostflopPos usa heurística si no hay villain,
  // pero tu UI igual lo muestra. Mantenemos villain opcional en first/overlimp.
  const positions = [...POS_ORDER];

  function pickDistinctPair() {
    const hero = sample(positions);
    let vill = sample(positions);
    let tries = 0;
    while (vill === hero && tries++ < 50) vill = sample(positions);
    return { hero, vill };
  }

  // Reglas simples “realistas”
  if (scenarioValue === "nadie_abrió") {
    // first in: hero no suele ser BB (no abre) — y SB puede abrir vs BB también, lo permitimos.
    let hero = sample(positions.filter((p) => p !== "BB"));
    // villain opcional (caller). Lo seteamos a veces para que pos calcule real.
    const setVillain = Math.random() < 0.6;
    let vill = setVillain ? sample(positions.filter((p) => p !== hero)) : "";
    return { hero, vill };
  }

  if (scenarioValue === "overlimp") {
    // overlimp/iso: hero puede estar en CO/BTN/SB/BB más frecuente, pero no bloqueamos.
    const { hero, vill } = pickDistinctPair();
    // villain aquí no necesariamente es “agresor” pero sirve para IP/OOP determinístico
    return { hero, vill };
  }

  if (scenarioValue === "vsOpen") {
    // Villain abrió primero (pos temprana), hero responde después (pos más tardía) en general.
    // Intentamos heroIndex > villainIndex
    let tries = 0;
    while (tries++ < 200) {
      const vill = sample(positions);
      const hero = sample(positions);
      if (hero !== vill && positions.indexOf(hero) > positions.indexOf(vill)) {
        return { hero, vill };
      }
    }
    return pickDistinctPair();
  }

  if (scenarioValue === "vs3bet") {
    // Hero enfrenta 3bet: villain suele estar detrás y 3betea => villainIndex > heroIndex muchas veces (no siempre),
    // pero para que sea “coherente” elegimos villainIndex > heroIndex
    let tries = 0;
    while (tries++ < 200) {
      const hero = sample(positions);
      const vill = sample(positions);
      if (hero !== vill && positions.indexOf(vill) > positions.indexOf(hero)) {
        return { hero, vill };
      }
    }
    return pickDistinctPair();
  }

  return pickDistinctPair();
}

function setPositions(hero, vill) {
  // selects hidden
  setSelectValue("heroPosition", hero || "");
  setSelectValue("villainPosition", vill || "");
}

function setCardPair(rankId, suitId, card) {
  if (!card) return;
  setSelectValue(rankId, card.rank);
  setSelectValue(suitId, card.suit);
}

// Lee panel unificado para validar que el flujo realmente calculó.
function readUnified() {
  const pre = $("u_preflop_line")?.textContent?.trim() || "—";
  const flop = $("u_flop_line")?.textContent?.trim() || "—";
  const turn = $("u_turn_line")?.textContent?.trim() || "—";
  const river = $("u_river_line")?.textContent?.trim() || "—";

  const preBadge = $("u_preflop_badge")?.textContent?.trim() || "—";
  const flopBadge = $("u_flop_badge")?.textContent?.trim() || "—";
  const turnBadge = $("u_turn_badge")?.textContent?.trim() || "—";
  const riverBadge = $("u_river_action")?.textContent?.trim() || "—";

  return { pre, flop, turn, river, preBadge, flopBadge, turnBadge, riverBadge };
}

function parseBoardTypeFromFlopLine(flopLine) {
  // Ejemplo: "Board: T♣ J♣ 9♣ · Tipo: MONOCOLOR · Línea: BET 33%"
  const m = /Tipo:\s*([A-Z_]+)/.exec(flopLine || "");
  return m?.[1] || "UNKNOWN";
}

function isMeaningful(line) {
  if (!line) return false;
  const t = String(line).trim();
  if (!t || t === "—") return false;
  // Tu river default: "Esperando turn + river."
  if (t.toLowerCase().includes("esperando")) return false;
  return true;
}

export async function runPostflopFuzzUIFlowV2(opts = {}) {
  const n = Number(opts.n ?? 200);
  const delay = Number(opts.delayMs ?? 5); // micro delay para que listeners actualicen UI

  const stats = {
    ok: 0,
    fail: 0,
    skipped: 0,
    boardTypes: {},
    actions: { pre: {}, flop: {}, turn: {}, river: {} },
  };

  const examples = [];

  function bump(map, key) {
    map[key] = (map[key] || 0) + 1;
  }

  for (let i = 0; i < n; i++) {
    try {
      // 0) Reset
      clearAllCardsAndScenario();
      await sleep(delay);

      // 1) Escenario por click real
      const scenarioValue = sample([
        "nadie_abrió",
        "overlimp",
        "vsOpen",
        "vs3bet",
      ]);
      if (!clickScenarioTab(scenarioValue)) {
        stats.skipped++;
        continue;
      }
      await sleep(delay);

      // 2) Posiciones válidas para el escenario
      const { hero, vill } = genValidPositionsForScenario(scenarioValue);
      setPositions(hero, vill);
      await sleep(delay);

      // 3) Reparto cartas
      const deal = dealHandAndBoard();
      if (
        !deal.hero1 ||
        !deal.hero2 ||
        !deal.flop1 ||
        !deal.flop2 ||
        !deal.flop3 ||
        !deal.turn ||
        !deal.river
      ) {
        stats.skipped++;
        continue;
      }

      // 4) Setear mano + board (por selects)
      setCardPair("card1Rank", "card1Suit", deal.hero1);
      setCardPair("card2Rank", "card2Suit", deal.hero2);

      setCardPair("flop1Rank", "flop1Suit", deal.flop1);
      setCardPair("flop2Rank", "flop2Suit", deal.flop2);
      setCardPair("flop3Rank", "flop3Suit", deal.flop3);

      setCardPair("turnRank", "turnSuit", deal.turn);
      setCardPair("riverRank", "riverSuit", deal.river);

      await sleep(delay);

      // 5) Preflop calculate (setea lastDecisionContext)
      clickCalculate();
      await sleep(delay);

      // 6) Lectura panel
      const uni = readUnified();

      // Si preflop no dio acción válida, skip
      if (!isMeaningful(uni.pre) || !isMeaningful(uni.preBadge)) {
        stats.skipped++;
        continue;
      }

      // Si preflop es FOLD, NO corresponde postflop (es un caso válido, pero no testeable postflop)
      if (String(uni.preBadge).toUpperCase() === "FOLD") {
        stats.skipped++;
        bump(stats.actions.pre, "FOLD");
        continue;
      }

      // flop/turn/river deberían existir si hay board completo seteado
      const flopOk = isMeaningful(uni.flop) && isMeaningful(uni.flopBadge);
      const turnOk = isMeaningful(uni.turn) && isMeaningful(uni.turnBadge);
      const riverOk = isMeaningful(uni.river) && isMeaningful(uni.riverBadge);

      const boardType = flopOk
        ? parseBoardTypeFromFlopLine(uni.flop)
        : "UNKNOWN";
      bump(stats.boardTypes, boardType);

      bump(stats.actions.pre, uni.preBadge);
      bump(stats.actions.flop, uni.flopBadge);
      bump(stats.actions.turn, uni.turnBadge);
      bump(stats.actions.river, uni.riverBadge);

      if (flopOk && turnOk && riverOk && boardType !== "UNKNOWN") {
        stats.ok++;
      } else {
        stats.fail++;
        if (examples.length < 12) {
          examples.push({
            i,
            scenarioValue,
            heroPos: hero,
            villPos: vill || "—",
            hero: `${deal.hero1.rank}${deal.hero1.suit} ${deal.hero2.rank}${deal.hero2.suit}`,
            flop: `${deal.flop1.rank}${deal.flop1.suit} ${deal.flop2.rank}${deal.flop2.suit} ${deal.flop3.rank}${deal.flop3.suit}`,
            turn: `${deal.turn.rank}${deal.turn.suit}`,
            river: `${deal.river.rank}${deal.river.suit}`,
            unified: uni,
            boardType,
            why: {
              preOk: isMeaningful(uni.pre),
              flopOk,
              turnOk,
              riverOk,
            },
          });
        }
      }
    } catch (e) {
      stats.fail++;
      if (examples.length < 12) {
        examples.push({ i, error: String(e?.message || e) });
      }
    }
  }

  return {
    total: n,
    ok: stats.ok,
    fail: stats.fail,
    skipped: stats.skipped,
    stats,
    examples,
  };
}

// Exponer en window para consola
window.runPostflopFuzzUIFlowV2 = runPostflopFuzzUIFlowV2;
