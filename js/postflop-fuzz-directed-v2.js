// js/postflop-fuzz-directed-v2.js
// Fuzz REALISTA dirigido: genera spots jugables (menos FOLD) y siempre setea villano en vsOpen/vs3bet.
// Uso en consola:
//   await runPostflopFuzzDirectedV2({ n: 200, seed: 123, verbose: false })
//
// Requiere tu UI actual (ids del HTML que pasaste) + main-v2.js cargado.

(function () {
  // -----------------------------
  // Utils
  // -----------------------------
  const POS_ORDER = ["UTG", "UTG1", "MP", "HJ", "CO", "BTN", "SB", "BB"];
  const RANKS = [
    "A",
    "K",
    "Q",
    "J",
    "T",
    "9",
    "8",
    "7",
    "6",
    "5",
    "4",
    "3",
    "2",
  ];
  const SUITS = ["s", "h", "d", "c"];

  function $(id) {
    return document.getElementById(id);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function tick() {
    // micro + macro tick para que render y listeners se asienten
    await Promise.resolve();
    await sleep(0);
  }

  // PRNG simple (seedable) para reproducibilidad
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function shuffle(rng, arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function bump(obj, key) {
    obj[key] = (obj[key] || 0) + 1;
  }

  function isMeaningfulText(s) {
    const t = String(s ?? "").trim();
    return t && t !== "—" && t !== "-";
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

  function parsePreActionLabel(preBadgeText) {
    const up = String(preBadgeText || "")
      .toUpperCase()
      .trim();
    // en tu UI preBadge suele ser "OPEN RAISE", "ISORAISE", "CALL VS OR", etc.
    return up || "—";
  }

  function parseBoardTypeFromFlopLine(flopLine) {
    // "Board: ... · Tipo: OFENSIVO_SECO"
    const m = String(flopLine || "").match(/Tipo:\s*([A-Z_]+)/i);
    return m ? m[1].toUpperCase() : "UNKNOWN";
  }

  // -----------------------------
  // DOM interaction (clicks reales)
  // -----------------------------
  async function setScenarioByClick(value) {
    const btn = document.querySelector(`.scenario-btn[data-value="${value}"]`);
    if (!btn) throw new Error(`No encuentro botón scenario ${value}`);
    btn.click();
    await tick();
  }

  async function setHeroPosBySeat(pos) {
    const btnHero = $("btnSelectHero");
    const seat = document.querySelector(`.poker-seat[data-pos="${pos}"]`);
    if (!btnHero || !seat)
      throw new Error(`No encuentro hero btn o seat ${pos}`);
    btnHero.click();
    await tick();
    seat.click();
    await tick();
  }

  async function setVillainPosBySeat(pos) {
    const btnVill = $("btnSelectVillain");
    const seat = document.querySelector(`.poker-seat[data-pos="${pos}"]`);
    if (!btnVill || !seat)
      throw new Error(`No encuentro villain btn o seat ${pos}`);
    btnVill.click();
    await tick();
    seat.click();
    await tick();
  }

  function setSelectValue(id, val) {
    const el = $(id);
    if (!el) throw new Error(`No encuentro #${id}`);
    el.value = val;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setSel(id, val) {
    const el = $(id);
    if (!el) return false;
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function cardKey(c) {
    return `${c.rank}${c.suit}`;
  }

  // -----------------------------
  // Hand generators (dirigidos => menos fold)
  // -----------------------------
  function makeCard(rank, suit) {
    return { rank, suit };
  }

  function randomSuit(rng) {
    return pick(rng, SUITS);
  }

  function randomDifferentSuit(rng, notSuit) {
    const opts = SUITS.filter((s) => s !== notSuit);
    return pick(rng, opts);
  }

  function rankIndex(rank) {
    return RANKS.indexOf(rank); // 0= A ... 12=2
  }

  function genPair(rng, minRankIdx = 0, maxRankIdx = 9) {
    // rank idx 0..12 (A..2). minRankIdx menor => más fuerte.
    const idx = Math.floor(rng() * (maxRankIdx - minRankIdx + 1)) + minRankIdx;
    const r = RANKS[idx];
    const s1 = randomSuit(rng);
    const s2 = randomDifferentSuit(rng, s1);
    return [makeCard(r, s1), makeCard(r, s2)];
  }

  function genBroadway(rng, suitedBias = 0.6) {
    const br = ["A", "K", "Q", "J", "T"];
    const r1 = pick(rng, br);
    let r2 = pick(rng, br);
    while (r2 === r1) r2 = pick(rng, br);

    const suited = rng() < suitedBias;
    const s1 = randomSuit(rng);
    const s2 = suited ? s1 : randomDifferentSuit(rng, s1);
    return [makeCard(r1, s1), makeCard(r2, s2)];
  }

  function genSuitedAce(rng) {
    // Axs con kicker 2..J
    const kickers = ["J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
    const r2 = pick(rng, kickers);
    const s = randomSuit(rng);
    return [makeCard("A", s), makeCard(r2, s)];
  }

  function genSuitedConnector(rng) {
    // 76s..T9s + 65s + 87s etc
    const connectors = [
      ["T", "9"],
      ["9", "8"],
      ["8", "7"],
      ["7", "6"],
      ["6", "5"],
      ["J", "T"],
      ["Q", "J"],
    ];
    const [r1, r2] = pick(rng, connectors);
    const s = randomSuit(rng);
    return [makeCard(r1, s), makeCard(r2, s)];
  }

  function genPlayableHandForScenario(rng, scenario) {
    // Mezcla de categorías para que no sea siempre lo mismo
    // Más tight para vs3bet que para vsOpen/overlimp/firstin
    const roll = rng();
    if (scenario === "vs3bet") {
      // fuerte: pares altos, broadways suited, AK/AQ, algunos JJ-88, etc
      if (roll < 0.4) return genPair(rng, 0, 7); // AA..99
      if (roll < 0.75) return genBroadway(rng, 0.75); // broadways, más suited
      if (roll < 0.9) return genSuitedAce(rng); // Axs suited
      return genSuitedConnector(rng); // algunos SC suited
    }

    if (scenario === "vsOpen") {
      if (roll < 0.25) return genPair(rng, 0, 10); // AA..66
      if (roll < 0.55) return genBroadway(rng, 0.65);
      if (roll < 0.8) return genSuitedAce(rng);
      return genSuitedConnector(rng);
    }

    // first in / overlimp: más amplio pero igual “jugable”
    if (roll < 0.15) return genPair(rng, 0, 12); // cualquier par
    if (roll < 0.45) return genBroadway(rng, 0.6);
    if (roll < 0.7) return genSuitedAce(rng);
    return genSuitedConnector(rng);
  }

  // -----------------------------
  // Board generators (para que NO sea UNKNOWN)
  // -----------------------------
  function drawUnusedCard(rng, usedSet) {
    // intento simple con fallback
    for (let k = 0; k < 2000; k++) {
      const r = pick(rng, RANKS);
      const s = pick(rng, SUITS);
      const key = `${r}${s}`;
      if (!usedSet.has(key)) {
        usedSet.add(key);
        return { rank: r, suit: s };
      }
    }
    throw new Error("No pude generar carta no usada (usedSet saturado?)");
  }

  function genFlopByType(rng, usedSet, type) {
    // Generamos ranks y suits que tu classifier reconoce bien.
    // type en: OFENSIVO_SECO, NEUTRO_SECO, DEFENSIVO_SECO, OFENSIVO_COORD, NEUTRO_COORD, DEFENSIVO_COORD, MONOCOLOR, PAREADO_OFENSIVO, PAREADO_DEFENSIVO, PAREADO_NEUTRO
    const ensureUnused = (cards) => {
      for (const c of cards) {
        const k = cardKey(c);
        if (usedSet.has(k)) return false;
      }
      cards.forEach((c) => usedSet.add(cardKey(c)));
      return true;
    };

    for (let tries = 0; tries < 200; tries++) {
      let cards = [];

      if (type === "MONOCOLOR") {
        const s = pick(rng, SUITS);
        const ranks = shuffle(rng, [
          "A",
          "K",
          "Q",
          "J",
          "T",
          "9",
          "8",
          "7",
          "6",
          "5",
          "4",
          "3",
          "2",
        ]).slice(0, 3);
        cards = ranks.map((r) => makeCard(r, s));
      } else if (type.startsWith("PAREADO_")) {
        // par + kicker
        const pairBand =
          type === "PAREADO_OFENSIVO"
            ? ["A", "K", "Q", "J", "T"]
            : type === "PAREADO_DEFENSIVO"
            ? ["2", "3", "4", "5", "6", "7", "8"]
            : ["9", "8", "7", "6", "5", "4"]; // neutro aproximado

        const pr = pick(rng, pairBand);
        const kickerPool = RANKS.filter((r) => r !== pr);
        const kr = pick(rng, kickerPool);

        const s1 = randomSuit(rng);
        const s2 = randomDifferentSuit(rng, s1);
        const s3 = randomSuit(rng);

        cards = [makeCard(pr, s1), makeCard(pr, s2), makeCard(kr, s3)];
      } else if (type.endsWith("_SECO")) {
        // seco = no muy conectado y no 2tone obligado
        // ofensivo: A/K/Q presentes
        // neutro: J/T presentes
        // defensivo: low cards
        const ranksPool =
          type === "OFENSIVO_SECO"
            ? ["A", "K", "Q", "J", "T"]
            : type === "NEUTRO_SECO"
            ? ["J", "T", "9", "8"]
            : ["8", "7", "6", "5", "4", "3", "2"];

        // elegir 3 ranks con gaps grandes (p.ej A 8 2)
        const r1 = pick(rng, ranksPool);
        let r2 = pick(rng, RANKS);
        let r3 = pick(rng, RANKS);

        // asegurar distintos
        while (r2 === r1) r2 = pick(rng, RANKS);
        while (r3 === r1 || r3 === r2) r3 = pick(rng, RANKS);

        // suits aleatorios, intentando no siempre 2tone
        const s1 = randomSuit(rng);
        const s2 = randomSuit(rng);
        const s3 = randomSuit(rng);

        cards = [makeCard(r1, s1), makeCard(r2, s2), makeCard(r3, s3)];
      } else if (type.endsWith("_COORD")) {
        // coord = conectados o 2tone
        // ofensivo: A/K o highs
        // neutro: Q/J/T
        // defensivo: low conectados
        const base =
          type === "OFENSIVO_COORD"
            ? pick(rng, [
                ["A", "K", "Q"],
                ["K", "Q", "J"],
                ["A", "Q", "J"],
                ["A", "K", "J"],
              ])
            : type === "NEUTRO_COORD"
            ? pick(rng, [
                ["Q", "J", "T"],
                ["J", "T", "9"],
                ["Q", "T", "9"],
              ])
            : pick(rng, [
                ["8", "7", "6"],
                ["7", "6", "5"],
                ["6", "5", "4"],
                ["5", "4", "3"],
              ]);

        // suits 2tone para asegurar coord
        const sA = randomSuit(rng);
        const sB = randomDifferentSuit(rng, sA);
        const pattern = pick(rng, [
          [sA, sA, sB],
          [sA, sB, sA],
          [sB, sA, sA],
        ]);

        cards = [
          makeCard(base[0], pattern[0]),
          makeCard(base[1], pattern[1]),
          makeCard(base[2], pattern[2]),
        ];
      } else {
        // fallback: coord neutro
        const base = pick(rng, [
          ["Q", "J", "T"],
          ["J", "T", "9"],
          ["8", "7", "6"],
        ]);
        const sA = randomSuit(rng);
        const sB = randomDifferentSuit(rng, sA);
        cards = [
          makeCard(base[0], sA),
          makeCard(base[1], sA),
          makeCard(base[2], sB),
        ];
      }

      if (ensureUnused(cards)) return cards;
    }

    // si no pudo por colisiones, hacemos random
    return [
      drawUnusedCard(rng, usedSet),
      drawUnusedCard(rng, usedSet),
      drawUnusedCard(rng, usedSet),
    ];
  }

  function genRunout(rng, usedSet) {
    const turn = drawUnusedCard(rng, usedSet);
    const river = drawUnusedCard(rng, usedSet);
    return { turn, river };
  }

  // -----------------------------
  // Choose positions coherentes
  // -----------------------------
  function pickPositionsForScenario(rng, scenario) {
    const hero = pick(rng, POS_ORDER);

    // default villano cualquiera distinto
    let vill = pick(
      rng,
      POS_ORDER.filter((p) => p !== hero)
    );

    const h = POS_ORDER.indexOf(hero);
    if (scenario === "vsOpen") {
      // Villano = opener => suele estar antes (index menor)
      const openers = POS_ORDER.filter((p) => POS_ORDER.indexOf(p) < h);
      vill = openers.length
        ? pick(rng, openers)
        : pick(
            rng,
            POS_ORDER.filter((p) => p !== hero)
          );
    } else if (scenario === "vs3bet") {
      // Villano = 3bettor => suele estar después (index mayor)
      const threebettors = POS_ORDER.filter((p) => POS_ORDER.indexOf(p) > h);
      vill = threebettors.length
        ? pick(rng, threebettors)
        : pick(
            rng,
            POS_ORDER.filter((p) => p !== hero)
          );
    } else if (scenario === "overlimp") {
      // Villano = alguien que limpeó antes, aprox antes del hero
      const limpers = POS_ORDER.filter((p) => POS_ORDER.indexOf(p) < h);
      vill = limpers.length
        ? pick(rng, limpers)
        : pick(
            rng,
            POS_ORDER.filter((p) => p !== hero)
          );
    } else {
      // first in: villano no es necesario, pero lo seteamos igual para UI
      vill = pick(
        rng,
        POS_ORDER.filter((p) => p !== hero)
      );
    }

    return { hero, vill };
  }

  // -----------------------------
  // Apply one test case
  // -----------------------------
  async function clearAll() {
    const btn = $("btnClearCards");
    if (btn) btn.click();
    await tick();
  }

  async function applyHeroCards(heroCards) {
    setSel("card1Rank", heroCards[0].rank);
    setSel("card1Suit", heroCards[0].suit);
    setSel("card2Rank", heroCards[1].rank);
    setSel("card2Suit", heroCards[1].suit);
    await tick();
  }

  async function applyBoard(flop, turn, river) {
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

  async function ensurePreflopComputed() {
    // 1) intentamos click UI
    const btn = document.getElementById("btnCalculate");
    if (btn) btn.click();
    await tick();
    await tick();

    // 2) si sigue en "—", intentamos llamar a la función directa (si está expuesta)
    const uni1 = getUnified();
    const preBlank = String(uni1.preBadge || "").trim() === "—";
    if (preBlank) {
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

  // -----------------------------
  // Public runner
  // -----------------------------
  async function runPostflopFuzzDirectedV2(opts = {}) {
    const n = Number(opts.n ?? 200);
    const seed = Number.isFinite(opts.seed) ? Number(opts.seed) : Date.now();
    const verbose = !!opts.verbose;

    const rng = mulberry32(seed);

    const scenarios = ["nadie_abrió", "overlimp", "vsOpen", "vs3bet"];
    const boardTypes = [
      "OFENSIVO_SECO",
      "NEUTRO_SECO",
      "DEFENSIVO_SECO",
      "OFENSIVO_COORD",
      "NEUTRO_COORD",
      "DEFENSIVO_COORD",
      "MONOCOLOR",
      "PAREADO_OFENSIVO",
      "PAREADO_DEFENSIVO",
      "PAREADO_NEUTRO",
    ];

    const stats = {
      actions: { pre: {}, flop: {}, turn: {}, river: {} },
      boardTypes: {},
      scenarios: {},
      positions: { hero: {}, villain: {} },
    };

    const examples = [];
    let ok = 0,
      fail = 0,
      skipped = 0;

    for (let i = 0; i < n; i++) {
      try {
        await clearAll();

        const scenarioValue = pick(rng, scenarios);
        bump(stats.scenarios, scenarioValue);

        await setScenarioByClick(scenarioValue);

        const { hero: heroPos, vill: villPos } = pickPositionsForScenario(
          rng,
          scenarioValue
        );
        bump(stats.positions.hero, heroPos);
        bump(stats.positions.villain, villPos);

        // 🔒 Fuente real que usa preflop-v2.js (no depende de clicks)
        setSel("heroPosition", heroPos);
        setSel("scenario", scenarioValue);

        if (scenarioValue === "vsOpen" || scenarioValue === "vs3bet") {
          setSel("villainPosition", villPos);
        } else {
          // opcional: limpiar villano en escenarios que no lo usan
          setSel("villainPosition", "");
        }

        await setHeroPosBySeat(heroPos);
        // En vsOpen/vs3bet TIENE que haber villano seleccionado
        await setVillainPosBySeat(villPos);

        // Hero hand (dirigida)
        const heroHand = genPlayableHandForScenario(rng, scenarioValue);

        // Ensure no duplicate (muy raro con nuestras funciones, pero por seguridad)
        if (cardKey(heroHand[0]) === cardKey(heroHand[1])) {
          // force fix
          heroHand[1].suit = randomDifferentSuit(rng, heroHand[0].suit);
        }

        await applyHeroCards(heroHand);

        // Board (dirigido para no UNKNOWN)
        const used = new Set([cardKey(heroHand[0]), cardKey(heroHand[1])]);
        const targetBoardType = pick(rng, boardTypes);
        const flop = genFlopByType(rng, used, targetBoardType);
        const { turn, river } = genRunout(rng, used);

        await applyBoard(flop, turn, river);

        // Calcular (pre y post)
        await ensurePreflopComputed();

        // dentro del loop, después de ensurePreflopComputed():
        const uni = getUnified();
        const preAction = parsePreActionLabel(uni.preBadge);
        bump(stats.actions.pre, preAction);

        if (preAction === "—") {
          // No hay preflop (estado no sincronizó): no testeo postflop
          skipped++;
          bump(stats, "skipped_pre_blank"); // si querés contarlo aparte
          continue;
        }

        if (preAction === "FOLD") {
          skipped++;
          continue;
        }

        // Validación postflop: deben estar calculadas las 3 calles
        if (
          !isMeaningfulText(uni.flopBadge) ||
          !isMeaningfulText(uni.turnBadge) ||
          !isMeaningfulText(uni.riverBadge)
        ) {
          fail++;
          if (examples.length < 12) {
            examples.push({
              i,
              error: "Alguna calle quedó sin acción (—)",
              scenarioValue,
              heroPos,
              villPos,
              preAction,
              hero: `${heroHand[0].rank}${heroHand[0].suit} ${heroHand[1].rank}${heroHand[1].suit}`,
              flop: flop.map((c) => `${c.rank}${c.suit}`).join(" "),
              turn: `${turn.rank}${turn.suit}`,
              river: `${river.rank}${river.suit}`,
              uni,
            });
          }
          continue;
        }

        bump(stats.actions.flop, String(uni.flopBadge).trim());
        bump(stats.actions.turn, String(uni.turnBadge).trim());
        bump(stats.actions.river, String(uni.riverBadge).trim());

        const bt = parseBoardTypeFromFlopLine(uni.flopLine);
        bump(stats.boardTypes, bt);

        ok++;
        if (verbose && i % 20 === 0) {
          console.log(
            `[fuzz-directed] i=${i} ok=${ok} fail=${fail} skipped=${skipped}`
          );
        }
      } catch (e) {
        fail++;
        if (examples.length < 12) {
          examples.push({
            i,
            error: String(e?.message || e),
            stack: String(e?.stack || ""),
          });
        }
      }
    }

    return { total: n, ok, fail, skipped, stats, examples, seed };
  }

  // export global
  window.runPostflopFuzzDirectedV2 = runPostflopFuzzDirectedV2;
})();
