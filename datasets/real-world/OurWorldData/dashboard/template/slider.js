/* ── HTML Slider ───────────────────────────────────────────────────────────── */
function pctToYear(pct) {
  return Math.round(state.minYear + (pct / 100) * (state.maxYear - state.minYear));
}

function makeDraggable(track, handleId, isStart) {
  const handle = document.getElementById(handleId);
  if (!handle) return;
  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    e.stopPropagation();
    const onMove = ev => {
      const rect = track.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(100, (ev.clientX - rect.left) / rect.width * 100));
      const yr   = pctToYear(pct);
      if (isStart) state.startYear = Math.min(yr, state.endYear - 1);
      else {
        const isSingleYear = state.view === "mekko";
        state.endYear = isSingleYear
          ? Math.min(state.maxYear, Math.max(state.minYear, yr))
          : Math.max(yr, state.startYear + 1);
      }
      syncSliderHandles();
      renderAll();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  });
}

function initSlider() {
  const track = document.getElementById("slider-track");
  if (!track || !state.minYear) return;

  makeDraggable(track, "handle-start", true);
  makeDraggable(track, "handle-end",   false);

  /* fill bar drag: shift both handles while preserving span */
  const fill = document.getElementById("slider-fill");
  if (fill) {
    fill.addEventListener("mousedown", e => {
      e.preventDefault();
      e.stopPropagation();
      const span    = state.endYear - state.startYear;
      const startX  = e.clientX;
      const startSY = state.startYear;
      const onMove  = ev => {
        const rect    = track.getBoundingClientRect();
        const deltaPct = (ev.clientX - startX) / rect.width * 100;
        const deltaYr  = Math.round(deltaPct * (state.maxYear - state.minYear) / 100);
        let ns = startSY + deltaYr;
        ns = Math.max(state.minYear, Math.min(state.maxYear - span, ns));
        state.startYear = ns;
        state.endYear   = ns + span;
        syncSliderHandles();
        renderAll();
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup",   onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    });
  }

  /* Ghost handle: show on track hover when map view active */
  const ghost = document.getElementById("handle-ghost");
  track.addEventListener("mousemove", e => {
    const isSingleYear = state.view === "mekko";
    const isGhostView  = state.view === "map" || isSingleYear;
    if (!isGhostView || state.rangeActive) { ghost.classList.add("hidden"); return; }
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
    const yr   = pctToYear(pct);
    if (!isSingleYear && yr >= state.endYear) { ghost.classList.add("hidden"); return; }
    ghost.classList.remove("hidden");
    ghost.style.left = pct + "%";
  });
  track.addEventListener("mouseleave", () => {
    if (!state.rangeActive) ghost.classList.add("hidden");
  });

  /* Ghost handle click: activate compare mode */
  ghost.addEventListener("click", e => {
    e.stopPropagation();
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, (ghost.getBoundingClientRect().left + 8 - rect.left) / rect.width * 100));

    if (state.view === "mekko") {
      // 단일 연도 이동 — range 모드 진입 없이 endYear만 변경
      state.endYear = Math.min(state.maxYear, Math.max(state.minYear, pctToYear(pct)));
      ghost.classList.add("hidden");
      syncSliderHandles();
      renderAll();
    } else {
      state.startYear   = Math.min(pctToYear(pct), state.endYear - 1);
      state.rangeActive = true;
      ghost.classList.add("hidden");
      els.mapPair.classed("range-mode", true);
      syncSliderHandles();
      renderAll();
      showMapControls();
    }
  });

  track.addEventListener("click", e => {
    if (e.target.classList.contains("slider-handle")) return;
    if (e.target.id === "slider-fill") return;
    if (e.target.id === "handle-ghost") return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
    if (state.view === "mekko") {
      state.endYear = Math.min(state.maxYear, Math.max(state.minYear, pctToYear(pct)));
    } else if (state.rangeActive) {
      /* In compare mode: clicking left side moves startYear, right moves endYear */
      const yr = pctToYear(pct);
      if (yr < state.endYear) state.startYear = yr;
      else state.endYear = yr;
    } else {
      state.endYear = Math.max(state.startYear + 1, Math.min(state.maxYear, pctToYear(pct)));
    }
    syncSliderHandles();
    renderAll();
  });

  syncSliderHandles();
}

function syncSliderHandles() {
  if (!state.minYear) return;
  const range  = state.maxYear - state.minYear;
  const sp     = (state.startYear - state.minYear) / range * 100;
  const ep     = (state.endYear   - state.minYear) / range * 100;
  const fill   = document.getElementById("slider-fill");
  const hStart = document.getElementById("handle-start");
  const hEnd   = document.getElementById("handle-end");

  // Map tab without compare mode: single handle (hide start)
  // Table, Line, Bar + map compare mode: two handles
  const showStart = state.rangeActive || (state.view !== "map" && state.view !== "mekko");

  if (showStart) {
    if (fill) { fill.style.display = ""; fill.style.left = sp + "%"; fill.style.width = (ep - sp) + "%"; }
    if (hStart) { hStart.style.left = sp + "%"; hStart.classList.remove("hidden"); }
    els.startLabel.text(state.startYear);
  } else {
    if (fill) { fill.style.left = "0%"; fill.style.width = ep + "%"; fill.style.display = "none"; }
    if (hStart) hStart.classList.add("hidden");
    els.startLabel.text(state.minYear);
  }

  if (hEnd) hEnd.style.left = ep + "%";
  els.endLabel.text(state.endYear);
}


/* ── Playback ─────────────────────────────────────────────────────────────── */
function togglePlay() {
  state.playing = !state.playing;
  els.play.text(state.playing ? "❚❚" : "▶");
  if (!state.playing) return;
  const timer = d3.interval(() => {
    if (!state.playing) return timer.stop();
    if (state.endYear >= state.maxYear) {
      timer.stop(); state.playing = false; els.play.text("▶");
    } else {
      state.endYear += 1;
    }
    renderAll();
  }, 500);
}
