// // js/postflop-smoke-ui-tests-v2.js
// // Smoke tests de integración UI (selects + eventos + panel unificado)
// // Uso: runPostflopSmokeUITestsV2()

function $(id) {
  return document.getElementById(id);
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

function text(id) {
  return ($(id)?.textContent || "").trim();
}

function isDashOrEmpty(s) {
  return !s || s === "—";
}

function badgeLooksValid(s) {
  const t = String(s || "").toUpperCase();
  // Aceptamos labels típicos
  return (
    t.includes("BET") ||
    t.includes("CHECK") ||
    t.includes("CALL") ||
    t.includes("FOLD") ||
    t.includes("RAISE") ||
    t.includes("4BET") ||
    t.includes("3BET")
  );
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -----------------------------
// Casos de test (editables)
// -----------------------------
// Nota: acá NO buscamos “acción exacta” (eso ya lo hace runPostflopTestsV2),
// sino que verificamos que la UI+eventos arman el contexto completo y muestran resultados.

const CASES = [
  {
    name: "IP: BTN vs BB (vs3bet) + board completo",
    setup: () => {
      // Escenario y posiciones
      setSelect("scenario", "vs3bet");
      setSelect("heroPosition", "BTN");
      setSelect("villainPosition", "BB");

      // Mano hero
      setCard("hero1", "A", "h");
      setCard("hero2", "A", "d");

      // Flop/Turn/River
      setCard("flop1", "T", "c");
      setCard("flop2", "J", "c");
      setCard("flop3", "9", "c");
      setCard("turn", "8", "c");
      setCard("river", "7", "c");
    },
  },
  {
    name: "OOP: SB vs BTN (vsOpen) + board seco",
    setup: () => {
      setSelect("scenario", "vsOpen");
      setSelect("heroPosition", "SB");
      setSelect("villainPosition", "BTN");

      setCard("hero1", "A", "s");
      setCard("hero2", "Q", "s");

      setCard("flop1", "K", "d");
      setCard("flop2", "7", "h");
      setCard("flop3", "2", "c");
      setCard("turn", "9", "d");
      setCard("river", "3", "s");
    },
  },
  {
    name: "First In (heurística pos): CO sin villano + board coordinado",
    setup: () => {
      setSelect("scenario", "nadie_abrió");
      setSelect("heroPosition", "CO");
      setSelect("villainPosition", ""); // no villano

      setCard("hero1", "K", "h");
      setCard("hero2", "Q", "h");

      setCard("flop1", "J", "d");
      setCard("flop2", "T", "s");
      setCard("flop3", "9", "h");
      setCard("turn", "2", "c");
      setCard("river", "A", "d");
    },
  },
];

// -----------------------------
// Runner
// -----------------------------
export async function runPostflopSmokeUITestsV2() {
  const rows = [];
  let pass = 0;
  let fail = 0;

  // Intento limpiar si existe botón
  const btnClear = $("btnClearCards");
  if (btnClear) btnClear.click();

  for (const tc of CASES) {
    const row = {
      ok: "❌",
      name: tc.name,
      pre: "",
      flop: "",
      turn: "",
      river: "",
      why: "",
    };

    try {
      // limpiar entre casos
      if (btnClear) btnClear.click();
      await sleep(10);

      tc.setup();

      // flujo real: botón calcular (preflop)
      click("btnCalculate");

      // dejamos que listeners rendericen
      await sleep(30);

      // Validaciones mínimas de panel unificado
      const preLine = text("u_preflop_line");
      const preBadge = text("u_preflop_badge");

      const flopLine = text("u_flop_line");
      const flopBadge = text("u_flop_badge");

      const turnLine = text("u_turn_line");
      const turnBadge = text("u_turn_badge");

      const riverLine = text("u_river_line");
      const riverBadge = text("u_river_action");

      row.pre = `${preLine} | ${preBadge}`;
      row.flop = `${flopLine} | ${flopBadge}`;
      row.turn = `${turnLine} | ${turnBadge}`;
      row.river = `${riverLine} | ${riverBadge}`;

      assert(!isDashOrEmpty(preLine), "Preflop line quedó vacío/—");
      assert(!isDashOrEmpty(preBadge) && badgeLooksValid(preBadge), "Preflop badge inválido");

      // Ojo: flop/turn/river dependen de que haya pre válido + board completo.
      // En estos tests estamos cargando board completo, así que deben existir.
      assert(!isDashOrEmpty(flopLine), "Flop line quedó vacío/—");
      assert(!isDashOrEmpty(flopBadge) && badgeLooksValid(flopBadge), "Flop badge inválido");

      assert(!isDashOrEmpty(turnLine), "Turn line quedó vacío/—");
      assert(!isDashOrEmpty(turnBadge) && badgeLooksValid(turnBadge), "Turn badge inválido");

      assert(!isDashOrEmpty(riverLine), "River line quedó vacío/—");
      assert(!isDashOrEmpty(riverBadge) && badgeLooksValid(riverBadge), "River badge inválido");

      row.ok = "✅";
      pass++;
    } catch (e) {
      row.why = e?.message || String(e);
      fail++;
    }

    rows.push(row);
  }

  const out = { total: rows.length, pass, fail, rows };
  console.table(
    rows.map((r) => ({
      ok: r.ok,
      name: r.name,
      why: r.why,
      pre: r.pre,
      flop: r.flop,
      turn: r.turn,
      river: r.river,
    }))
  );
  return out;
}

// atajo global
window.runPostflopSmokeUITestsV2 = runPostflopSmokeUITestsV2;
