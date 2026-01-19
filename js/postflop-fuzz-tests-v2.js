// // js/postflop-fuzz-tests-v2.js
// // Fuzz tests (black-box) usando TU UI y panel unificado.
// // Uso: runPostflopFuzzTestsV2({ n: 200 })

function $(id) {
  return document.getElementById(id);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setSelect(id, value) {
  const el = $(id);
  if (!el) throw new Error(`Falta #${id}`);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function click(id) {
  const el = $(id);
  if (!el) throw new Error(`Falta #${id}`);
  el.click();
}

function text(id) {
  return ($(id)?.textContent || "").trim();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// -----------------------------
// Card helpers
// -----------------------------
const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SUITS = ["s","h","d","c"];

function cardKey(rank, suit) {
  return `${rank}${suit}`;
}

function drawUniqueCard(used) {
  for (let tries = 0; tries < 5000; tries++) {
    const r = pick(RANKS);
    const s = pick(SUITS);
    const k = cardKey(r, s);
    if (!used.has(k)) {
      used.add(k);
      return { rank: r, suit: s, key: k };
    }
  }
  throw new Error("No pude generar carta única (used lleno?)");
}

function setCard(slot, rank, suit) {
  const map = {
    hero1: ["card1Rank", "card1Suit"],
    hero2: ["card2Rank", "card2Suit"],
    flop1: ["flop1Rank", "flop1Suit"],
    flop2: ["flop2Rank", "flop2Suit"],
    flop3: ["flop3Rank", "flop3Suit"],
    turn: ["turnRank", "turnSuit"],
    river: ["riverRank", "riverSuit"],
  };
  const pair = map[slot];
  if (!pair) throw new Error(`Slot desconocido: ${slot}`);
  setSelect(pair[0], rank);
  setSelect(pair[1], suit);
}

// -----------------------------
// Parse helpers (desde tu panel unificado)
// -----------------------------
function extractBoardTypeFromFlopLine(line) {
  // Esperado: "Board: ... · Tipo: MONOCOLOR · Línea: BET 33%"
  const m = line.match(/Tipo:\s*([A-Z_]+)/i);
  return m ? m[1].toUpperCase() : "UNKNOWN";
}

function extractActionFromBadge(badgeText) {
  const t = String(badgeText || "").toUpperCase().trim();
  if (t.includes("BET")) return "BET";
  if (t.includes("CHECK")) return "CHECK";
  if (t.includes("CALL")) return "CALL";
  if (t.includes("FOLD")) return "FOLD";
  if (t.includes("RAISE")) return "RAISE";
  return t || "—";
}

function isFallbackReason(reason) {
  const r = String(reason || "").toLowerCase();
  return (
    r.includes("sin reglas") ||
    r.includes("no hay ruleset") ||
    r.includes("fallback") ||
    r.includes("ninguna regla")
  );
}

// -----------------------------
// Main runner
// -----------------------------
export async function runPostflopFuzzTestsV2(opts = {}) {
  const n = Number.isFinite(opts.n) ? opts.n : 200;

  const scenarios = ["nadie_abrió", "overlimp", "vsOpen", "vs3bet"];
  const positions = ["UTG","UTG1","MP","HJ","CO","BTN","SB","BB"];

  const btnClear = $("btnClearCards");
  if (!btnClear) {
    throw new Error("No encontré #btnClearCards (tu HTML dice que existe).");
  }

  const stats = {
    total: n,
    ok: 0,
    fail: 0,
    fallback: 0,
    boardTypes: {},       // { TYPE: count }
    flopActions: {},      // { BET/CHECK/...: count }
    turnActions: {},
    riverActions: {},
    examples: [],         // guardamos algunos fallos para inspección
  };

  function bump(map, k) {
    map[k] = (map[k] || 0) + 1;
  }

  for (let i = 0; i < n; i++) {
    try {
      // limpiar UI
      btnClear.click();
      await sleep(5);

      // escenario + posiciones
      const scen = pick(scenarios);
      setSelect("scenario", scen);

      const heroPos = pick(positions);
      setSelect("heroPosition", heroPos);

      // villain solo si aplica (vsOpen / vs3bet)
      if (scen === "vsOpen" || scen === "vs3bet") {
        let vill = pick(positions);
        // evitamos mismo seat
        if (vill === heroPos) vill = pick(positions.filter((p) => p !== heroPos));
        setSelect("villainPosition", vill);
      } else {
        setSelect("villainPosition", "");
      }

      // generar cartas únicas
      const used = new Set();
      const h1 = drawUniqueCard(used);
      const h2 = drawUniqueCard(used);
      const f1 = drawUniqueCard(used);
      const f2 = drawUniqueCard(used);
      const f3 = drawUniqueCard(used);
      const t1 = drawUniqueCard(used);
      const r1 = drawUniqueCard(used);

      setCard("hero1", h1.rank, h1.suit);
      setCard("hero2", h2.rank, h2.suit);
      setCard("flop1", f1.rank, f1.suit);
      setCard("flop2", f2.rank, f2.suit);
      setCard("flop3", f3.rank, f3.suit);
      setCard("turn", t1.rank, t1.suit);
      setCard("river", r1.rank, r1.suit);

      // disparar cálculo “real”
      click("btnCalculate");
      await sleep(20);

      // leer panel unificado
      const flopLine = text("u_flop_line");
      const flopExpl = text("u_flop_expl");
      const flopBadge = text("u_flop_badge");

      const turnLine = text("u_turn_line");
      const turnExpl = text("u_turn_expl");
      const turnBadge = text("u_turn_badge");

      const riverLine = text("u_river_line");
      const riverCtx = text("u_river_context");
      const riverBadge = text("u_river_action");

      // si preflop no armó contexto, a veces flop no corre: lo contamos como fail
      if (!flopLine || flopLine === "—") {
        throw new Error("Flop line vacío/— (posible preflop context nulo en este spot)");
      }

      const bt = extractBoardTypeFromFlopLine(flopLine);
      bump(stats.boardTypes, bt);

      bump(stats.flopActions, extractActionFromBadge(flopBadge));
      bump(stats.turnActions, extractActionFromBadge(turnBadge));
      bump(stats.riverActions, extractActionFromBadge(riverBadge));

      // fallback detection (por explicación/razón)
      const anyFallback =
        isFallbackReason(flopExpl) || isFallbackReason(turnExpl) || isFallbackReason(riverCtx);

      if (anyFallback) stats.fallback++;

      // sanity mínima
      if (!turnLine || turnLine === "—") throw new Error("Turn line vacío/—");
      if (!riverLine || riverLine.includes("Esperando")) throw new Error("River line no se calculó");

      stats.ok++;
    } catch (e) {
      stats.fail++;
      if (stats.examples.length < 10) {
        stats.examples.push({
          i,
          error: e?.message || String(e),
          scen: text("scenario"),
          heroPos: text("summaryHeroPos"),
          villPos: text("summaryVillainPos"),
          pre: text("u_preflop_line"),
          flop: text("u_flop_line"),
          turn: text("u_turn_line"),
          river: text("u_river_line"),
        });
      }
    }
  }

  console.log("[FUZZ] resumen:", {
    total: stats.total,
    ok: stats.ok,
    fail: stats.fail,
    fallback: stats.fallback,
  });
  console.log("[FUZZ] boardTypes:", stats.boardTypes);
  console.log("[FUZZ] flopActions:", stats.flopActions);
  console.log("[FUZZ] turnActions:", stats.turnActions);
  console.log("[FUZZ] riverActions:", stats.riverActions);
  if (stats.examples.length) console.log("[FUZZ] ejemplos fallos:", stats.examples);

  return stats;
}

window.runPostflopFuzzTestsV2 = runPostflopFuzzTestsV2;
