// srp_initiative_strategy_v2.js
// Estrategia UNICA: SRP con iniciativa (OR/ROL) -> bifurca por posición (IP/OOP)
// Determinística (SIN mixes)

// ======================================================================
// 0) CONTRATO DE INPUT (lo que el motor le pasa a la estrategia)
// ======================================================================
/*
ctx = {
  pos: "IP" | "OOP",
  street: "FLOP" | "TURN" | "RIVER",
  players: "HU" | "3WAY",                // opcional (por ahora no cambia mucho)
  villainProfile: "NORMAL" | "MALO",     // solo impacta paired defensivo vs malo

  boardFamily: one of:
    "OFF_SECO" | "OFF_COORD" |
    "DEF_SECO" | "DEF_COORD" |
    "NEU_SECO" | "NEU_COORD" |
    "PAREADO_OFF" | "PAREADO_NEU" | "PAREADO_DEF" |
    "MONOCOLOR",

  // bucket mano (sale de hand-snapshot)
  hand: {
    tier: "MUY_FUERTE" | "FUERTE" | "MEDIA" | "AIRE" | "SEMIBLUFF",
    vulnerableValue: boolean,     // true si es valor pero “frágil” vs proyectos / runouts
    outs: number,                 // aproximados 0-15
    completedDraw: boolean,        // si en turn/river completamos FD/ESD etc
    boardCompletedDraw: boolean,   // si el board completó draw “obvio”
    hasBlockers: boolean           // blockers para bluff river (A♠ en FD, blockers straight, etc)
  },

  // memoria de línea (la app la guarda)
  line: {
    flopLine: "BET_33" | "BET_50" | "BET_75" | "CHECK",
    // (si querés después: turnLine para river, etc)
  },

  // Turn dinámico (lo decide un clasificador)
  turn: {
    turnClass: "AGGRESSOR_FAV" | "DEFENDER_FAV" | "NEUTRAL",
    doubleCheckOpportunity: boolean // true si flop fue CHECK (y villano checkeó) y ahora podemos stab amplio
  }
}
*/

// ======================================================================
// 1) BUCKETING: definición SIMPLE y estable
//    (esto guía hand-snapshot.js, para que siempre caiga en un tier claro)
// ======================================================================
export const HAND_BUCKETS_V2 = {
  // Reglas base (concepto, no eval exacto):
  // - MUY_FUERTE: set+ / two pair fuerte / straight / flush / full / etc
  // - FUERTE: overpair / top pair buen kicker / trips “decentes”
  // - MEDIA: second pair / third pair / underpair / A-high con SD / showdown value
  // - AIRE: nada + sin backdoors relevantes
  // - SEMIBLUFF: draw (FD/OESD/gutshot) según outs aproximados

  // umbrales de outs que usa la estrategia
  outs: {
    SEMIBLUFF_MIN_DEFAULT: 4,
    NEU_COORD_SEMIBLUFF: 8,
    DEF_SECO_SEMIBLUFF: 5,
    DEF_COORD_SEMIBLUFF: 8,
    OFF_COORD_SEMIBLUFF: 4,
    OOP_SEMIBLUFF_BET_MIN: 6,   // 6 a 9 outs -> bet
    OOP_SEMIBLUFF_XR_ELSE: true // <6 o >9 -> XR
  }
};

// ======================================================================
// 2) ACCIONES: objeto de retorno estándar
// ======================================================================
function ACT(action, size, label, reason) {
  // action: "BET" | "CHECK" | "CHECK_CALL" | "CHECK_FOLD" | "CHECK_XR"
  // size: 33 | 50 | 75 | "GRANDE" | null
  return { action, size, label, reason };
}

// ======================================================================
// 3) ESTRATEGIA UNICA SRP INICIATIVA
// ======================================================================
export const STRATEGY_SRP_INITIATIVE_V2 = {
  id: "SRP_INITIATIVE_V2",
  principle: {
    IP: "Apostar es default; check es estratégico.",
    OOP: "Check es default; control del pozo; XR selectivo."
  },

  // -------------------------------------------------------
  // 3.1) FLOP
  // -------------------------------------------------------
  flop: {
    IP: {
      // IP: se guía mucho por el BOARD (como tu diagrama mental IP)
      OFF_SECO:   (ctx) => ACT("BET", 33, "BET 33%", "IP OFF_SECO: bet chico todo el rango"),
      OFF_COORD:  (ctx) => {
        const { tier, outs, vulnerableValue } = ctx.hand;
        if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "IP OFF_COORD: valor fuerte");
        if (tier === "FUERTE" && vulnerableValue) return ACT("BET", 75, "BET 75%", "IP OFF_COORD: valor vulnerable");
        if (outs >= HAND_BUCKETS_V2.outs.OFF_COORD_SEMIBLUFF) return ACT("BET", 75, "BET 75%", "IP OFF_COORD: semibluff 4+ outs");
        return ACT("CHECK", null, "CHECK", "IP OFF_COORD: media/aire -> check");
      },

      DEF_SECO:   (ctx) => {
        const { tier, outs } = ctx.hand;
        if (tier === "MUY_FUERTE" || tier === "FUERTE") return ACT("BET", 75, "BET 75%", "IP DEF_SECO: valor -> bet grande");
        if (outs >= HAND_BUCKETS_V2.outs.DEF_SECO_SEMIBLUFF) return ACT("BET", 75, "BET 75%", "IP DEF_SECO: semibluff 5+ outs");
        return ACT("CHECK", null, "CHECK", "IP DEF_SECO: media/aire -> check");
      },

      DEF_COORD:  (ctx) => {
        const { tier, outs } = ctx.hand;
        if (tier === "MUY_FUERTE" || tier === "FUERTE") return ACT("BET", 75, "BET 75%", "IP DEF_COORD: valor -> bet grande");
        if (outs >= HAND_BUCKETS_V2.outs.DEF_COORD_SEMIBLUFF) return ACT("BET", 75, "BET 75%", "IP DEF_COORD: semibluff 8+ outs");
        return ACT("CHECK", null, "CHECK", "IP DEF_COORD: media/aire -> check");
      },

      NEU_SECO:   (ctx) => ACT("BET", 50, "BET 50%", "IP NEU_SECO: bet 50% todo el rango"),

      NEU_COORD:  (ctx) => {
        const { tier, outs } = ctx.hand;
        if (tier === "MUY_FUERTE" || tier === "FUERTE") return ACT("BET", 75, "BET 75%", "IP NEU_COORD: valor");
        if (outs >= HAND_BUCKETS_V2.outs.NEU_COORD_SEMIBLUFF) return ACT("BET", 75, "BET 75%", "IP NEU_COORD: semibluff 8+ outs");
        return ACT("CHECK", null, "CHECK", "IP NEU_COORD: media/aire -> check");
      },

      PAREADO_OFF: (ctx) => ACT("BET", 33, "BET 33%", "IP PAREADO_OFF: bet chico todo el rango"),
      PAREADO_NEU: (ctx) => ACT("BET", 50, "BET 50%", "IP PAREADO_NEU: bet 50% todo el rango"),
      PAREADO_DEF: (ctx) => {
        // Solo caso especial: “pareado defensivo vs malo”
        if (ctx.villainProfile === "MALO") {
          const { tier, outs } = ctx.hand;
          // bet 33 con fuerte + aire + semibluff 8+ outs (y excluimos medias/SD)
          if (tier === "MUY_FUERTE" || tier === "FUERTE") return ACT("BET", 33, "BET 33%", "IP PAREADO_DEF vs MALO: valor -> bet chico");
          if (tier === "SEMIBLUFF" && outs >= 8) return ACT("BET", 33, "BET 33%", "IP PAREADO_DEF vs MALO: semibluff 8+ -> bet chico");
          if (tier === "AIRE") return ACT("BET", 33, "BET 33%", "IP PAREADO_DEF vs MALO: aire -> stab chico");
          return ACT("CHECK", null, "CHECK", "IP PAREADO_DEF vs MALO: media/SD -> check");
        }
        // estándar: simplificamos como 33 rango o check mix -> elegimos 33 rango para consistencia
        return ACT("BET", 33, "BET 33%", "IP PAREADO_DEF: bet chico (simplificado)");
      },

      MONOCOLOR: (ctx) => ACT("BET", 33, "BET 33%", "IP MONOCOLOR: bet 33% todo el rango")
    },

    OOP: {
      // OOP: se guía por MANO primero (como tu rama OOP)
      any: (ctx) => {
        const { tier, outs } = ctx.hand;

        if (tier === "MUY_FUERTE") return ACT("CHECK_XR", null, "CHECK → XR", "OOP: mano muy fuerte -> trampa XR");
        if (tier === "FUERTE") return ACT("BET", 50, "BET 50%", "OOP: mano fuerte -> bet por valor (bet/fold vs raise)");
        if (tier === "MEDIA") return ACT("CHECK_CALL", null, "CHECK → XC", "OOP: mano media -> XC / control");
        if (tier === "AIRE") return ACT("CHECK_FOLD", null, "CHECK → XF", "OOP: aire -> no regalar fichas");
        // SEMIBLUFF
        if (outs >= 6 && outs <= 9) return ACT("BET", 50, "BET 50%", "OOP: semibluff 6–9 outs -> bet");
        return ACT("CHECK_XR", null, "CHECK → XR", "OOP: semibluff <6 o >9 outs -> XR selectivo");
      }
    }
  },

  // -------------------------------------------------------
  // 3.2) TURN
  // -------------------------------------------------------
  turn: {
    IP: {
      // Regla madre: continuar según línea flop + ajustar por turn dinámico
      any: (ctx) => {
        const { tier, outs, completedDraw, boardCompletedDraw, vulnerableValue } = ctx.hand;
        const { flopLine } = ctx.line;
        const { turnClass, doubleCheckOpportunity } = ctx.turn;

        // (A) oportunidad: doble check => stab amplio (tu regla “podemos apostar cualquier carta”)
        if (doubleCheckOpportunity) {
          // stab “amplio pero prolijo”: 50% con casi todo salvo media SD que quiera showdown
          if (tier === "MEDIA") return ACT("CHECK", null, "CHECK", "IP TURN: doble check -> media SD, tomo showdown");
          return ACT("BET", 50, "BET 50%", "IP TURN: doble check -> stab amplio");
        }

        // (B) completamos draw => valor
        if (completedDraw) return ACT("BET", 75, "BET 75%", "IP TURN: completé draw -> apostar por valor");

        // (C) board completa draw “obvio” => frenar valor vulnerable / controlar
        if (boardCompletedDraw) {
          if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "IP TURN: board scary pero tengo nuts/valor enorme");
          if (tier === "FUERTE" && vulnerableValue) return ACT("CHECK", null, "CHECK", "IP TURN: se completa draw del board -> freno valor vulnerable");
          if (tier === "SEMIBLUFF" && outs >= 8) return ACT("BET", 50, "BET 50%", "IP TURN: semibluff fuerte sigue (pero size menor)");
          return ACT("CHECK", null, "CHECK", "IP TURN: carta mala -> control");
        }

        // (D) Turn favorable al agresor => más barrels + más bluffs (tu rama IP)
        if (turnClass === "AGGRESSOR_FAV") {
          if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "IP TURN: agresor fav + valor fuerte");
          if (tier === "FUERTE") return ACT("BET", 75, "BET 75%", "IP TURN: agresor fav + valor");
          if (tier === "SEMIBLUFF" && outs >= 4) return ACT("BET", 75, "BET 75%", "IP TURN: agresor fav + semibluff 4+");
          if (tier === "AIRE") return ACT("BET", 75, "BET 75%", "IP TURN: agresor fav -> bluff");
          return ACT("BET", 50, "BET 50%", "IP TURN: agresor fav -> presión moderada");
        }

        // (E) Turn favorable al defensor => control, menos farol
        if (turnClass === "DEFENDER_FAV") {
          if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "IP TURN: defensor fav pero tengo valor fuerte");
          if (tier === "FUERTE") return ACT("BET", 50, "BET 50%", "IP TURN: defensor fav -> thin/protección");
          return ACT("CHECK", null, "CHECK", "IP TURN: defensor fav -> control (media/aire)");
        }

        // (F) Turn neutral => seguir línea flop, pero sin mix
        if (flopLine === "BET_75") {
          if (tier === "MUY_FUERTE" || tier === "FUERTE") return ACT("BET", 75, "BET 75%", "IP TURN: continuamos línea 75% con valor");
          if (tier === "SEMIBLUFF" && outs >= 8) return ACT("BET", 50, "BET 50%", "IP TURN: proyecto fuerte -> seguir, pero size menor");
          return ACT("CHECK", null, "CHECK", "IP TURN: neutral -> freno con media/aire");
        }

        if (flopLine === "BET_50") {
          if (tier === "MUY_FUERTE" || tier === "FUERTE") return ACT("BET", 50, "BET 50%", "IP TURN: continuar 50% con valor");
          if (tier === "SEMIBLUFF" && outs >= 4) return ACT("BET", 50, "BET 50%", "IP TURN: semibluff 4+ -> bet 50%");
          return ACT("CHECK", null, "CHECK", "IP TURN: neutral -> check medias/aire");
        }

        if (flopLine === "BET_33") {
          if (tier === "MUY_FUERTE" || tier === "FUERTE") return ACT("BET", 50, "BET 50%", "IP TURN: veníamos chico -> subimos a 50 por valor");
          return ACT("CHECK", null, "CHECK", "IP TURN: veníamos chico -> control con no-valor");
        }

        // flopLine CHECK y no hubo doble check opportunity => seguimos control
        return ACT("CHECK", null, "CHECK", "IP TURN: venimos check -> control");
      }
    },

    OOP: {
      any: (ctx) => {
        const { tier, outs, completedDraw, boardCompletedDraw, hasBlockers } = ctx.hand;
        const { turnClass } = ctx.turn;

        if (completedDraw) return ACT("BET", 50, "BET 50%", "OOP TURN: completé -> value medio (no inflar de más)");
        if (boardCompletedDraw) {
          if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "OOP TURN: board scary pero valor enorme");
          if (tier === "FUERTE") return ACT("BET", 50, "BET 50%", "OOP TURN: protección/valor");
          if (tier === "SEMIBLUFF" && outs >= 8) return ACT("BET", 75, "BET 75%", "OOP TURN: semibluff fuerte sigue");
          return ACT("CHECK_CALL", null, "CHECK → XC", "OOP TURN: control (o XF si apuesta grande)");
        }

        if (turnClass === "AGGRESSOR_FAV") {
          if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "OOP TURN: valor fuerte");
          if (tier === "FUERTE") return ACT("BET", 50, "BET 50%", "OOP TURN: valor");
          if (tier === "SEMIBLUFF" && hasBlockers) return ACT("BET", 75, "BET 75%", "OOP TURN: semibluff selectivo con blockers");
          return ACT("CHECK_CALL", null, "CHECK → XC", "OOP TURN: base control");
        }

        if (turnClass === "DEFENDER_FAV") {
          if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "OOP TURN: valor fuerte igual");
          if (tier === "FUERTE") return ACT("BET", 50, "BET 50%", "OOP TURN: protección");
          return ACT("CHECK_FOLD", null, "CHECK → XF", "OOP TURN: carta mala -> no bluff");
        }

        // neutral
        if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "OOP TURN: valor fuerte");
        if (tier === "FUERTE") return ACT("BET", 50, "BET 50%", "OOP TURN: valor");
        if (tier === "SEMIBLUFF" && outs >= 8) return ACT("BET", 75, "BET 75%", "OOP TURN: semibluff fuerte");
        if (tier === "MEDIA") return ACT("CHECK_CALL", null, "CHECK → XC", "OOP TURN: SD value");
        return ACT("CHECK_FOLD", null, "CHECK → XF", "OOP TURN: aire");
      }
    }
  },

  // -------------------------------------------------------
  // 3.3) RIVER
  // -------------------------------------------------------
  river: {
    IP: {
      any: (ctx) => {
        const { tier, hasBlockers, boardCompletedDraw } = ctx.hand;

        if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "IP RIVER: valor fuerte");
        if (tier === "FUERTE") return ACT("BET", 75, "BET 75%", "IP RIVER: valor");
        if (tier === "MEDIA") return ACT("CHECK", null, "CHECK", "IP RIVER: showdown");

        // AIRE: bluff solo con blockers + historia coherente (por ahora: blockers + no board super scary)
        if (tier === "AIRE") {
          if (hasBlockers && !boardCompletedDraw) return ACT("BET", 75, "BET 75%", "IP RIVER: bluff con blockers");
          return ACT("CHECK", null, "CHECK", "IP RIVER: give up");
        }

        // SEMIBLUFF en river debería transformarse a aire (si no completó) o valor (si completó).
        return ACT("CHECK", null, "CHECK", "IP RIVER: fallback");
      }
    },

    OOP: {
      any: (ctx) => {
        const { tier, hasBlockers } = ctx.hand;

        if (tier === "MUY_FUERTE") return ACT("BET", 75, "BET 75%", "OOP RIVER: valor fuerte");
        if (tier === "FUERTE") return ACT("BET", 75, "BET 75%", "OOP RIVER: valor");
        if (tier === "MEDIA") return ACT("CHECK_CALL", null, "CHECK → XC", "OOP RIVER: SD value (pago chico / foldeo grande)");
        if (tier === "AIRE") {
          if (hasBlockers) return ACT("BET", 75, "BET 75%", "OOP RIVER: bluff selectivo (blockers)");
          return ACT("CHECK", null, "CHECK", "OOP RIVER: give up");
        }
        return ACT("CHECK", null, "CHECK", "OOP RIVER: fallback");
      }
    }
  }
};

// ======================================================================
// 4) DISPATCHER ÚNICO (cómo se consulta desde flop/turn/river)
// ======================================================================
export function decideSRPInitiativeV2(ctx) {
  const { pos, street, boardFamily } = ctx;

  if (street === "FLOP") {
    if (pos === "IP") return STRATEGY_SRP_INITIATIVE_V2.flop.IP[boardFamily]?.(ctx)
      ?? ACT("CHECK", null, "CHECK", "FLOP fallback");
    return STRATEGY_SRP_INITIATIVE_V2.flop.OOP.any(ctx);
  }

  if (street === "TURN") {
    if (pos === "IP") return STRATEGY_SRP_INITIATIVE_V2.turn.IP.any(ctx);
    return STRATEGY_SRP_INITIATIVE_V2.turn.OOP.any(ctx);
  }

  if (street === "RIVER") {
    if (pos === "IP") return STRATEGY_SRP_INITIATIVE_V2.river.IP.any(ctx);
    return STRATEGY_SRP_INITIATIVE_V2.river.OOP.any(ctx);
  }

  return ACT("CHECK", null, "CHECK", "Unknown street");
}
