// js/table-ui.js
(() => {
  const btnSelectHero = document.getElementById("btnSelectHero");
  const btnSelectVillain = document.getElementById("btnSelectVillain");
  const btnClearPositions = document.getElementById("btnClearPositions");

  const heroSelect = document.getElementById("heroPosition");
  const villainSelect = document.getElementById("villainPosition");
  const seats = document.querySelectorAll(".poker-seat");

  const summaryHeroPos = document.getElementById("summaryHeroPos");
  const summaryVillainPos = document.getElementById("summaryVillainPos");
  const summaryHeroHand = document.getElementById("summaryHeroHand");
  const summaryFlop = document.getElementById("summaryFlop");
  const summaryTurn = document.getElementById("summaryTurn");
  const summaryRiver = document.getElementById("summaryRiver");

  const cardGrid = document.getElementById("cardGrid");
  const targetButtons = document.querySelectorAll(".card-target-btn");

  // ✅ NUEVO: perfil del rival (para villainProfile en el JSON)
  // (si no existe en tu HTML, no rompe nada)
  const villainProfileSelect = document.getElementById("villainProfile");

  if (
    !btnSelectHero ||
    !btnSelectVillain ||
    !heroSelect ||
    !villainSelect ||
    !cardGrid ||
    !targetButtons.length
  )
    return;

  // -------------------------------
  // Bloqueo de cartas ya usadas
  // -------------------------------
  function getSelectedKeysFromSelects() {
    const ids = [
      ["card1Rank", "card1Suit"],
      ["card2Rank", "card2Suit"],
      ["flop1Rank", "flop1Suit"],
      ["flop2Rank", "flop2Suit"],
      ["flop3Rank", "flop3Suit"],
      ["turnRank", "turnSuit"],
      ["riverRank", "riverSuit"],
    ];

    const used = new Set();
    ids.forEach(([rId, sId]) => {
      const r = document.getElementById(rId)?.value || "";
      const s = document.getElementById(sId)?.value || "";
      if (r && s) used.add(`${r}${s}`);
    });
    return used;
  }

  function updateGridLocks() {
    const used = getSelectedKeysFromSelects();
    document.querySelectorAll(".card-cell").forEach((cell) => {
      const key = `${cell.dataset.rank}${cell.dataset.suit}`;
      const locked = used.has(key);
      cell.classList.toggle("disabled", locked);
      cell.disabled = locked;
    });
  }

  // -------------------------------
  // ✅ Scenario tabs (botones) -> select #scenario
  // -------------------------------
  (function initScenarioTabs() {
    const scenarioSelect = document.getElementById("scenario");
    const tabs = document.getElementById("scenarioTabs");
    if (!scenarioSelect || !tabs) return;

    const btns = tabs.querySelectorAll(".scenario-btn");

    function setScenario(value) {
      scenarioSelect.value = value;

      // marcar active
      btns.forEach((b) =>
        b.classList.toggle("active", b.dataset.value === value)
      );

      // avisar al resto del sistema
      scenarioSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // click en botones
    btns.forEach((btn) => {
      btn.addEventListener("click", () => setScenario(btn.dataset.value));
    });

    // si algo cambia el select por atrás, reflejarlo en botones
    scenarioSelect.addEventListener("change", () => {
      const v = scenarioSelect.value;
      btns.forEach((b) => b.classList.toggle("active", b.dataset.value === v));
    });

    // init (por si el select ya tiene algo)
    setScenario(scenarioSelect.value || "nadie_abrió");
  })();

  // -------------------------------
  // ✅ NUEVO: villainProfile select -> disparar change para que el engine lo lea
  // -------------------------------
  (function initVillainProfileSync() {
    if (!villainProfileSelect) return;

    // si viene vacío, default "DEFAULT" (no pisa si ya tiene valor)
    if (!villainProfileSelect.value) {
      villainProfileSelect.value = "DEFAULT";
    }

    villainProfileSelect.addEventListener("change", () => {
      villainProfileSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  })();

  // -------------------------------
  // Estado de posiciones y cartas
  // -------------------------------
  let selecting = "hero";
  let heroSeatEl = null;
  let villainSeatEl = null;

  const state = {
    hero1: null,
    hero2: null,
    flop1: null,
    flop2: null,
    flop3: null,
    turn: null,
    river: null,
  };

  // Cuando asistente.js limpia cartas -> sincronizamos UI
  document.addEventListener("cards:cleared", () => {
    Object.keys(state).forEach((k) => (state[k] = null));

    const rl = document.getElementById("u_river_line");
    const rc = document.getElementById("u_river_context");
    const ra = document.getElementById("u_river_action");
    if (rl) rl.textContent = "Esperando turn + river.";
    if (rc) rc.textContent = "—";
    if (ra) {
      ra.textContent = "—";
      ra.className = "badge badge-check mt-2";
    }

    updateBoardSummary();
    updateGridLocks();
    setActiveTarget("hero1");
  });

  function formatCard(rank, suit) {
    if (!rank || !suit) return "";
    const symbols = { s: "♠", h: "♥", d: "♦", c: "♣" };
    const css = { s: "suit-s", h: "suit-h", d: "suit-d", c: "suit-c" };
    return `<span class="summary-card ${css[suit] || ""}">${rank}${
      symbols[suit] || "?"
    }</span>`;
  }

  function updateBoardSummary() {
    summaryHeroPos.textContent = heroSelect.value || "–";
    summaryVillainPos.textContent = villainSelect.value || "–";

    summaryHeroHand.innerHTML =
      state.hero1 && state.hero2
        ? `${formatCard(state.hero1.rank, state.hero1.suit)} ${formatCard(
            state.hero2.rank,
            state.hero2.suit
          )}`
        : "–";

    summaryFlop.innerHTML =
      state.flop1 && state.flop2 && state.flop3
        ? `${formatCard(state.flop1.rank, state.flop1.suit)} ${formatCard(
            state.flop2.rank,
            state.flop2.suit
          )} ${formatCard(state.flop3.rank, state.flop3.suit)}`
        : "–";

    summaryTurn.innerHTML = state.turn
      ? formatCard(state.turn.rank, state.turn.suit)
      : "–";
    summaryRiver.innerHTML = state.river
      ? formatCard(state.river.rank, state.river.suit)
      : "–";
  }

  // -------------------------------
  // Botones HERO/VILLANO
  // -------------------------------
  btnSelectHero.addEventListener("click", () => {
    selecting = "hero";
    btnSelectHero.classList.add("active");
    btnSelectVillain.classList.remove("active");
  });

  btnSelectVillain.addEventListener("click", () => {
    selecting = "villain";
    btnSelectVillain.classList.add("active");
    btnSelectHero.classList.remove("active");
  });

  btnClearPositions?.addEventListener("click", () => {
    heroSelect.value = "";
    villainSelect.value = "";
    heroSeatEl = null;
    villainSeatEl = null;
    seats.forEach((s) =>
      s.classList.remove("hero-selected", "villain-selected")
    );
    updateBoardSummary();
  });

  seats.forEach((seat) => {
    seat.addEventListener("click", () => {
      const pos = seat.dataset.pos;
      if (!pos) return;

      if (selecting === "hero") {
        if (heroSeatEl === seat) {
          seat.classList.remove("hero-selected");
          heroSeatEl = null;
          heroSelect.value = "";
        } else {
          heroSelect.value = pos;
          heroSeatEl?.classList.remove("hero-selected");
          seat.classList.add("hero-selected");
          heroSeatEl = seat;
        }
      } else {
        if (villainSeatEl === seat) {
          seat.classList.remove("villain-selected");
          villainSeatEl = null;
          villainSelect.value = "";
        } else {
          villainSelect.value = pos;
          villainSeatEl?.classList.remove("villain-selected");
          seat.classList.add("villain-selected");
          villainSeatEl = seat;
        }
      }

      updateBoardSummary();
    });
  });

  // -------------------------------
  // ✅ Auto-salto inteligente de target
  // Hero1 -> Hero2 -> Flop1 -> Flop2 -> Flop3 -> Turn -> River
  // salta al próximo SLOT VACÍO
  // -------------------------------
  const FLOW = ["hero1", "hero2", "flop1", "flop2", "flop3", "turn", "river"];
  let currentTarget = "hero1";

  function setActiveTarget(target) {
    currentTarget = target;
    targetButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.target === target)
    );
  }

  function isSlotFilled(target) {
    const map = {
      hero1: ["card1Rank", "card1Suit"],
      hero2: ["card2Rank", "card2Suit"],
      flop1: ["flop1Rank", "flop1Suit"],
      flop2: ["flop2Rank", "flop2Suit"],
      flop3: ["flop3Rank", "flop3Suit"],
      turn: ["turnRank", "turnSuit"],
      river: ["riverRank", "riverSuit"],
    };

    const pair = map[target];
    if (!pair) return false;

    const r = document.getElementById(pair[0])?.value || "";
    const s = document.getElementById(pair[1])?.value || "";
    return !!(r && s);
  }

  function findNextEmptyFrom(target) {
    const startIdx = Math.max(0, FLOW.indexOf(target));
    for (let i = startIdx; i < FLOW.length; i++) {
      if (!isSlotFilled(FLOW[i])) return FLOW[i];
    }
    return "river"; // si todo está lleno, quedate en river
  }

  function autoAdvanceTargetSmart() {
    const idx = FLOW.indexOf(currentTarget);
    if (idx === -1) return;

    // buscamos desde el slot siguiente
    const nextStart = FLOW[Math.min(idx + 1, FLOW.length - 1)];
    const nextEmpty = findNextEmptyFrom(nextStart);
    setActiveTarget(nextEmpty);
  }

  // clicks manuales siguen funcionando
  targetButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTarget(btn.dataset.target));
  });

  // Init
  setActiveTarget(findNextEmptyFrom("hero1"));

  // -------------------------------
  // Grid 52 cartas
  // -------------------------------
  const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const SUITS = [
    { code: "s", symbol: "♠", css: "suit-s" },
    { code: "h", symbol: "♥", css: "suit-h" },
    { code: "d", symbol: "♦", css: "suit-d" },
    { code: "c", symbol: "♣", css: "suit-c" },
  ];

  function setPair(rankId, suitId, rank, suit) {
    const r = document.getElementById(rankId);
    const s = document.getElementById(suitId);
    if (!r || !s) return;

    r.value = rank;
    s.value = suit;

    // avisar a tus módulos
    r.dispatchEvent(new Event("change", { bubbles: true }));
    s.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function assignCard(target, rank, suit) {
    if (target === "hero1") {
      setPair("card1Rank", "card1Suit", rank, suit);
      state.hero1 = { rank, suit };
    } else if (target === "hero2") {
      setPair("card2Rank", "card2Suit", rank, suit);
      state.hero2 = { rank, suit };
    } else if (target === "flop1") {
      setPair("flop1Rank", "flop1Suit", rank, suit);
      state.flop1 = { rank, suit };
    } else if (target === "flop2") {
      setPair("flop2Rank", "flop2Suit", rank, suit);
      state.flop2 = { rank, suit };
    } else if (target === "flop3") {
      setPair("flop3Rank", "flop3Suit", rank, suit);
      state.flop3 = { rank, suit };
    } else if (target === "turn") {
      setPair("turnRank", "turnSuit", rank, suit);
      state.turn = { rank, suit };
    } else if (target === "river") {
      setPair("riverRank", "riverSuit", rank, suit);
      state.river = { rank, suit };
    }

    // ✅ NUEVO: trigger para que el engine recalcule postflop cuando cambia el board
    // (si no tenés listeners, no pasa nada; si los tenés, te mantiene todo sincronizado)
    document.dispatchEvent(new CustomEvent("board:changed", { detail: { target, rank, suit } }));

    updateBoardSummary();
    updateGridLocks();

    autoAdvanceTargetSmart();
  }

  SUITS.forEach((suitInfo) => {
    RANKS.forEach((rank) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `card-cell ${suitInfo.css}`;
      btn.dataset.rank = rank;
      btn.dataset.suit = suitInfo.code;
      btn.textContent = `${rank}${suitInfo.symbol}`;

      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        assignCard(currentTarget, rank, suitInfo.code);
      });

      cardGrid.appendChild(btn);
    });

    const br = document.createElement("div");
    br.style.gridColumn = "1 / -1";
    br.style.height = "6px";
    cardGrid.appendChild(br);
  });

  // Init
  updateBoardSummary();
  updateGridLocks();

  // por si querés llamarla desde consola o desde otros scripts:
  window.updateBoardSummary = updateBoardSummary;
})();
