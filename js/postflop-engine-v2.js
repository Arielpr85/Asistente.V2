// js/postflop-engine-v2.js
// Engine de reglas V2: carga JSON, evalúa condiciones y devuelve acción.

// -----------------------------
// Formato de acción para UI (alineado al JSON v2: sin MIX)
// -----------------------------
export function formatAction(action, size) {
  const a = String(action || "").toUpperCase().trim();
  if (!a) return "—";

  if (a === "CHECK") return "CHECK";
  if (a === "BET") return typeof size === "number" ? `BET ${size}%` : "BET";

  if (a === "CHECK_CALL") return "CHECK/CALL";
  if (a === "CHECK_FOLD") return "CHECK/FOLD";
  if (a === "CHECK_RAISE") return "CHECK/RAISE";

  return typeof size === "number" ? `${a} ${size}%` : a;
}

// -----------------------------
// Loader de reglas
// -----------------------------
export async function loadPostflopRulesV2(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} cargando ${url}`);
  const json = await res.json();
  return json;
}

// -----------------------------
// Evaluador de condiciones (when)
// -----------------------------
export function evaluatePostflopRule(rule, ctx) {
  if (!rule?.when) return true;
  return evalNode(rule.when, ctx);
}

function getCtxValue(ctx, key) {
  return ctx?.[key];
}

function evalNode(node, ctx) {
  if (!node || typeof node !== "object") return false;

  // Combinadores
  if (Array.isArray(node.all)) return node.all.every((n) => evalNode(n, ctx));
  if (Array.isArray(node.any)) return node.any.some((n) => evalNode(n, ctx));

  // Operadores
  if (node.eq) {
    const [k, v] = node.eq;
    return getCtxValue(ctx, k) === v;
  }

  if (node.in) {
    const [k, arr] = node.in;
    const val = getCtxValue(ctx, k);
    return Array.isArray(arr) ? arr.includes(val) : false;
  }

  if (node.gte) {
    const [k, v] = node.gte;
    const val = Number(getCtxValue(ctx, k));
    return Number.isFinite(val) && val >= Number(v);
  }

  if (node.lte) {
    const [k, v] = node.lte;
    const val = Number(getCtxValue(ctx, k));
    return Number.isFinite(val) && val <= Number(v);
  }

  if (node.gt) {
    const [k, v] = node.gt;
    const val = Number(getCtxValue(ctx, k));
    return Number.isFinite(val) && val > Number(v);
  }

  if (node.lt) {
    const [k, v] = node.lt;
    const val = Number(getCtxValue(ctx, k));
    return Number.isFinite(val) && val < Number(v);
  }

  return false;
}

// -----------------------------
// Selector de acción por ruleset
// -----------------------------
export function pickPostflopActionV2(rulesJson, ctx) {
  if (!rulesJson?.rulesets) {
    return {
      action: "CHECK",
      size: null,
      plan: "NONE",
      reason: "Sin reglas cargadas",
      ruleId: null,
    };
  }

  const pos = ctx?.pos; // "IP" / "OOP"
  const street = ctx?.street; // "FLOP" / "TURN" / "RIVER"

  const list = rulesJson?.rulesets?.[pos]?.[street];
  if (!Array.isArray(list) || !list.length) {
    return {
      action: "CHECK",
      size: null,
      plan: "NONE",
      reason: `No hay ruleset para ${pos}/${street}`,
      ruleId: null,
    };
  }

  // prioridad menor = primero
  const sorted = [...list].sort(
    (a, b) => (a.priority ?? 9999) - (b.priority ?? 9999)
  );

  for (const rule of sorted) {
    if (evaluatePostflopRule(rule, ctx)) {
      const d = rule.do || {};
      return {
        action: d.action ?? "CHECK",
        size: d.size ?? null,
        plan: d.plan ?? "NONE",
        reason: d.reason ?? rule.id ?? "match",
        ruleId: rule.id ?? null,
      };
    }
  }

  return {
    action: "CHECK",
    size: null,
    plan: "NONE",
    reason: "Ninguna regla matcheó (fallback)",
    ruleId: null,
  };
}

window.pickPostflopActionV2 = pickPostflopActionV2;

