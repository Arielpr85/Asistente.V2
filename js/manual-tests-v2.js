// js/manual-tests-v2.js
// Uso:
//   await runManualTestsV2()
//   await runManualTestsV2({ only: "IP" })
//   await runManualTestsV2({ only: "OOP" })
//   await runManualTestsV2({ ids: ["IP_OFENSIVO_SECO_RANGE_1"] })

(function () {
  const $ = (id) => document.getElementById(id);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function tick() {
    await Promise.resolve();
    await sleep(0);
  }

  function setSelectValue(id, val) {
    const el = $(id);
    if (!el) throw new Error(`No existe #${id}`);
    el.value = val;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function clickScenario(value) {
    const btn = document.querySelector(`.scenario-btn[data-value="${value}"]`);
    if (!btn) throw new Error(`No existe botón scenario ${value}`);
    btn.click();
  }

  async function setHeroSeat(pos) {
    $("btnSelectHero")?.click();
    await tick();
    document.querySelector(`.poker-seat[data-pos="${pos}"]`)?.click();
    await tick();
  }

  async function setVillainSeat(pos) {
    $("btnSelectVillain")?.click();
    await tick();
    document.querySelector(`.poker-seat[data-pos="${pos}"]`)?.click();
    await tick();
  }

  async function clearAll() {
    $("btnClearCards")?.click();
    await tick();
  }

  function parseCard(str) {
    // "Ah" -> {rank:"A", suit:"h"}
    return { rank: str[0], suit: str[1] };
  }

  async function applyHero(hero2) {
    const c1 = parseCard(hero2[0]);
    const c2 = parseCard(hero2[1]);
    setSelectValue("card1Rank", c1.rank);
    setSelectValue("card1Suit", c1.suit);
    setSelectValue("card2Rank", c2.rank);
    setSelectValue("card2Suit", c2.suit);
    await tick();
  }

  async function applyBoard(board5) {
    const flop = board5.slice(0, 3).map(parseCard);
    const turn = parseCard(board5[3]);
    const river = parseCard(board5[4]);

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
  }

  function getUnified() {
    return {
      preLine: $("u_preflop_line")?.textContent ?? "—",
      preBadge: $("u_preflop_badge")?.textContent ?? "—",
      flopLine: $("u_flop_line")?.textContent ?? "—",
      flopBadge: $("u_flop_badge")?.textContent ?? "—",
      turnLine: $("u_turn_line")?.textContent ?? "—",
      turnBadge: $("u_turn_badge")?.textContent ?? "—",
      riverLine: $("u_river_line")?.textContent ?? "—",
      riverBadge: $("u_river_action")?.textContent ?? "—",
    };
  }

  function isMeaningful(s) {
    const t = String(s ?? "").trim();
    return t && t !== "—" && t !== "-";
  }

  async function ensurePreflopComputed() {
    $("btnCalculate")?.click();
    await tick();
    await tick();

    const uni = getUnified();
    if (String(uni.preBadge).trim() === "—") {
      // fallback
      try { window.calcularAccionV2?.(); } catch {}
      try { window.calcularAccion?.(); } catch {}
      await tick();
      await tick();
    }
  }

  // ---------------------------------------------------------
  // TESTS (CORREGIDOS SEGÚN GUÍAS)
  // - IP: OFENSIVO_SECO = BET 33% de rango (no existe CHECK/CALL)
  // - IP: NEUTRO_SECO = BET 50% de rango
  // - IP: DEFENSIVO_SECO: FUERTE o AIRE con 6-9 outs => BET 75% (según guía rápida IP)
  // - IP: OFENSIVO_COORD: FUERTE => BET 75%, AIRE sin outs => CHECK
  // - IP: NEUTRO_COORD: draws fuertes => BET 75%
  // - IP: MONOCOLOR: BET 33% rango
  // - IP: PAREADOS (cualquier pareado): BET 33% rango
  //
  // OOP (guía OOP):
  // - MUY_FUERTE => XR (CHECK/RAISE)
  // - FUERTE => BET 50
  // - MEDIA => XC (CHECK/CALL)
  // - AIRE sin outs => XF (CHECK/FOLD)
  // ---------------------------------------------------------

  window.MANUAL_TESTS_V2 = [

    // ---------- IP ----------
    {
      id: "IP_OFENSIVO_SECO_RANGE_1",
      posLabel: "IP",
      desc: "IP · OFENSIVO_SECO · cbet rango 33",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "BTN",
        villPos: "BB",
        hero: ["As", "Kd"],                // AKo (open)
        board: ["Ah", "7c", "2d", "9s", "4h"], // OFENSIVO_SECO
      },
      expect: { flop: "BET 33%" }, // guía IP
    },
    {
      id: "IP_NEUTRO_SECO_RANGE_1",
      posLabel: "IP",
      desc: "IP · NEUTRO_SECO · cbet rango 50",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "CO",
        villPos: "BB",
        hero: ["Qh", "Qs"],                // QQ (open)
        board: ["Js", "8c", "2d", "4h", "9d"], // NEUTRO_SECO típico
      },
      expect: { flop: "BET 50%" }, // guía IP
    },
    {
      id: "IP_DEFENSIVO_SECO_STRONG_1",
      posLabel: "IP",
      desc: "IP · DEFENSIVO_SECO · FUERTE => BET 75",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "BTN",
        villPos: "BB",
        hero: ["8s", "8d"],                // 88 (open BTN)
        board: ["7h", "3c", "2d", "Ks", "9c"], // DEFENSIVO_SECO
      },
      expect: { flop: "BET 75%" }, // guía IP (value/protection en defensivo seco)
    },
    {
      id: "IP_NEUTRO_COORD_DRAW_1",
      posLabel: "IP",
      desc: "IP · NEUTRO_COORD · draw fuerte => BET 75",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "CO",
        villPos: "BB",
        hero: ["9s", "8s"],                // 98s
        board: ["Jd", "Ts", "7s", "2h", "4c"], // NEUTRO_COORD + OESD/FD
      },
      expect: { flop: "BET 75%" }, // guía IP (coord: presión con draws)
    },
    {
      id: "IP_MONOCOLOR_RANGE_1",
      posLabel: "IP",
      desc: "IP · MONOCOLOR · rango => BET 33",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "BTN",
        villPos: "BB",
        hero: ["Ad", "Kd"],                // AK (open)
        board: ["Qs", "9s", "3s", "2d", "4h"], // MONOCOLOR
      },
      expect: { flop: "BET 33%" }, // guía IP monotone
    },
    {
      id: "IP_PAREADO_RANGE_1",
      posLabel: "IP",
      desc: "IP · PAREADO (cualquiera) · rango => BET 33",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "BTN",
        villPos: "BB",
        hero: ["Ah", "Kh"],                // AKs
        board: ["As", "Ac", "7d", "2c", "9h"], // PAREADO_OFENSIVO
      },
      expect: { flop: "BET 33%" }, // guía IP pareados = rango 33
    },

    // ---------- OOP ----------
    {
      id: "OOP_MUY_FUERTE_XR_1",
      posLabel: "OOP",
      desc: "OOP · MUY_FUERTE => CHECK/RAISE (XR)",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "UTG",
        villPos: "BTN",
        hero: ["Ah", "Ad"],                 // AA (open UTG)
        board: ["As", "7c", "2d", "9s", "4h"], // trips = MUY_FUERTE
      },
      expect: { flop: "CHECK/RAISE" }, // guía OOP
    },
    {
      id: "OOP_FUERTE_BET_50_1",
      posLabel: "OOP",
      desc: "OOP · FUERTE => BET 50",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "UTG1",
        villPos: "BTN",
        hero: ["Kc", "Kd"],                 // KK
        board: ["Jh", "8c", "2d", "4h", "9d"], // overpair fuerte
      },
      expect: { flop: "BET 50%" }, // guía OOP
    },
    {
      id: "OOP_MEDIA_XC_1",
      posLabel: "OOP",
      desc: "OOP · MEDIA => CHECK/CALL (XC)",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "UTG",
        villPos: "BTN",
        hero: ["As", "Qs"],                 // AQs
        board: ["Qs", "9d", "3c", "2h", "7d"], // top pair = MEDIA/FUERTE según tu snapshot; si te lo sube a FUERTE, ajustamos mano/board
      },
      expect: { flop: "CHECK/CALL" }, // guía OOP
    },
    {
      id: "OOP_AIRE_XF_1",
      posLabel: "OOP",
      desc: "OOP · AIRE sin outs => CHECK/FOLD (XF)",
      setup: {
        scenario: "nadie_abrió",
        heroPos: "UTG1",
        villPos: "BTN",
        hero: ["9c", "8d"],                 // mano floja (pero OJO: puede ser FOLD preflop según tu JSON)
        board: ["As", "7c", "2d", "9s", "4h"],
      },
      expect: { flop: "CHECK/FOLD" }, // guía OOP
    },
  ];

  // ---------------------------------------------------------
  // Runner
  // ---------------------------------------------------------
  async function runManualTestsV2(opts = {}) {
    const only = opts.only; // "IP" | "OOP"
    const ids = Array.isArray(opts.ids) ? new Set(opts.ids) : null;

    const results = [];
    let pass = 0, fail = 0, skip = 0;

    for (const t of MANUAL_TESTS_V2) {
      if (only && t.posLabel !== only) continue;
      if (ids && !ids.has(t.id)) continue;

      await clearAll();

      try {
        clickScenario(t.setup.scenario);
        await tick();

        await setHeroSeat(t.setup.heroPos);
        await setVillainSeat(t.setup.villPos);

        await applyHero(t.setup.hero);
        await applyBoard(t.setup.board);

        await ensurePreflopComputed();
        const uni = getUnified();

        const preBadge = String(uni.preBadge).trim();
        if (preBadge === "—") {
          results.push({ id: t.id, desc: t.desc, status: "SKIP", reason: "Preflop no calculado (—)", observed: uni, setup: t.setup });
          skip++;
          continue;
        }
        if (preBadge === "FOLD") {
          results.push({ id: t.id, desc: t.desc, status: "SKIP", reason: "Preflop dio FOLD", observed: uni, setup: t.setup });
          skip++;
          continue;
        }

        // Diagnóstico IP/OOP (lo que el engine cree)
        const enginePos = window.AppState?.lastPostflopContext?.pos ?? null;

        const checks = [];
        const expectedFlop = t.expect?.flop;
        if (expectedFlop) {
          checks.push({
            street: "FLOP",
            expected: expectedFlop,
            got: String(uni.flopBadge).trim(),
            ok: String(uni.flopBadge).trim() === expectedFlop,
          });
        }

        const allOk = checks.every((c) => c.ok);

        if (allOk) {
          results.push({ id: t.id, desc: t.desc, status: "PASS", checks, observed: uni, enginePos, setup: t.setup });
          pass++;
        } else {
          results.push({ id: t.id, desc: t.desc, status: "FAIL", checks, observed: uni, enginePos, setup: t.setup });
          fail++;
        }
      } catch (e) {
        results.push({ id: t.id, desc: t.desc, status: "FAIL", error: String(e?.message || e) });
        fail++;
      }
    }

    return { total: results.length, pass, fail, skip, results };
  }

  window.runManualTestsV2 = runManualTestsV2;
})();


