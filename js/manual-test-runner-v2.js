// js/manual-test-runner-v2.js
// Runner MANUAL real: aplica setup via UI, calcula, lee panel unificado y compara expected.
// Uso:
//   await runManualTestsV2()
//   await runManualTestsV2({ only: ["IP_NEUTRO_SECO_RANGE_1"], verbose: true })
//   await runManualTestsV2({ n: 5 })  // corre primeros N
//
// Requiere: tu HTML actual + main-v2.js cargado + manual-tests-v2.js cargado.

(function () {
  const POS_ORDER = ["UTG", "UTG1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

  function $(id) {
    return document.getElementById(id);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function tick() {
    await Promise.resolve();
    await sleep(0);
  }

  function normalizeActionLabel(s) {
    const t = String(s ?? "").trim();
    if (!t || t === "—") return "—";
    return t
      .replace(/\s+/g, " ")
      .replace("BET75%", "BET 75%")
      .replace("BET50%", "BET 50%")
      .replace("BET33%", "BET 33%");
  }

  function isDefinedAction(s) {
    const t = normalizeActionLabel(s);
    return t !== "—" && t !== "-" && t !== "";
  }

  function readUnified() {
    return {
      preBadge: normalizeActionLabel($("u_preflop_badge")?.textContent ?? "—"),
      preLine: $("u_preflop_line")?.textContent ?? "—",

      flopBadge: normalizeActionLabel($("u_flop_badge")?.textContent ?? "—"),
      flopLine: $("u_flop_line")?.textContent ?? "—",

      turnBadge: normalizeActionLabel($("u_turn_badge")?.textContent ?? "—"),
      turnLine: $("u_turn_line")?.textContent ?? "—",

      riverBadge: normalizeActionLabel($("u_river_action")?.textContent ?? "—"),
      riverLine: $("u_river_line")?.textContent ?? "—",
    };
  }

  function parseCard(str) {
    // "As" => {rank:"A", suit:"s"}
    const t = String(str || "").trim();
    if (t.length < 2) throw new Error(`Carta inválida: "${str}"`);
    const rank = t[0].toUpperCase();
    const suit = t[t.length - 1].toLowerCase();
    return { rank, suit };
  }

  function setSelectValue(id, val) {
    const el = $(id);
    if (!el) throw new Error(`No encuentro #${id}`);
    el.value = val;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function setScenarioByClick(value) {
    const btn = document.querySelector(`.scenario-btn[data-value="${value}"]`);
    if (!btn) throw new Error(`No encuentro botón scenario ${value}`);
    btn.click();
    await tick();
  }

  async function setHeroPosBySeat(pos) {
    const btnHero = $("btnSelectHero");
    const seat = document.querySelector(`.poker-seat[data-pos="${pos}"]`);
    if (!btnHero || !seat) throw new Error(`No encuentro HERO/seat ${pos}`);
    btnHero.click();
    await tick();
    seat.click();
    await tick();
  }

  async function setVillainPosBySeat(pos) {
    const btnVill = $("btnSelectVillain");
    const seat = document.querySelector(`.poker-seat[data-pos="${pos}"]`);
    if (!btnVill || !seat) throw new Error(`No encuentro VILLANO/seat ${pos}`);
    btnVill.click();
    await tick();
    seat.click();
    await tick();
  }

  async function clearAll() {
    // tu botón limpia cartas y escenario
    const btn = $("btnClearCards");
    if (btn) btn.click();
    await tick();
    await tick();
  }

  async function applySetup(setup) {
    await clearAll();

    await setScenarioByClick(setup.scenario);

    if (setup.heroPos) await setHeroPosBySeat(setup.heroPos);
    if (setup.villPos) await setVillainPosBySeat(setup.villPos);

    // hero
    const h1 = parseCard(setup.hero[0]);
    const h2 = parseCard(setup.hero[1]);

    setSelectValue("card1Rank", h1.rank);
    setSelectValue("card1Suit", h1.suit);
    setSelectValue("card2Rank", h2.rank);
    setSelectValue("card2Suit", h2.suit);

    // board completo: flop turn river
    const b = setup.board.map(parseCard);
    const flop = b.slice(0, 3);
    const turn = b[3];
    const river = b[4];

    setSelectValue("flop1Rank", flop[0].rank);
    setSelectValue("flop1Suit", flop[0].suit);
    setSelectValue("flop2Rank", flop[1].rank);
    setSelectValue("flop2Suit", flop[1].suit);
    setSelectValue("flop3Rank", flop[2].rank);
    setSelectValue("flop3Suit", flop[2].suit);

    setSelectValue("turnRank", turn.rank);
    setSelectValue("turnSuit", turn.suit);

    setSelectValue("riverRank", river.rank);
    setSelectValue("riverSuit", river.suit);

    await tick();
    await tick();
  }

  async function ensurePreflopComputed() {
    const btn = $("btnCalculate");
    if (btn) btn.click();
    await tick();
    await tick();

    const uni = readUnified();
    if (uni.preBadge === "—") {
      // fallback: si la función está expuesta
      try {
        window.calcularAccionV2?.();
      } catch {}
      try {
        window.calcularAccion?.();
      } catch {}
      await tick();
      await tick();
    }
  }

  function compareExpected(observed, expected) {
    const checks = [];

    // FLOP
    if (expected?.flop?.action) {
      const exp = expected.flop.action;
      const got = observed.flopBadge;

      if (exp === "__ANY_DEFINED__") {
        checks.push({
          street: "FLOP",
          ok: isDefinedAction(got),
          expected: "cualquier acción definida (no —)",
          got,
        });
      } else {
        checks.push({
          street: "FLOP",
          ok: normalizeActionLabel(got) === normalizeActionLabel(exp),
          expected: exp,
          got,
        });
      }
    }

    // TURN
    if (expected?.turn?.action) {
      const exp = expected.turn.action;
      const got = observed.turnBadge;

      if (exp === "__ANY_DEFINED__") {
        checks.push({
          street: "TURN",
          ok: isDefinedAction(got),
          expected: "cualquier acción definida (no —)",
          got,
        });
      } else {
        checks.push({
          street: "TURN",
          ok: normalizeActionLabel(got) === normalizeActionLabel(exp),
          expected: exp,
          got,
        });
      }
    }

    // RIVER (por ahora opcional; si querés exigirlo, lo activamos)
    if (expected?.river?.action) {
      const exp = expected.river.action;
      const got = observed.riverBadge;

      if (exp === "__ANY_DEFINED__") {
        checks.push({
          street: "RIVER",
          ok: isDefinedAction(got),
          expected: "cualquier acción definida (no —)",
          got,
        });
      } else {
        checks.push({
          street: "RIVER",
          ok: normalizeActionLabel(got) === normalizeActionLabel(exp),
          expected: exp,
          got,
        });
      }
    }

    const okAll = checks.every((c) => c.ok);
    return { okAll, checks };
  }

  async function runOne(test, { verbose = false } = {}) {
    await applySetup(test.setup);
    await ensurePreflopComputed();

    // dejamos que los change listeners hagan su trabajo (flop/turn/river)
    await tick();
    await tick();

    const observed = readUnified();

    // si es FOLD, el postflop no es válido => lo marcamos como SKIP
    if (observed.preBadge === "FOLD") {
      return {
        id: test.id,
        desc: test.desc,
        status: "SKIP",
        reason: "Preflop dio FOLD",
        observed,
      };
    }
    if (observed.preBadge === "—") {
      return {
        id: test.id,
        desc: test.desc,
        status: "SKIP",
        reason: "Preflop no calculado (—)",
        observed,
      };
    }

    const cmp = compareExpected(observed, test.expect || {});
    const status = cmp.okAll ? "PASS" : "FAIL";

    if (verbose || status === "FAIL") {
      console.log(`[manual:${status}] ${test.id} — ${test.desc}`);
      console.log("observed:", observed);
      console.log("checks:", cmp.checks);
    }

    return {
      id: test.id,
      desc: test.desc,
      status,
      checks: cmp.checks,
      observed,
      expected: test.expect,
      setup: test.setup,
    };
  }

  async function runManualTestsV2(opts = {}) {
    const all = Array.isArray(window.MANUAL_TESTS_V2) ? window.MANUAL_TESTS_V2 : [];
    if (!all.length) throw new Error("No hay MANUAL_TESTS_V2 cargados. ¿Incluiste manual-tests-v2.js?");

    const only = Array.isArray(opts.only) ? new Set(opts.only) : null;
    const n = Number.isFinite(opts.n) ? Math.max(1, Math.floor(opts.n)) : all.length;
    const verbose = !!opts.verbose;

    const selected = all
      .filter((t) => !only || only.has(t.id))
      .slice(0, n);

    const results = [];
    let pass = 0, fail = 0, skip = 0;

    for (const t of selected) {
      const r = await runOne(t, { verbose });
      results.push(r);
      if (r.status === "PASS") pass++;
      else if (r.status === "FAIL") fail++;
      else skip++;
    }

    console.table(
      results.map((r) => ({
        id: r.id,
        status: r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️",
        desc: r.desc,
      }))
    );

    // lista rápida de fallos con detalle
    const fails = results.filter((r) => r.status === "FAIL");
    if (fails.length) {
      console.log("❌ Fallos detallados:");
      fails.forEach((r) => {
        console.log(`- ${r.id}: ${r.desc}`);
        (r.checks || []).forEach((c) => {
          if (!c.ok) console.log(`   ${c.street}: esperado "${c.expected}" | vino "${c.got}"`);
        });
      });
    }

    return { total: results.length, pass, fail, skip, results };
  }

  // export global
  window.runManualTestsV2 = runManualTestsV2;
})();
