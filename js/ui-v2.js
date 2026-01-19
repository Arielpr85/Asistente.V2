// js/ui-v2.js
import { RANK_ORDER, ensureEmptyOption } from "./state-v2.js";
import { AppState, suitSymbol } from "./state-v2.js";

export function updateSuitSelectColor(select) {
  if (!select) return;

  const v = select.value;
  select.classList.remove("s-suit", "h-suit", "d-suit", "c-suit");

  let color = "#e5e7eb";

  if (v === "s") {
    select.classList.add("s-suit");
    color = "#f8f9fa";
  } else if (v === "h") {
    select.classList.add("h-suit");
    color = "#e63946";
  } else if (v === "d") {
    select.classList.add("d-suit");
    color = "#5f44e4ff";
  } else if (v === "c") {
    select.classList.add("c-suit");
    color = "#2ecc71";
  }

  select.style.color = color;
}

export function setBadge(el, label, badgeType) {
  if (!el) return;
  el.textContent = label || "—";
  el.classList.remove("badge-fold", "badge-call", "badge-raise", "badge-check");

  if (badgeType === "fold") el.classList.add("badge-fold");
  else if (badgeType === "call") el.classList.add("badge-call");
  else if (badgeType === "raise") el.classList.add("badge-raise");
  else el.classList.add("badge-check");
}

// ---------------------------
// Helpers para el nuevo JSON (action/size/reason)
// ---------------------------
function badgeTypeFromPostflopAction(action) {
  const a = (action || "").toUpperCase();
  if (a === "CHECK") return "check";
  if (a === "BET") return "raise";
  if (a === "CHECK_CALL") return "call";
  if (a === "CHECK_FOLD") return "fold";
  if (a === "CHECK_RAISE") return "raise";
  return "check";
}

function formatActionLabel(action, size) {
  const a = (action || "").toUpperCase();
  if (!a) return "—";

  if (a === "BET") {
    if (typeof size === "number") return `BET ${size}%`;
    return "BET";
  }
  if (a === "CHECK_RAISE") return "CHECK/RAISE";
  if (a === "CHECK_CALL") return "CHECK/CALL";
  if (a === "CHECK_FOLD") return "CHECK/FOLD";
  if (a === "CHECK") return "CHECK";
  return a;
}

function pickAdvice(ctx, street) {
  // Soporta varias formas para no romper con cambios en otros archivos
  // Esperado ideal:
  // ctx.flopAdvice / ctx.turnAdvice / ctx.riverAdvice = { action, size, plan, reason, id }
  if (!ctx) return null;
  const s = (street || "").toUpperCase();

  if (s === "FLOP") {
    return (
      ctx.flopAdvice ||
      ctx.flopDecision ||
      ctx.flopRecommendation ||
      ctx.lastFlopAdvice ||
      null
    );
  }
  if (s === "TURN") {
    return (
      ctx.turnAdvice ||
      ctx.turnDecision ||
      ctx.turnRecommendation ||
      ctx.lastTurnAdvice ||
      null
    );
  }
  if (s === "RIVER") {
    return (
      ctx.riverAdvice ||
      ctx.riverDecision ||
      ctx.riverRecommendation ||
      ctx.lastRiverAdvice ||
      null
    );
  }
  return null;
}

// ---------------------------
// ✅ UI UNIFICADA (tal como la tenías)
// ---------------------------
export function renderUnified() {
  // PRE
  const preLine = document.getElementById("u_preflop_line");
  const preExpl = document.getElementById("u_preflop_expl");
  const preBadge = document.getElementById("u_preflop_badge");

  // FLOP
  const flopLine = document.getElementById("u_flop_line");
  const flopExpl = document.getElementById("u_flop_expl");
  const flopBadge = document.getElementById("u_flop_badge");

  // TURN
  const turnLine = document.getElementById("u_turn_line");
  const turnExpl = document.getElementById("u_turn_expl");
  const turnBadge = document.getElementById("u_turn_badge");

  const lastDecisionContext = AppState.lastDecisionContext;
  const lastPostflopContext = AppState.lastPostflopContext;

  // --- PRE ---
  if (!lastDecisionContext) {
    const heroPosUI = document.getElementById("heroPosition")?.value || "";
    const c1r = document.getElementById("card1Rank")?.value || "";
    const c1s = document.getElementById("card1Suit")?.value || "";
    const c2r = document.getElementById("card2Rank")?.value || "";
    const c2s = document.getElementById("card2Suit")?.value || "";
    const hasHero = !!heroPosUI;
    const hasHand = !!(c1r && c1s && c2r && c2s);

    if (preLine) {
      if (!hasHero) preLine.textContent = "Elegí la posición del HERO.";
      else if (!hasHand) preLine.textContent = "Elegí 2 cartas del HERO.";
      else preLine.textContent = "Listo. Presioná 'Calcular acción' para ver preflop.";
    }
    if (preExpl) preExpl.textContent = "—";
    setBadge(preBadge, "—", "check");
  } else {
    const scen = lastDecisionContext.escenario;
    let scenTxt = "";
    if (scen === "nadie_abrió") scenTxt = "First In";
    else if (scen === "overlimp") scenTxt = "Overlimp / Iso";
    else if (scen === "vsOpen") scenTxt = `vs OR ${lastDecisionContext.villainPos || "-"}`;
    else if (scen === "vs3bet") scenTxt = `vs 3bet ${lastDecisionContext.villainPos || "-"}`;

    if (preLine) {
      preLine.textContent = `Hero ${lastDecisionContext.heroPos || "-"} · Mano ${lastDecisionContext.hand || "—"} · Spot ${scenTxt}`;
    }

    const expl =
      lastDecisionContext.explanation ||
      document.getElementById("resultExplanation")?.textContent ||
      "—";
    if (preExpl) preExpl.textContent = expl;

    setBadge(
      preBadge,
      (lastDecisionContext.mainActionLabel || "—").toUpperCase(),
      lastDecisionContext.actionType || "check"
    );
  }

  // --- FLOP ---
  if (
    !lastDecisionContext ||
    lastDecisionContext.actionType === "fold" ||
    lastDecisionContext.actionType === "check"
  ) {
    if (flopLine) flopLine.textContent = "Primero obtené un resultado preflop válido (no FOLD).";
    if (flopExpl) flopExpl.textContent = "—";
    setBadge(flopBadge, "—", "check");
  } else if (!lastPostflopContext || !lastPostflopContext.flop) {
    if (flopLine) flopLine.textContent = "Cargá el flop para calcular la línea postflop.";
    if (flopExpl) flopExpl.textContent = "—";
    setBadge(flopBadge, "—", "check");
  } else {
    const flopStr = lastPostflopContext.flop
      .map((c) => c.rank + suitSymbol(c.suit))
      .join("  ");

    const flopAdvice = pickAdvice(lastPostflopContext, "FLOP");

    if (flopLine) {
      const cat = lastPostflopContext.flopCategory || lastPostflopContext.flopCategoryKey || "—";
      const actionLbl = flopAdvice ? formatActionLabel(flopAdvice.action, flopAdvice.size) : "—";
      flopLine.textContent = `Board: ${flopStr} · Tipo: ${cat} · Línea: ${actionLbl}`;
    }

    // Preferimos reason del JSON, si no, caemos al DOM viejo
    const explDom = document.getElementById("postflopExplanation");
    const badgeDom = document.getElementById("postflopActionBadge");

    if (flopExpl) {
      flopExpl.textContent = flopAdvice?.reason || explDom?.textContent || "—";
    }

    const label =
      flopAdvice
        ? formatActionLabel(flopAdvice.action, flopAdvice.size)
        : (badgeDom?.textContent || "—");

    const type =
      flopAdvice
        ? badgeTypeFromPostflopAction(flopAdvice.action)
        : (lastPostflopContext.flopBadgeType || "check");

    setBadge(flopBadge, label, type);
  }

  // --- TURN ---
  const turnBoardDom = document.getElementById("turnBoardText");
  const turnExplDom = document.getElementById("turnExplanation");
  const turnBadgeDom = document.getElementById("turnActionBadge");

  if (!lastPostflopContext || !lastPostflopContext.flop) {
    if (turnLine) turnLine.textContent = "Esperando flop + carta turn.";
    if (turnExpl) turnExpl.textContent = "—";
    setBadge(turnBadge, "—", "check");
  } else {
    const turnAdvice = pickAdvice(lastPostflopContext, "TURN");

    if (turnLine) {
      // Si tu módulo turn actual escribe "Board turn: ..." lo respetamos
      // Si no, lo armamos desde ctx (si existe turn)
      const domText = turnBoardDom?.textContent;
      if (domText && domText.trim() && domText !== "Board turn: —") {
        turnLine.textContent = domText;
      } else if (lastPostflopContext.turn) {
        const turnStr = [...lastPostflopContext.flop, lastPostflopContext.turn]
          .map((c) => c.rank + suitSymbol(c.suit))
          .join("  ");
        turnLine.textContent = `Board turn: ${turnStr}`;
      } else {
        turnLine.textContent = "Board turn: —";
      }
    }

    if (turnExpl) {
      turnExpl.textContent = turnAdvice?.reason || turnExplDom?.textContent || "—";
    }

    const label =
      turnAdvice
        ? formatActionLabel(turnAdvice.action, turnAdvice.size)
        : (turnBadgeDom?.textContent || "—");

    const type =
      turnAdvice
        ? badgeTypeFromPostflopAction(turnAdvice.action)
        : (() => {
            const lbl = (turnBadgeDom?.textContent || "").toUpperCase();
            if (lbl.includes("FOLD")) return "fold";
            if (lbl.includes("CALL")) return "call";
            if (lbl.includes("CHECK")) return "check";
            if (lbl.includes("BET") || lbl.includes("RAISE")) return "raise";
            return "check";
          })();

    setBadge(turnBadge, label, type);
  }
}

// ---------------------------
// Poblado de selects (lo pasamos acá para ordenar)
// ---------------------------

export function poblarSelectsPosiciones(POSITIONS) {
  const heroSelect = document.getElementById("heroPosition");
  const villainSelect = document.getElementById("villainPosition");
  if (!heroSelect || !villainSelect) return;

  heroSelect.innerHTML = "";
  villainSelect.innerHTML = "";

  const optH0 = document.createElement("option");
  optH0.value = "";
  optH0.textContent = "Seleccionar...";
  heroSelect.appendChild(optH0);

  const optV0 = document.createElement("option");
  optV0.value = "";
  optV0.textContent = "Seleccionar...";
  villainSelect.appendChild(optV0);

  POSITIONS.forEach((pos) => {
    const optH = document.createElement("option");
    optH.value = pos;
    optH.textContent = pos;
    heroSelect.appendChild(optH);

    const optV = document.createElement("option");
    optV.value = pos;
    optV.textContent = pos;
    villainSelect.appendChild(optV);
  });

  heroSelect.value = "";
  villainSelect.value = "";
}

export function poblarSelectsDeCartas() {
  const card1Rank = document.getElementById("card1Rank");
  const card2Rank = document.getElementById("card2Rank");
  const card1Suit = document.getElementById("card1Suit");
  const card2Suit = document.getElementById("card2Suit");
  if (!card1Rank || !card2Rank) return;

  card1Rank.innerHTML = "";
  card2Rank.innerHTML = "";

  // placeholder
  {
    const e1 = document.createElement("option");
    e1.value = "";
    e1.textContent = "-";
    card1Rank.appendChild(e1);

    const e2 = document.createElement("option");
    e2.value = "";
    e2.textContent = "-";
    card2Rank.appendChild(e2);
  }

  RANK_ORDER.forEach((r) => {
    const opt1 = document.createElement("option");
    opt1.value = r;
    opt1.textContent = r;
    card1Rank.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = r;
    opt2.textContent = r;
    card2Rank.appendChild(opt2);
  });

  card1Rank.value = "";
  card2Rank.value = "";

  [card1Suit, card2Suit].forEach((s) => {
    ensureEmptyOption(s, "-");
    if (s) s.value = "";
  });
}

export function poblarSelectsFlop() {
  const flopRankIds = ["flop1Rank", "flop2Rank", "flop3Rank"];

  flopRankIds.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;

    sel.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "–";
    placeholder.selected = true;
    sel.appendChild(placeholder);

    RANK_ORDER.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      sel.appendChild(opt);
    });

    sel.value = "";
  });
}

export function poblarSelectTurn() {
  const rankSel = document.getElementById("turnRank");
  if (!rankSel) return;

  rankSel.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "–";
  placeholder.selected = true;
  rankSel.appendChild(placeholder);

  RANK_ORDER.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    rankSel.appendChild(opt);
  });

  rankSel.value = "";
}

export function poblarSelectRiver() {
  const rankSel = document.getElementById("riverRank");
  const suitSel = document.getElementById("riverSuit");
  if (!rankSel) return;

  rankSel.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "–";
  placeholder.selected = true;
  rankSel.appendChild(placeholder);

  RANK_ORDER.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    rankSel.appendChild(opt);
  });

  rankSel.value = "";

  if (suitSel) {
    ensureEmptyOption(suitSel, "-");
    suitSel.value = "";
  }
}

