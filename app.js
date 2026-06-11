(function () {
  const VERBS = window.VERBS;
  const STORAGE_KEY = "verbs-state-v1";

  const state = load() || {
    mode: "all",          // all | easy | medium | hard | bookmarks
    bookmarks: {},        // { v1: true }
    knownThisRound: 0,
    againThisRound: 0,
    index: 0,
    deckOrder: null,      // shuffled v1 list for current mode
  };

  const deckEl = document.getElementById("deck");
  const completeEl = document.getElementById("complete");
  const curEl = document.getElementById("cur");
  const totalEl = document.getElementById("total");
  const progressEl = document.getElementById("progress");
  const statKnowEl = document.getElementById("statKnow");
  const statAgainEl = document.getElementById("statAgain");
  const filtersEl = document.getElementById("filters");

  let currentCardEl = null;
  let nextCardEl = null;
  let dragState = null;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getFilteredVerbs() {
    if (state.mode === "all") return VERBS;
    if (state.mode === "bookmarks") return VERBS.filter(v => state.bookmarks[v.v1]);
    return VERBS.filter(v => v.lvl === state.mode);
  }

  function getDeck() {
    const filtered = getFilteredVerbs();
    if (!state.deckOrder || state.deckOrder.length === 0) {
      state.deckOrder = shuffle(filtered.map(v => v.v1));
      state.index = 0;
      state.knownThisRound = 0;
      state.againThisRound = 0;
    }
    return state.deckOrder.map(v1 => VERBS.find(v => v.v1 === v1)).filter(Boolean);
  }

  function updateCounters() {
    const deck = getDeck();
    totalEl.textContent = deck.length;
    curEl.textContent = Math.min(state.index + 1, deck.length);
    const pct = deck.length ? Math.min(100, (state.index / deck.length) * 100) : 0;
    progressEl.style.width = pct + "%";

    document.getElementById("b-all").textContent = VERBS.length;
    document.getElementById("b-easy").textContent = VERBS.filter(v => v.lvl === "easy").length;
    document.getElementById("b-medium").textContent = VERBS.filter(v => v.lvl === "medium").length;
    document.getElementById("b-hard").textContent = VERBS.filter(v => v.lvl === "hard").length;
    document.getElementById("b-bm").textContent = Object.keys(state.bookmarks).length;
  }

  function renderCard(verb, isBehind = false) {
    if (!verb) return null;
    const card = document.createElement("div");
    card.className = "card" + (isBehind ? " behind" : "");
    card.dataset.v1 = verb.v1;

    const lvlLabel = { easy: "EASY", medium: "MED", hard: "HARD" }[verb.lvl] || "";
    const bookmarked = state.bookmarks[verb.v1] ? "active" : "";

    card.innerHTML = `
      <div class="face front">
        <div class="face-label">Infinitive <span class="lvl">${lvlLabel}</span></div>
        <div class="bookmark ${bookmarked}" data-action="bookmark">
          <svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4z"/></svg>
        </div>
        <div class="word">
          <div class="v1">${verb.v1}</div>
          <div class="translation">${verb.ua}</div>
        </div>
        <div class="tap-hint">тап — щоб побачити, свайп ← повторити • знаю →</div>
        <div class="stamp know">ЗНАЮ</div>
        <div class="stamp again">↺ ПОВТОР</div>
      </div>
      <div class="face back">
        <div class="face-label">Past Simple · Past Participle</div>
        <div class="forms">
          <div class="form v1">
            <div class="tag">V1</div>
            <div class="val">${verb.v1}</div>
          </div>
          <div class="form">
            <div class="tag">V2</div>
            <div class="val"><span class="accent">${verb.v2}</span></div>
          </div>
          <div class="form">
            <div class="tag">V3</div>
            <div class="val"><span class="accent">${verb.v3}</span></div>
          </div>
        </div>
        <div class="tap-hint">${verb.ua}</div>
      </div>
    `;

    if (!isBehind) attachInteractions(card);
    return card;
  }

  function attachInteractions(card) {
    // Bookmark
    const bookmark = card.querySelector(".bookmark");
    bookmark.addEventListener("pointerup", (e) => {
      e.stopPropagation();
      const v1 = card.dataset.v1;
      if (state.bookmarks[v1]) delete state.bookmarks[v1];
      else state.bookmarks[v1] = true;
      bookmark.classList.toggle("active");
      save();
      updateCounters();
    });

    // Flip on tap
    card.addEventListener("click", (e) => {
      if (e.target.closest(".bookmark")) return;
      if (dragState && dragState.moved) return;
      card.classList.toggle("flipped");
    });

    // Drag
    card.addEventListener("pointerdown", onPointerDown);
  }

  function onPointerDown(e) {
    if (e.target.closest(".bookmark")) return;
    const card = e.currentTarget;
    card.setPointerCapture(e.pointerId);
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      x: 0, y: 0,
      moved: false,
      card,
    };
    card.classList.add("dragging");
    card.addEventListener("pointermove", onPointerMove);
    card.addEventListener("pointerup", onPointerUp);
    card.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragState.moved = true;
    dragState.x = dx;
    dragState.y = dy;
    const rot = dx / 20;
    const card = dragState.card;
    const isFlipped = card.classList.contains("flipped");
    card.style.transform = `translate(${dx}px, ${dy * 0.4}px) rotate(${rot}deg)` + (isFlipped ? " rotateY(180deg)" : "");

    const knowStamp = card.querySelector(".stamp.know");
    const againStamp = card.querySelector(".stamp.again");
    if (knowStamp && againStamp) {
      knowStamp.style.opacity = Math.max(0, Math.min(1, dx / 120));
      againStamp.style.opacity = Math.max(0, Math.min(1, -dx / 120));
    }
  }

  function onPointerUp(e) {
    if (!dragState) return;
    const { card, x } = dragState;
    card.classList.remove("dragging");
    card.removeEventListener("pointermove", onPointerMove);
    card.removeEventListener("pointerup", onPointerUp);
    card.removeEventListener("pointercancel", onPointerUp);

    const THRESHOLD = 100;
    const isFlipped = card.classList.contains("flipped");

    if (x > THRESHOLD) {
      flyOut(card, "right");
      state.knownThisRound++;
      advance();
    } else if (x < -THRESHOLD) {
      flyOut(card, "left");
      state.againThisRound++;
      // re-queue this verb at the end of the round
      const v1 = card.dataset.v1;
      state.deckOrder.push(v1);
      advance();
    } else {
      // snap back — clear inline transform so .flipped class controls rotation
      card.style.transform = "";
      const knowStamp = card.querySelector(".stamp.know");
      const againStamp = card.querySelector(".stamp.again");
      if (knowStamp) knowStamp.style.opacity = 0;
      if (againStamp) againStamp.style.opacity = 0;
    }
    dragState = null;
  }

  function flyOut(card, dir) {
    const offset = dir === "right" ? window.innerWidth : -window.innerWidth;
    const isFlipped = card.classList.contains("flipped");
    card.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s";
    card.style.transform = `translate(${offset * 1.2}px, 80px) rotate(${dir === "right" ? 20 : -20}deg)` + (isFlipped ? " rotateY(180deg)" : "");
    card.style.opacity = "0";
    setTimeout(() => card.remove(), 450);
  }

  function advance() {
    state.index++;
    save();

    const deck = getDeck();
    if (state.index >= deck.length) {
      showComplete();
      updateCounters();
      return;
    }

    // promote next card to current
    if (nextCardEl) {
      nextCardEl.classList.remove("behind");
      attachInteractions(nextCardEl);
      currentCardEl = nextCardEl;
    }

    // prepare new next card
    const nextVerb = deck[state.index + 1];
    if (nextVerb) {
      nextCardEl = renderCard(nextVerb, true);
      deckEl.insertBefore(nextCardEl, deckEl.firstChild);
    } else {
      nextCardEl = null;
    }

    updateCounters();
  }

  function showComplete() {
    statKnowEl.textContent = state.knownThisRound;
    statAgainEl.textContent = state.againThisRound;
    completeEl.classList.add("show");
  }

  function buildDeck() {
    // remove existing cards (keep complete element)
    Array.from(deckEl.querySelectorAll(".card")).forEach(c => c.remove());
    completeEl.classList.remove("show");

    const deck = getDeck();
    if (deck.length === 0) {
      completeEl.querySelector("h2").textContent = "Порожньо";
      completeEl.querySelector("p").textContent = state.mode === "bookmarks"
        ? "Ще нічого не додано в обране. Натисни ★ на картці, щоб зберегти."
        : "Немає дієслів у цій категорії.";
      statKnowEl.textContent = 0;
      statAgainEl.textContent = 0;
      completeEl.classList.add("show");
      updateCounters();
      return;
    }

    const cur = deck[state.index];
    const next = deck[state.index + 1];

    if (next) {
      nextCardEl = renderCard(next, true);
      deckEl.insertBefore(nextCardEl, deckEl.firstChild);
    } else {
      nextCardEl = null;
    }

    if (cur) {
      currentCardEl = renderCard(cur, false);
      deckEl.insertBefore(currentCardEl, deckEl.firstChild);
    }

    updateCounters();
  }

  // Action buttons
  window.flipCard = function () {
    if (currentCardEl) currentCardEl.classList.toggle("flipped");
  };
  window.markKnow = function () {
    if (!currentCardEl) return;
    flyOut(currentCardEl, "right");
    state.knownThisRound++;
    advance();
  };
  window.markAgain = function () {
    if (!currentCardEl) return;
    flyOut(currentCardEl, "left");
    state.againThisRound++;
    state.deckOrder.push(currentCardEl.dataset.v1);
    advance();
  };
  window.restart = function () {
    state.deckOrder = null;
    state.index = 0;
    state.knownThisRound = 0;
    state.againThisRound = 0;
    save();
    buildDeck();
  };

  // Filter chips
  filtersEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const mode = chip.dataset.mode;
    if (mode === state.mode) return;
    Array.from(filtersEl.querySelectorAll(".chip")).forEach(c => c.classList.toggle("active", c === chip));
    state.mode = mode;
    state.deckOrder = null;
    state.index = 0;
    state.knownThisRound = 0;
    state.againThisRound = 0;
    save();
    buildDeck();
  });

  // Init: highlight current mode chip
  Array.from(filtersEl.querySelectorAll(".chip")).forEach(c => {
    c.classList.toggle("active", c.dataset.mode === state.mode);
  });

  // Keyboard shortcuts (desktop testing)
  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); window.flipCard(); }
    if (e.key === "ArrowRight") window.markKnow();
    if (e.key === "ArrowLeft") window.markAgain();
  });

  buildDeck();
})();
