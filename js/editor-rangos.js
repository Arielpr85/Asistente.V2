// editor-rangos.js

// Orden de rangos igual que en el asistente
const RANK_ORDER = [
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

// Misma función que usa el asistente para nombrar las manos
function normalizarMano(r1, r2, isSuited) {
  // Parejas: AA, KK, QQ... (sin 's' ni 'o')
  if (r1 === r2) {
    return r1 + r2;
  }

  const i1 = RANK_ORDER.indexOf(r1);
  const i2 = RANK_ORDER.indexOf(r2);

  let high = r1;
  let low = r2;

  // high = carta "más alta" según RANK_ORDER
  if (i2 < i1) {
    high = r2;
    low = r1;
  }

  return high + low + (isSuited ? "s" : "o");
}

// MISMA CLAVE QUE usa el asistente
const RANGES_STORAGE_KEY = "preflopRangesNL5";
const RANGES_JSON_URL = "ranges-nl5-9max.json";

const POSITIONS = ["UTG", "UTG1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

const SPOT_TYPES = {
  FIRST_IN: "firstIn",
  OVERLIMP: "overLimp",
  VS_OPEN: "vsOpen",
  VS_3BET: "vs3bet",
};

// Acciones por tipo de spot
// "none" = FOLD (no se guarda en JSON)
const ACTIONS_BY_SPOT = {
  [SPOT_TYPES.FIRST_IN]: [
    { value: "none", label: "FOLD", cssClass: "action-fold" },
    { value: "openRaise", label: "OR", cssClass: "action-open" },
    { value: "openLimp", label: "LIMP", cssClass: "action-call" },
  ],
  [SPOT_TYPES.OVERLIMP]: [
    { value: "none", label: "FOLD", cssClass: "action-fold" },
    { value: "overLimp", label: "OL", cssClass: "action-call" },
    { value: "isoRaise", label: "ISO", cssClass: "action-3bet" },
  ],
  [SPOT_TYPES.VS_OPEN]: [
    { value: "none", label: "FOLD", cssClass: "action-fold" },
    { value: "call", label: "CALL", cssClass: "action-call" },
    { value: "threeBet", label: "3BET", cssClass: "action-3bet" },
  ],
  [SPOT_TYPES.VS_3BET]: [
    { value: "none", label: "FOLD", cssClass: "action-fold" },
    { value: "call", label: "CALL", cssClass: "action-call" },
    { value: "fourBet", label: "4BET", cssClass: "action-4bet" },
  ],
};

let rangesData = null;

document.addEventListener("DOMContentLoaded", async () => {
  const heroSelect = document.getElementById("heroPosition");
  const spotTypeSelect = document.getElementById("spotType");
  const villainSelect = document.getElementById("villainPosition");
  const jsonOutput = document.getElementById("jsonOutput");
  const btnCopyJson = document.getElementById("btnCopyJson");
  const btnDownloadJson = document.getElementById("btnDownloadJson");
  const gridContainer = document.getElementById("rangeGrid");

  window._editorRefs = {
    heroSelect,
    spotTypeSelect,
    villainSelect,
    jsonOutput,
    gridContainer,
  };

  await cargarEstadoInicial();
  poblarSelectsPosiciones(heroSelect, villainSelect);
  configurarSelects(spotTypeSelect, villainSelect);
  crearGrid(gridContainer);
  refrescarGridDesdeEstado();
  actualizarSalidaJson();

  if (btnCopyJson) {
    btnCopyJson.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(jsonOutput.value);
        alert("JSON copiado al portapapeles ✅");
      } catch (err) {
        alert("No se pudo copiar el JSON. Copiá manualmente.");
      }
    });
  }

  if (btnDownloadJson) {
    btnDownloadJson.addEventListener("click", () => {
      const blob = new Blob([jsonOutput.value], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ranges-nl5-9max-editado.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
});

// ------------- Carga / guardado -------------

async function cargarEstadoInicial() {
  const stored = localStorage.getItem(RANGES_STORAGE_KEY);
  if (stored) {
    try {
      rangesData = JSON.parse(stored);
      console.log("✅ Rangos cargados desde localStorage");
      normalizarEstructura();
      return;
    } catch (e) {
      console.warn("No se pudo parsear JSON de localStorage:", e);
    }
  }

  try {
    const res = await fetch(RANGES_JSON_URL);
    if (!res.ok) {
      console.warn("No se pudo cargar JSON base:", res.status);
      rangesData = crearJsonBaseVacio();
      guardarEnLocalStorage();
      return;
    }
    rangesData = await res.json();
    console.log("✅ Rangos cargados desde archivo JSON base");
    normalizarEstructura();
    guardarEnLocalStorage();
  } catch (e) {
    console.warn("Error al hacer fetch del JSON base:", e);
    rangesData = crearJsonBaseVacio();
    guardarEnLocalStorage();
  }
}

function crearJsonBaseVacio() {
  const positionsObj = {};
  POSITIONS.forEach((pos) => {
    positionsObj[pos] = {
      firstIn: { openRaise: [], openLimp: [] },
      overLimp: { overLimp: [], isoRaise: [] },
      vsOpen: {},
      vs3bet: {},
    };
  });

  return {
    gameInfo: {
      game: "NL5",
      stakes: "0.02/0.05",
      tableType: "9max",
      style: "TAG explotativo",
      description: "Rangos preflop explotativos para NL5 online, hasta 4bet.",
    },
    legend: {
      openRaise: "Open raise estándar",
      openLimp: "Limp sin acción previa",
      overLimp: "Limp después de uno o más limpers",
      isoRaise: "Raise para aislar limpers",
      call: "Call / cold call",
      threeBet: "3bet",
      fourBet: "4bet (por valor o shove)",
    },
    positions: positionsObj,
  };
}

function normalizarEstructura() {
  if (!rangesData) rangesData = {};
  if (!rangesData.gameInfo) {
    rangesData.gameInfo = {
      game: "NL5",
      stakes: "0.02/0.05",
      tableType: "9max",
      style: "TAG explotativo",
      description: "Rangos preflop explotativos para NL5 online, hasta 4bet.",
    };
  }
  if (!rangesData.legend) {
    rangesData.legend = {
      openRaise: "Open raise estándar",
      openLimp: "Limp sin acción previa",
      overLimp: "Limp después de uno o más limpers",
      isoRaise: "Raise para aislar limpers",
      call: "Call / cold call",
      threeBet: "3bet",
      fourBet: "4bet (por valor o shove)",
    };
  }
  if (!rangesData.positions) {
    rangesData.positions = {};
  }

  POSITIONS.forEach((pos) => {
    if (!rangesData.positions[pos]) {
      rangesData.positions[pos] = {
        firstIn: { openRaise: [], openLimp: [] },
        overLimp: { overLimp: [], isoRaise: [] },
        vsOpen: {},
        vs3bet: {},
      };
    } else {
      const h = rangesData.positions[pos];
      if (!h.firstIn) h.firstIn = { openRaise: [], openLimp: [] };
      if (!h.firstIn.openRaise) h.firstIn.openRaise = [];
      if (!h.firstIn.openLimp) h.firstIn.openLimp = [];
      if (!h.overLimp) h.overLimp = { overLimp: [], isoRaise: [] };
      if (!h.overLimp.overLimp) h.overLimp.overLimp = [];
      if (!h.overLimp.isoRaise) h.overLimp.isoRaise = [];
      if (!h.vsOpen) h.vsOpen = {};
      if (!h.vs3bet) h.vs3bet = {};
    }
  });
}

function guardarEnLocalStorage() {
  try {
    localStorage.setItem(RANGES_STORAGE_KEY, JSON.stringify(rangesData));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage:", e);
  }
}

function actualizarSalidaJson() {
  const { jsonOutput } = window._editorRefs;
  if (!jsonOutput) return;
  jsonOutput.value = JSON.stringify(rangesData, null, 2);
}

// ------------- UI / selects / grid -------------

function poblarSelectsPosiciones(heroSelect, villainSelect) {
  if (!heroSelect || !villainSelect) return;

  POSITIONS.forEach((pos) => {
    const optHero = document.createElement("option");
    optHero.value = pos;
    optHero.textContent = pos;
    heroSelect.appendChild(optHero);

    const optVillain = document.createElement("option");
    optVillain.value = pos;
    optVillain.textContent = pos;
    villainSelect.appendChild(optVillain);
  });

  heroSelect.value = "BB";
  villainSelect.value = "BTN";
}

function configurarSelects(spotTypeSelect, villainSelect) {
  const { heroSelect } = window._editorRefs;

  function actualizarVillainEnabled() {
    const spotType = spotTypeSelect.value;
    if (spotType === SPOT_TYPES.VS_OPEN || spotType === SPOT_TYPES.VS_3BET) {
      villainSelect.disabled = false;
    } else {
      villainSelect.disabled = true;
    }
  }

  spotTypeSelect.addEventListener("change", () => {
    actualizarVillainEnabled();
    refrescarGridDesdeEstado();
  });

  heroSelect.addEventListener("change", () => {
    refrescarGridDesdeEstado();
  });

  villainSelect.addEventListener("change", () => {
    refrescarGridDesdeEstado();
  });

  actualizarVillainEnabled();
}

function crearGrid(gridContainer) {
  if (!gridContainer) return;

  const ranks = [
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
  gridContainer.innerHTML = "";

  for (let i = 0; i < ranks.length; i++) {
    for (let j = 0; j < ranks.length; j++) {
      const r1 = ranks[i];
      const r2 = ranks[j];

      let hand;

      if (i === j) {
        // pareja: AA, KK, QQ...
        hand = r1 + r2;
      } else if (i < j) {
        // zona suited del tablero
        hand = normalizarMano(r1, r2, true); // ej: AQs, Q8s, etc.
      } else {
        // zona offsuit del tablero
        hand = normalizarMano(r1, r2, false); // ej: AKo, Q8o, etc.
      }

      const cell = document.createElement("button");
      cell.type = "button";
      cell.classList.add("range-cell", "action-fold");
      cell.dataset.hand = hand;
      cell.dataset.action = "none";
      cell.textContent = hand;

      cell.addEventListener("click", () => {
        manejarClickEnMano(cell);
      });

      gridContainer.appendChild(cell);
    }
  }
}

// ------------- Lógica de acciones -------------

function manejarClickEnMano(cell) {
  const { heroSelect, spotTypeSelect, villainSelect } = window._editorRefs;
  const hero = heroSelect.value;
  const spotType = spotTypeSelect.value;
  const villain = villainSelect.value;

  if (!hero) {
    alert("Primero elegí tu posición (Hero).");
    return;
  }
  if (!spotType) {
    alert("Primero elegí el tipo de spot.");
    return;
  }
  if (
    (spotType === SPOT_TYPES.VS_OPEN || spotType === SPOT_TYPES.VS_3BET) &&
    !villain
  ) {
    alert("Elegí la posición del villano para spots vs Open / vs 3bet.");
    return;
  }

  const hand = cell.dataset.hand;
  const actionsArray = ACTIONS_BY_SPOT[spotType];
  if (!actionsArray) return;

  const currentValue = cell.dataset.action || "none";
  let currentIndex = actionsArray.findIndex((a) => a.value === currentValue);
  if (currentIndex === -1) currentIndex = 0;
  const nextIndex = (currentIndex + 1) % actionsArray.length;
  const nextAction = actionsArray[nextIndex];

  cell.classList.remove(
    "action-fold",
    "action-open",
    "action-call",
    "action-3bet",
    "action-4bet"
  );

  cell.classList.add(nextAction.cssClass);
  cell.dataset.action = nextAction.value;

  setAccionEnJson(hero, spotType, villain, hand, nextAction.value);
  guardarEnLocalStorage();
  actualizarSalidaJson();
}

function refrescarGridDesdeEstado() {
  const { heroSelect, spotTypeSelect, villainSelect, gridContainer } =
    window._editorRefs;
  if (!gridContainer || !rangesData) return;

  const hero = heroSelect.value;
  const spotType = spotTypeSelect.value;
  const villain = villainSelect.value;
  const actionsArray = ACTIONS_BY_SPOT[spotType] || [];

  const cells = gridContainer.querySelectorAll(".range-cell");
  cells.forEach((cell) => {
    const hand = cell.dataset.hand;
    let actionValue = "none";

    if (hero && spotType && rangesData.positions) {
      actionValue = getAccionDesdeJson(hero, spotType, villain, hand);
    }

    cell.classList.remove(
      "action-fold",
      "action-open",
      "action-call",
      "action-3bet",
      "action-4bet"
    );

    const actionObj = actionsArray.find((a) => a.value === actionValue) ||
      actionsArray[0] || {
        value: "none",
        cssClass: "action-fold",
      };

    cell.classList.add(actionObj.cssClass);
    cell.dataset.action = actionObj.value;
  });

  actualizarSalidaJson();
}

function getAccionDesdeJson(hero, spotType, villain, hand) {
  const positions = rangesData.positions || {};
  const heroNode = positions[hero];
  if (!heroNode) return "none";

  if (spotType === SPOT_TYPES.FIRST_IN) {
    const fi = heroNode.firstIn || {};
    const orArr = fi.openRaise || [];
    const limpArr = fi.openLimp || [];
    if (orArr.includes(hand)) return "openRaise";
    if (limpArr.includes(hand)) return "openLimp";
    return "none";
  }

  if (spotType === SPOT_TYPES.OVERLIMP) {
    const ol = heroNode.overLimp || {};
    const overArr = ol.overLimp || [];
    const isoArr = ol.isoRaise || [];
    if (overArr.includes(hand)) return "overLimp";
    if (isoArr.includes(hand)) return "isoRaise";
    return "none";
  }

  if (spotType === SPOT_TYPES.VS_OPEN) {
    if (!villain) return "none";
    const vo = heroNode.vsOpen || {};
    const key = "vs" + villain;
    const slot = vo[key] || {};
    const callArr = slot.call || [];
    const threeArr = slot.threeBet || [];
    if (callArr.includes(hand)) return "call";
    if (threeArr.includes(hand)) return "threeBet";
    return "none";
  }

  if (spotType === SPOT_TYPES.VS_3BET) {
    if (!villain) return "none";
    const v3 = heroNode.vs3bet || {};
    const key = "vs" + villain;
    const slot = v3[key] || {};
    const callArr = slot.call || [];
    const fourArr = slot.fourBet || [];
    if (callArr.includes(hand)) return "call";
    if (fourArr.includes(hand)) return "fourBet";
    return "none";
  }

  return "none";
}

function setAccionEnJson(hero, spotType, villain, hand, actionValue) {
  if (!rangesData.positions) rangesData.positions = {};
  if (!rangesData.positions[hero]) {
    rangesData.positions[hero] = {
      firstIn: { openRaise: [], openLimp: [] },
      overLimp: { overLimp: [], isoRaise: [] },
      vsOpen: {},
      vs3bet: {},
    };
  }
  const heroNode = rangesData.positions[hero];

  if (spotType === SPOT_TYPES.FIRST_IN) {
    if (!heroNode.firstIn) heroNode.firstIn = { openRaise: [], openLimp: [] };
    const fi = heroNode.firstIn;
    fi.openRaise = (fi.openRaise || []).filter((h) => h !== hand);
    fi.openLimp = (fi.openLimp || []).filter((h) => h !== hand);
    if (actionValue === "openRaise") fi.openRaise.push(hand);
    else if (actionValue === "openLimp") fi.openLimp.push(hand);
    return;
  }

  if (spotType === SPOT_TYPES.OVERLIMP) {
    if (!heroNode.overLimp) heroNode.overLimp = { overLimp: [], isoRaise: [] };
    const ol = heroNode.overLimp;
    ol.overLimp = (ol.overLimp || []).filter((h) => h !== hand);
    ol.isoRaise = (ol.isoRaise || []).filter((h) => h !== hand);
    if (actionValue === "overLimp") ol.overLimp.push(hand);
    else if (actionValue === "isoRaise") ol.isoRaise.push(hand);
    return;
  }

  if (spotType === SPOT_TYPES.VS_OPEN) {
    if (!villain) return;
    if (!heroNode.vsOpen) heroNode.vsOpen = {};
    const key = "vs" + villain;
    if (!heroNode.vsOpen[key])
      heroNode.vsOpen[key] = { call: [], threeBet: [] };
    const slot = heroNode.vsOpen[key];
    slot.call = (slot.call || []).filter((h) => h !== hand);
    slot.threeBet = (slot.threeBet || []).filter((h) => h !== hand);
    if (actionValue === "call") slot.call.push(hand);
    else if (actionValue === "threeBet") slot.threeBet.push(hand);
    return;
  }

  if (spotType === SPOT_TYPES.VS_3BET) {
    if (!villain) return;
    if (!heroNode.vs3bet) heroNode.vs3bet = {};
    const key = "vs" + villain;
    if (!heroNode.vs3bet[key]) heroNode.vs3bet[key] = { call: [], fourBet: [] };
    const slot = heroNode.vs3bet[key];
    slot.call = (slot.call || []).filter((h) => h !== hand);
    slot.fourBet = (slot.fourBet || []).filter((h) => h !== hand);
    if (actionValue === "call") slot.call.push(hand);
    else if (actionValue === "fourBet") slot.fourBet.push(hand);
    return;
  }
}
