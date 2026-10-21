/* ── Data parsing ─────────────────────────────────────────────────────────── */
function parseRow(d) {
  const c = CONFIG.columns;
  const raw = d[c.value];
  let value = null;
  if (raw !== "" && raw != null) {
    const v = +raw;
    if (!isNaN(v)) {
      if (CONFIG.colorMode === "categorical") {
        const maxCat = (CONFIG.categories?.length ?? 4) - 1;
        if (v === Math.round(v) && v >= 0 && v <= maxCat) {
          value = v;
        } else if (v >= 0 && v <= 1) {
          /* bin decimal 0–1 into category indices */
          value = Math.min(maxCat, Math.floor(v * (maxCat + 1)));
        }
      } else {
        value = v;
      }
    }
  }
  return {
    entity: d[c.entity],
    code:   normalizeCode(d[c.code]),
    year:   +d[c.year],
    value,
  };
}


/* ── Indexes ─────────────────────────────────────────────────────────────── */
function buildIndexes() {
  const years = [...new Set(state.rows.map(d => d.year))].sort(d3.ascending);
  state.minYear   = d3.min(years);
  state.maxYear   = d3.max(years);
  state.startYear = state.minYear;
  state.endYear   = state.maxYear;

  const byEntity = d3.group(state.rows, d => d.entity);
  state.entities = [...byEntity.keys()].sort(d3.ascending).map(name => {
    const values = byEntity.get(name).sort((a, b) => d3.ascending(a.year, b.year));
    return { name, code: values.find(d => d.code)?.code, values };
  });
  state.entityMap     = new Map(state.entities.map(d => [d.name, d]));
  state.byCode        = new Map();
  state.byCountryName = new Map();
  state.entities.forEach(e => {
    if (e.code) state.byCode.set(e.code, e);
    state.byCountryName.set(normName(e.name), e);
  });

  if (CONFIG.initialSelected?.length) {
    CONFIG.initialSelected.forEach(name => {
      if (state.entityMap.has(name)) state.selected.add(name);
    });
  }
  if (!state.selected.size) state.entities.slice(0, 4).forEach(d => state.selected.add(d.name));

  state.centroids = new Map();
  state.features.forEach(f => {
    const ent = entityForFeature(f);
    if (ent) state.centroids.set(ent.name, d3.geoCentroid(f));
  });
}


/* ── Bootstrap ────────────────────────────────────────────────────────────── */
async function init() {
  els.titleText.text(CONFIG.title);
  if (CONFIG.subtitle) els.subtitle.text(CONFIG.subtitle);
  d3.select("#source-text").text(CONFIG.source || "");
  d3.select("title").text(CONFIG.title || "Map");

  drawLegend();

  let csvRows, world;
  try {
    [csvRows, world] = await Promise.all([
      d3.csv(CONFIG.csvUrl, parseRow),
      d3.json(CONFIG.worldUrl),
    ]);
  } catch (e) {
    els.titleText.text("Error loading data — check console.");
    console.error(e);
    return;
  }

  state.rows     = csvRows.filter(d => d.entity && Number.isFinite(d.year));
  state.world    = world;
  state.features = topojson.feature(world, world.objects.countries).features
                     .filter(f => +f.id !== 10); /* exclude Antarctica */

  buildIndexes();
  bindControls();
  renderAll();
  initSlider();
}

init();
