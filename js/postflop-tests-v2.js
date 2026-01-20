// // js/postflop-tests-v2.js
// import { AppState } from "./state-v2.js";
// import { pickPostflopActionV2 } from "./postflop-engine-v2.js";

// // Comparación flexible (podés chequear ruleId o action/size/plan)
function matchExpected(act, exp) {
  if (!exp) return { ok: true, why: "no expected" };

  // ruleId pasa a ser opcional (solo si exp.checkRuleId = true)
  if (
    exp.checkRuleId === true &&
    exp.ruleId != null &&
    act.ruleId !== exp.ruleId
  ) {
    return {
      ok: false,
      why: `ruleId esperado ${exp.ruleId}, vino ${act.ruleId}`,
    };
  }

  if (exp.action != null && act.action !== exp.action) {
    return {
      ok: false,
      why: `action esperado ${exp.action}, vino ${act.action}`,
    };
  }
  if (exp.size != null && (act.size ?? null) !== exp.size) {
    return {
      ok: false,
      why: `size esperado ${exp.size}, vino ${act.size ?? null}`,
    };
  }
  if (exp.plan != null && (act.plan ?? "NONE") !== exp.plan) {
    return {
      ok: false,
      why: `plan esperado ${exp.plan}, vino ${act.plan ?? "NONE"}`,
    };
  }
  return { ok: true, why: "match" };
}

function requireRulesLoaded() {
  if (!AppState?.postflopRules?.rulesets) {
    throw new Error(
      "[tests] AppState.postflopRules no está cargado. Revisá que main-v2.js haya cargado el JSON correctamente."
    );
  }
}

function mk(name, ctx, expected) {
  return { name, ctx, expected };
}

function baseCtx({ pos, street, boardType, handTier, outs }) {
  return {
    pos,
    street,
    boardType,
    handTier,
    outs: outs ?? 0,

    // memoria / extras (para que las reglas que lo usen no revienten)
    villainProfile: "DEFAULT",
    flopAction: null,
    flopSize: null,
    flopPlan: "NONE",

    // turn-only flags
    turnDynamic: "STATIC",
    heroCompletedDraw: false,
    boardCompletedDraw: false,
    hasBlockersForBluff: false,
  };
}

// ===============================
// ✅ TESTS IP + OOP (FLOP/TURN/RIVER)
// ===============================
export function getDefaultPostflopTestSuiteV2() {
  const t = [];

  // ---------- IP FLOP ----------
  t.push(
    mk(
      "IP FLOP OFENSIVO_SECO => BET 33 (range)",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "OFENSIVO_SECO",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_F_OF_SECO", action: "BET", size: 33, plan: "CBET_RANGE" }
    )
  );

  t.push(
    mk(
      "IP FLOP OFENSIVO_COORD + FUERTE => BET 75",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "OFENSIVO_COORD",
        handTier: "FUERTE",
        outs: 0,
      }),
      { ruleId: "IP_F_OF_COORD_VALUE_DRAW", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP FLOP OFENSIVO_COORD + AIRE + outs=4 => BET 75",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "OFENSIVO_COORD",
        handTier: "AIRE",
        outs: 4,
      }),
      { ruleId: "IP_F_OF_COORD_VALUE_DRAW", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP FLOP OFENSIVO_COORD + AIRE + outs=0 => CHECK",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "OFENSIVO_COORD",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_F_OF_COORD_CHECK", action: "CHECK" }
    )
  );

  t.push(
    mk(
      "IP FLOP DEFENSIVO_SECO + FUERTE => BET 75",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "DEFENSIVO_SECO",
        handTier: "FUERTE",
        outs: 0,
      }),
      { ruleId: "IP_F_DEF_SECO_VALUE_DRAW", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP FLOP DEFENSIVO_SECO + AIRE + outs=5 => BET 75",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "DEFENSIVO_SECO",
        handTier: "AIRE",
        outs: 5,
      }),
      { ruleId: "IP_F_DEF_SECO_VALUE_DRAW", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP FLOP DEFENSIVO_SECO + AIRE + outs=0 => CHECK",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "DEFENSIVO_SECO",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_F_DEF_SECO_CHECK", action: "CHECK" }
    )
  );

  t.push(
    mk(
      "IP FLOP NEUTRO_SECO => BET 50 (range)",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "NEUTRO_SECO",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_F_NEU_SECO", action: "BET", size: 50, plan: "CBET_RANGE" }
    )
  );

  t.push(
    mk(
      "IP FLOP NEUTRO_COORD + outs=8 => BET 75",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "NEUTRO_COORD",
        handTier: "AIRE",
        outs: 8,
      }),
      { ruleId: "IP_F_NEU_COORD_VALUE_DRAW", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP FLOP NEUTRO_COORD + AIRE + outs=0 => CHECK",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "NEUTRO_COORD",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_F_NEU_COORD_CHECK", action: "CHECK" }
    )
  );

  t.push(
    mk(
      "IP FLOP PAREADO_OFENSIVO => BET 33",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "PAREADO_OFENSIVO",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_F_PAIRED_OF", action: "BET", size: 33 }
    )
  );

  t.push(
    mk(
      "IP FLOP MONOCOLOR => BET 33",
      baseCtx({
        pos: "IP",
        street: "FLOP",
        boardType: "MONOCOLOR",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_F_MONO", action: "BET", size: 33 }
    )
  );

  // ---------- OOP FLOP ----------
  t.push(
    mk(
      "OOP FLOP MUY_FUERTE => CHECK_RAISE",
      baseCtx({
        pos: "OOP",
        street: "FLOP",
        boardType: "NEUTRO_SECO",
        handTier: "MUY_FUERTE",
        outs: 0,
      }),
      { ruleId: "OOP_F_MONSTER_XR", action: "CHECK_RAISE" }
    )
  );

  t.push(
    mk(
      "OOP FLOP FUERTE => BET 50",
      baseCtx({
        pos: "OOP",
        street: "FLOP",
        boardType: "NEUTRO_SECO",
        handTier: "FUERTE",
        outs: 0,
      }),
      { ruleId: "OOP_F_STRONG_BET", action: "BET", size: 50 }
    )
  );

  t.push(
    mk(
      "OOP FLOP MEDIA => CHECK_CALL",
      baseCtx({
        pos: "OOP",
        street: "FLOP",
        boardType: "NEUTRO_SECO",
        handTier: "MEDIA",
        outs: 0,
      }),
      { ruleId: "OOP_F_MEDIA_XC", action: "CHECK_CALL" }
    )
  );

  t.push(
    mk(
      "OOP FLOP AIRE + outs=6 => BET 50 (semi)",
      baseCtx({
        pos: "OOP",
        street: "FLOP",
        boardType: "NEUTRO_SECO",
        handTier: "AIRE",
        outs: 6,
      }),
      { ruleId: "OOP_F_AIR_SEMI", action: "BET", size: 50 }
    )
  );

  t.push(
    mk(
      "OOP FLOP AIRE + outs=0 => CHECK_FOLD",
      baseCtx({
        pos: "OOP",
        street: "FLOP",
        boardType: "NEUTRO_SECO",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "OOP_F_AIR_XF", action: "CHECK_FOLD" }
    )
  );

  t.push(
    mk(
      "OOP FLOP MONOCOLOR + MEDIA => CHECK_CALL",
      baseCtx({
        pos: "OOP",
        street: "FLOP",
        boardType: "MONOCOLOR",
        handTier: "MEDIA",
        outs: 0,
      }),
      { ruleId: "OOP_F_MEDIA_XC", action: "CHECK_CALL" }
    )
  );

  // ---------- IP TURN ----------
  t.push(
    mk(
      "IP TURN MUY_FUERTE => BET 50 (neutral static)",
      (() => {
        const c = baseCtx({
          pos: "IP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "MUY_FUERTE",
          outs: 0,
        });
        return c;
      })(),
      { ruleId: "IP_T_NEU_SECO_STATIC_STRONG_OR_DRAW", action: "BET", size: 50 }
    )
  );

  t.push(
    mk(
      "IP TURN heroCompletedDraw=true (ofensivo coord dinámico) => BET 75",
      (() => {
        const c = baseCtx({
          pos: "IP",
          street: "TURN",
          boardType: "OFENSIVO_COORD",
          handTier: "MEDIA",
          outs: 0,
        });
        c.heroCompletedDraw = true;
        c.flopAction = "BET";
        c.turnDynamic = "AGGRESSOR";
        return c;
      })(),
      { ruleId: "IP_T_OF_COORD_DYNAMIC_VALUE_COMPLETED", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP TURN boardCompletedDraw=true (ofensivo coord dinámico) => CHECK",
      (() => {
        const c = baseCtx({
          pos: "IP",
          street: "TURN",
          boardType: "OFENSIVO_COORD",
          handTier: "FUERTE",
          outs: 0,
        });
        c.boardCompletedDraw = true;
        c.flopAction = "BET";
        c.turnDynamic = "AGGRESSOR";
        return c;
      })(),
      {
        ruleId: "IP_T_OF_COORD_DYNAMIC_BOARD_COMPLETED_CHECK",
        action: "CHECK",
      }
    )
  );

  t.push(
    mk(
      "IP TURN turnDynamic=AGGRESSOR => BET 50 (neutral)",
      (() => {
        const c = baseCtx({
          pos: "IP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "AIRE",
          outs: 0,
        });
        c.turnDynamic = "AGGRESSOR";
        return c;
      })(),
      { ruleId: "IP_T_NEU_SECO_DYNAMIC_AGGRESSOR", action: "BET", size: 50 }
    )
  );

  t.push(
    mk(
      "IP TURN turnDynamic=DEFENDER + FUERTE => CHECK (neutral)",
      (() => {
        const c = baseCtx({
          pos: "IP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "FUERTE",
          outs: 0,
        });
        c.turnDynamic = "DEFENDER";
        return c;
      })(),
      { ruleId: "IP_T_NEU_SECO_DYNAMIC_DEFENDER", action: "CHECK" }
    )
  );

  t.push(
    mk(
      "IP TURN turnDynamic=DEFENDER + AIRE => CHECK (neutral)",
      (() => {
        const c = baseCtx({
          pos: "IP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "AIRE",
          outs: 0,
        });
        c.turnDynamic = "DEFENDER";
        return c;
      })(),
      { ruleId: "IP_T_NEU_SECO_DYNAMIC_DEFENDER", action: "CHECK" }
    )
  );

  t.push(
    mk(
      "IP TURN FUERTE (neutral) => BET 50 (thin)",
      baseCtx({
        pos: "IP",
        street: "TURN",
        boardType: "NEUTRO_SECO",
        handTier: "FUERTE",
        outs: 0,
      }),
      { ruleId: "IP_T_NEUTRAL_STRONG", action: "BET", size: 50 }
    )
  );

  t.push(
    mk(
      "IP TURN outs>=8 (neutral) => BET 50 (semi)",
      baseCtx({
        pos: "IP",
        street: "TURN",
        boardType: "NEUTRO_SECO",
        handTier: "AIRE",
        outs: 8,
      }),
      { ruleId: "IP_T_NEUTRAL_DRAW", action: "BET", size: 50 }
    )
  );

  // ---------- OOP TURN ----------
  t.push(
    mk(
      "OOP TURN MUY_FUERTE => BET 75",
      baseCtx({
        pos: "OOP",
        street: "TURN",
        boardType: "NEUTRO_SECO",
        handTier: "MUY_FUERTE",
        outs: 0,
      }),
      { ruleId: "OOP_T_MONSTER", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "OOP TURN flopPlan=XR => BET 75",
      (() => {
        const c = baseCtx({
          pos: "OOP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "MEDIA",
          outs: 0,
        });
        c.flopPlan = "XR";
        return c;
      })(),
      { ruleId: "OOP_T_FROM_XR", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "OOP TURN boardCompletedDraw=true => CHECK_CALL",
      (() => {
        const c = baseCtx({
          pos: "OOP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "MEDIA",
          outs: 0,
        });
        c.boardCompletedDraw = true;
        return c;
      })(),
      { ruleId: "OOP_T_BOARD_COMPLETED", action: "CHECK_CALL" }
    )
  );

  t.push(
    mk(
      "OOP TURN turnDynamic=DEFENDER + AIRE => CHECK_FOLD",
      (() => {
        const c = baseCtx({
          pos: "OOP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "AIRE",
          outs: 0,
        });
        c.turnDynamic = "DEFENDER";
        return c;
      })(),
      { ruleId: "OOP_T_DYNAMIC_DEFENDER_AIR", action: "CHECK_FOLD" }
    )
  );

  t.push(
    mk(
      "OOP TURN turnDynamic=AGGRESSOR + AIRE + blockers => BET 75 bluff",
      (() => {
        const c = baseCtx({
          pos: "OOP",
          street: "TURN",
          boardType: "NEUTRO_SECO",
          handTier: "AIRE",
          outs: 0,
        });
        c.turnDynamic = "AGGRESSOR";
        c.hasBlockersForBluff = true;
        return c;
      })(),
      { ruleId: "OOP_T_DYNAMIC_AGGRESSOR_BLUFF", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "OOP TURN FUERTE => BET 50",
      baseCtx({
        pos: "OOP",
        street: "TURN",
        boardType: "NEUTRO_SECO",
        handTier: "FUERTE",
        outs: 0,
      }),
      { ruleId: "OOP_T_STRONG", action: "BET", size: 50 }
    )
  );

  t.push(
    mk(
      "OOP TURN outs>=8 => BET 75 semi",
      baseCtx({
        pos: "OOP",
        street: "TURN",
        boardType: "NEUTRO_SECO",
        handTier: "AIRE",
        outs: 8,
      }),
      { ruleId: "OOP_T_DRAW", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "OOP TURN MEDIA => CHECK_CALL",
      baseCtx({
        pos: "OOP",
        street: "TURN",
        boardType: "NEUTRO_SECO",
        handTier: "MEDIA",
        outs: 0,
      }),
      { ruleId: "OOP_T_MEDIA", action: "CHECK_CALL" }
    )
  );

  // ---------- IP RIVER ----------
  t.push(
    mk(
      "IP RIVER FUERTE => BET 75 value",
      baseCtx({
        pos: "IP",
        street: "RIVER",
        boardType: "NEUTRO_SECO",
        handTier: "FUERTE",
        outs: 0,
      }),
      { ruleId: "IP_R_VALUE", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP RIVER MEDIA => CHECK (sdv)",
      baseCtx({
        pos: "IP",
        street: "RIVER",
        boardType: "NEUTRO_SECO",
        handTier: "MEDIA",
        outs: 0,
      }),
      { ruleId: "IP_R_SDV", action: "CHECK" }
    )
  );

  t.push(
    mk(
      "IP RIVER AIRE + blockers => BET 75 bluff",
      (() => {
        const c = baseCtx({
          pos: "IP",
          street: "RIVER",
          boardType: "NEUTRO_SECO",
          handTier: "AIRE",
          outs: 0,
        });
        c.hasBlockersForBluff = true;
        return c;
      })(),
      { ruleId: "IP_R_BLUFF_BLOCKERS", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "IP RIVER AIRE sin blockers => CHECK giveup",
      baseCtx({
        pos: "IP",
        street: "RIVER",
        boardType: "NEUTRO_SECO",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "IP_R_GIVEUP", action: "CHECK" }
    )
  );

  // ---------- OOP RIVER ----------
  t.push(
    mk(
      "OOP RIVER FUERTE => BET 75 value",
      baseCtx({
        pos: "OOP",
        street: "RIVER",
        boardType: "NEUTRO_SECO",
        handTier: "FUERTE",
        outs: 0,
      }),
      { ruleId: "OOP_R_VALUE", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "OOP RIVER MEDIA => CHECK_CALL",
      baseCtx({
        pos: "OOP",
        street: "RIVER",
        boardType: "NEUTRO_SECO",
        handTier: "MEDIA",
        outs: 0,
      }),
      { ruleId: "OOP_R_MEDIA", action: "CHECK_CALL" }
    )
  );

  t.push(
    mk(
      "OOP RIVER AIRE + blockers => BET 75 bluff",
      (() => {
        const c = baseCtx({
          pos: "OOP",
          street: "RIVER",
          boardType: "NEUTRO_SECO",
          handTier: "AIRE",
          outs: 0,
        });
        c.hasBlockersForBluff = true;
        return c;
      })(),
      { ruleId: "OOP_R_BLUFF", action: "BET", size: 75 }
    )
  );

  t.push(
    mk(
      "OOP RIVER AIRE sin blockers => CHECK giveup",
      baseCtx({
        pos: "OOP",
        street: "RIVER",
        boardType: "NEUTRO_SECO",
        handTier: "AIRE",
        outs: 0,
      }),
      { ruleId: "OOP_R_GIVEUP", action: "CHECK" }
    )
  );

  return t;
}

/**
 * Corre la suite y muestra resultados.
 * - showAll: true => tabla con todos, false => solo fallos
 */
export function runPostflopTestsV2({ showAll = true } = {}) {
  requireRulesLoaded();

  const suite = getDefaultPostflopTestSuiteV2();
  const rows = [];

  let pass = 0;
  let fail = 0;

  for (const tc of suite) {
    const act = pickPostflopActionV2(AppState.postflopRules, tc.ctx);
    const res = matchExpected(act, tc.expected);

    const ok = res.ok;
    if (ok) pass++;
    else fail++;

    rows.push({
      ok: ok ? "✅" : "❌",
      name: tc.name,
      pos: tc.ctx.pos,
      street: tc.ctx.street,
      boardType: tc.ctx.boardType,
      handTier: tc.ctx.handTier,
      outs: tc.ctx.outs,
      expected_ruleId: tc.expected?.ruleId ?? "",
      got_ruleId: act.ruleId ?? "",
      expected_action: tc.expected?.action ?? "",
      got_action: act.action ?? "",
      expected_size: tc.expected?.size ?? "",
      got_size: act.size ?? "",
      expected_plan: tc.expected?.plan ?? "",
      got_plan: act.plan ?? "",
      why: ok ? "" : res.why,
    });
  }

  const toShow = showAll ? rows : rows.filter((r) => r.ok === "❌");
  console.table(toShow);

  console.log(
    `[postflop-tests-v2] Total: ${suite.length} | PASS: ${pass} | FAIL: ${fail}`
  );

  if (fail) {
    console.warn(
      "[postflop-tests-v2] Hay fallos. Mirá la tabla (columna 'why') para ver qué no matchea."
    );
  } else {
    console.log(
      "[postflop-tests-v2] ✅ Todo OK. La estrategia del JSON matchea los casos base."
    );
  }

  return { total: suite.length, pass, fail, rows };
}

// Por comodidad desde consola:
window.runPostflopTestsV2 = runPostflopTestsV2;

// ===============================
// ✅ RUNNER ESPECÍFICO (CON CARTAS REALES)
// Usa buildHandSnapshot + classifyFlopToBoardType
// ===============================
export function runCardScenarioTestsV2({ showAll = true } = {}) {
  requireRulesLoaded();

  if (typeof window.buildHandSnapshot !== "function") {
    throw new Error("[tests] buildHandSnapshot no está disponible en window.");
  }
  if (typeof window.classifyFlopToBoardType !== "function") {
    throw new Error("[tests] classifyFlopToBoardType no está disponible en window.");
  }

  const c = (rank, suit) => ({ rank, suit });

  const scenarios = [
    {
      name: "IP RIVER: QJ con river J -> par de J (media) = CHECK",
      pos: "IP",
      hero: [c("Q", "s"), c("J", "h")],
      flop: [c("9", "d"), c("7", "d"), c("8", "d")],
      turn: c("5", "d"),
      river: c("J", "c"),
      expected: { action: "CHECK" },
    },
    {
      name: "IP RIVER: QJ con river Q -> par de Q (fuerte) = BET 75",
      pos: "IP",
      hero: [c("Q", "s"), c("J", "h")],
      flop: [c("9", "d"), c("7", "d"), c("8", "d")],
      turn: c("5", "d"),
      river: c("Q", "c"),
      expected: { action: "BET", size: 75 },
    },
  ];

  const rows = [];
  let pass = 0;
  let fail = 0;

  for (const sc of scenarios) {
    const board = [...sc.flop, sc.turn, sc.river];
    const snap = window.buildHandSnapshot(sc.hero, board);
    const boardType = window.classifyFlopToBoardType(sc.flop);

    const ctx = {
      pos: sc.pos,
      street: "RIVER",
      boardType,
      handTier: snap.handTier,
      outs: snap.outs,
      villainProfile: "DEFAULT",
      flopAction: "BET",
      flopSize: 33,
      flopPlan: "CBET_RANGE",
      turnDynamic: "STATIC",
      heroCompletedDraw: false,
      boardCompletedDraw: false,
      hasBlockersForBluff: snap.hasBlockersForBluff,
    };

    const act = pickPostflopActionV2(AppState.postflopRules, ctx);
    const res = matchExpected(act, sc.expected);
    const ok = res.ok;

    if (ok) pass++;
    else fail++;

    rows.push({
      ok: ok ? "✅" : "❌",
      name: sc.name,
      handTier: snap.handTier,
      expected_action: sc.expected.action ?? "",
      got_action: act.action ?? "",
      expected_size: sc.expected.size ?? "",
      got_size: act.size ?? "",
      why: ok ? "" : res.why,
    });
  }

  const toShow = showAll ? rows : rows.filter((r) => r.ok === "❌");
  console.table(toShow);
  console.log(
    `[card-tests-v2] Total: ${scenarios.length} | PASS: ${pass} | FAIL: ${fail}`
  );
  return { total: scenarios.length, pass, fail, rows };
}

window.runCardScenarioTestsV2 = runCardScenarioTestsV2;
