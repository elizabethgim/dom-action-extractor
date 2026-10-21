/* ── Controls ────────────────────────────────────────────────────────────── */
function switchView(view) {
  state.view = view;
  els.tabs.classed("active",  function () { return this.dataset.view === state.view; });
  els.views.classed("active", function () { return this.id === `${state.view}-view`; });
  const lineOrBar = v => v === "line" || v === "bar";
  els.sideTitle.text(lineOrBar(state.view) ? "ADD/REMOVE COUNTRIES AND REGIONS" : "SELECT COUNTRIES");
  d3.select(".side-panel").classed("hidden", state.view === "table");
  showMapControls();
  renderAll();
}

function bindControls() {
  els.tabs.on("click", function (event) {
    // +3 button always just toggles the dropdown (never gets a view assigned)
    if (this.id === "tab-more-btn") {
      event.stopPropagation();
      document.getElementById("tab-dropdown").classList.toggle("visible");
      return;
    }
    const view = this.dataset.view;
    if (!view) return;
    document.getElementById("tab-dropdown")?.classList.remove("visible");
    switchView(view);
  });

  // Dropdown item click: swap it with the last-slot tab, then activate
  d3.selectAll(".tab-dropdown-item").on("click", function (event) {
    event.stopPropagation();
    const lastTab    = document.getElementById("last-slot-tab");
    const newView    = this.dataset.view;
    const newLabel   = this.textContent;
    // The evicted tab goes into the dropdown item's slot
    this.dataset.view = lastTab.dataset.view;
    this.textContent  = lastTab.textContent;
    // The chosen tab takes the last slot
    lastTab.dataset.view = newView;
    lastTab.textContent  = newLabel;
    document.getElementById("tab-dropdown").classList.remove("visible");
    switchView(newView);
  });

  // Close dropdown on any outside click
  document.addEventListener("click", () => {
    document.getElementById("tab-dropdown")?.classList.remove("visible");
  });

  els.countrySearch.on("input", renderCountryList);
  els.tableSearch.on("input",   renderTable);
  d3.select("#table-filter-select").on("change", function () {
    state.tableFilter = this.value;
    renderTable();
  });
  els.clearSelection.on("click", () => { activeSelection().clear(); renderAll(); });
  els.play.on("click", togglePlay);

  window.addEventListener("resize", debounce(renderAll, 120));

  els.zoomSelBtn.on("click",  zoomToSel);
  els.resetViewBtn.on("click", resetView);
  els.regionSelect.on("change", function () {
    state.region   = this.value;
    state.isZoomed = false;  // region dropdown uses flat projection, not orthographic globe
    renderMap();
    showMapControls();
  });
}


/* ── Render orchestration ─────────────────────────────────────────────────── */
function renderAll() {
  const yearTxt = (state.view === "map" || state.view === "bar" || state.view === "mekko") ? `, ${state.endYear}` : "";
  els.titleYear.text(yearTxt);
  els.sortYear.text(state.endYear);
  els.selectionSection.classed("hidden", !activeSelection().size);
  els.selectionCount.text(`Selection (${activeSelection().size})`);
  syncSliderHandles();
  d3.select(".side-panel").classed("hidden", state.view === "table");
  renderCountryList();

  if (state.view === "map")   { renderMap();   showMapControls(); }
  if (state.view === "table") renderTable();
  if (state.view === "line")  renderLine();
  if (state.view === "bar")   renderBar();
  if (state.view === "mekko") renderMekko();
  if (state.view === "slope") renderSlope();
}

function renderCountryList() {
  const q = els.countrySearch.property("value").trim().toLowerCase();
  const allRows = state.entities
    .map(e => ({ ...e, current: valueAtYear(e.values, state.endYear) }))
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => d3.descending(a.current ?? -Infinity, b.current ?? -Infinity) || d3.ascending(a.name, b.name));

  const sel = activeSelection();
  renderCountryRows(els.selectedList,  allRows.filter(d =>  sel.has(d.name)));
  renderCountryRows(els.countryList,   allRows.filter(d => !sel.has(d.name)));
}

function renderCountryRows(container, rows) {
  const join = container.selectAll("label.country-row").data(rows, d => d.name);
  join.exit().remove();
  const enter = join.enter().append("label").attr("class", "country-row");
  enter.append("input").attr("type", "checkbox");
  enter.append("span").attr("class", "country-name");
  enter.append("span").attr("class", "country-value");

  const merged = join.merge(enter);
  merged
    .classed("active", d => activeSelection().has(d.name) || state.hovered === d.name)
    .on("mouseenter", (_, d) => { state.hovered = d.name; renderHoverEffects(); })
    .on("mouseleave", () => { state.hovered = null; renderHoverEffects(); })
    .on("click", (event, d) => {
      event.preventDefault();
      const sel = activeSelection();
      sel.has(d.name) ? sel.delete(d.name) : sel.add(d.name);
      renderAll();
    });
  merged.select("input").property("checked", d => activeSelection().has(d.name));
  merged.select(".country-name").text(d => d.name);
  merged.select(".country-value").text(d => {
    if (d.current == null) return "";
    if (CONFIG.colorMode === "categorical") return labelByValue(d.current);
    return fmtVal(d.current);
  });

  const maxVal = CONFIG.colorMode === "categorical"
    ? ((CONFIG.categories?.length ?? 2) - 1)
    : (d3.max(rows, r => r.current) || 1);
  merged.each(function(d) {
    const pct = d.current == null || maxVal <= 0 ? 0 : (d.current / maxVal) * 100;
    this.style.setProperty("--bar-w", Math.min(100, pct) + "%");
  });
}
