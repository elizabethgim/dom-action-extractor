'use strict';

const CSV_URL  = 'https://ourworldindata.org/grapher/yearly-number-of-objects-launched-into-outer-space.csv?v=1&csvType=full&useColumnShortNames=true';
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ── Color scale ──────────────────────────────────────────────────────────────
const THRESHOLDS = [2, 4, 11, 31, 101, 301, 1001];
const COLORS = ['#fdf1e3','#f9d9aa','#f2b66d','#e08c3a','#c06020','#8b3810','#5e1e06','#3a0d02'];
const NO_DATA_CLR = '#e8e4dc';

const colorScale = d3.scaleThreshold().domain(THRESHOLDS).range(COLORS);
function fillFor(code, year, noDataFill) {
  const v = code ? getVal(code, year) : null;
  return v == null ? noDataFill : colorScale(v);
}

// ── ISO alpha-3 → numeric (ISO 3166-1) ───────────────────────────────────────
const A3N = {
  AFG:4,ALB:8,DZA:12,AND:20,AGO:24,ARG:32,ARM:51,AUS:36,AUT:40,AZE:31,
  BHS:44,BHR:48,BGD:50,BLR:112,BEL:56,BLZ:84,BEN:204,BTN:64,BOL:68,BIH:70,BWA:72,
  BRA:76,BRN:96,BGR:100,BFA:854,BDI:108,CPV:132,KHM:116,CMR:120,CAN:124,CAF:140,
  TCD:148,CHL:152,CHN:156,COL:170,COM:174,COD:180,COG:178,CRI:188,CIV:384,HRV:191,
  CUB:192,CYP:196,CZE:203,DNK:208,DJI:262,DOM:214,ECU:218,EGY:818,SLV:222,GNQ:226,
  ERI:232,EST:233,SWZ:748,ETH:231,FJI:242,FIN:246,FRA:250,GAB:266,GMB:270,GEO:268,
  DEU:276,GHA:288,GRC:300,GTM:320,GIN:324,GNB:624,GUY:328,HTI:332,HND:340,HUN:348,
  ISL:352,IND:356,IDN:360,IRN:364,IRQ:368,IRL:372,ISR:376,ITA:380,JAM:388,JPN:392,
  JOR:400,KAZ:398,KEN:404,PRK:408,KOR:410,KWT:414,KGZ:417,LAO:418,LVA:428,LBN:422,
  LSO:426,LBR:430,LBY:434,LIE:438,LTU:440,LUX:442,MDG:450,MWI:454,MYS:458,MDV:462,
  MLI:466,MLT:470,MRT:478,MUS:480,MEX:484,MDA:498,MNG:496,MNE:499,MAR:504,MOZ:508,
  MMR:104,NAM:516,NPL:524,NLD:528,NZL:554,NIC:558,NER:562,NGA:566,MKD:807,NOR:578,
  OMN:512,PAK:586,PAN:591,PNG:598,PRY:600,PER:604,PHL:608,POL:616,PRT:620,QAT:634,
  ROU:642,RUS:643,RWA:646,SAU:682,SEN:686,SRB:688,SLE:694,SGP:702,SVK:703,SVN:705,
  SOM:706,ZAF:710,ESP:724,LKA:144,SDN:729,SSD:728,SUR:740,SWE:752,CHE:756,SYR:760,
  TWN:158,TJK:762,TZA:834,THA:764,TLS:626,TGO:768,TTO:780,TUN:788,TUR:792,TKM:795,
  UGA:800,UKR:804,ARE:784,GBR:826,USA:840,URY:858,UZB:860,VEN:862,VNM:704,YEM:887,
  ZMB:894,ZWE:716,PSE:275,SMR:674,MCO:492,HTI:332,BOL:68,
};
const N2A = Object.fromEntries(Object.entries(A3N).map(([a,n])=>[n,a]));

// ── Continent → alpha3 sets ───────────────────────────────────────────────────
const CONTINENT_CODES = {
  africa:   new Set(['DZA','AGO','BEN','BWA','BFA','BDI','CMR','CPV','CAF','TCD','COM','COD','COG','CIV','DJI','EGY','GNQ','ERI','ETH','GAB','GMB','GHA','GIN','GNB','KEN','LSO','LBR','LBY','MDG','MWI','MLI','MRT','MUS','MAR','MOZ','NAM','NER','NGA','RWA','SEN','SLE','SOM','ZAF','SDN','SSD','SWZ','TZA','TGO','TUN','UGA','ZMB','ZWE']),
  americas: new Set(['ATG','ARG','BHS','BRB','BLZ','BOL','BRA','CAN','CHL','COL','CRI','CUB','DOM','ECU','SLV','GTM','GUY','HTI','HND','JAM','MEX','NIC','PAN','PRY','PER','SUR','TTO','USA','URY','VEN']),
  asia:     new Set(['AFG','ARM','AZE','BHR','BGD','BTN','BRN','KHM','CHN','GEO','IND','IDN','IRN','IRQ','ISR','JPN','JOR','KAZ','KWT','KGZ','LAO','LBN','MYS','MDV','MNG','MMR','NPL','PRK','OMN','PAK','PHL','QAT','SAU','SGP','KOR','LKA','SYR','TWN','TJK','THA','TLS','TUR','TKM','ARE','UZB','VNM','YEM']),
  europe:   new Set(['ALB','AND','AUT','BLR','BEL','BIH','BGR','HRV','CZE','DNK','EST','FIN','FRA','DEU','GRC','HUN','ISL','IRL','ITA','LVA','LIE','LTU','LUX','MLT','MDA','MCO','MNE','NLD','MKD','NOR','POL','PRT','ROU','RUS','SMR','SRB','SVK','SVN','ESP','SWE','CHE','UKR','GBR']),
  oceania:  new Set(['AUS','FJI','NZL','PNG','WSM','SLB','TON','VUT']),
};

// ── Region geographic bounding boxes [lon0,lat0, lon1,lat1] ─────────────────
const REGION_BBOX = {
  africa:   [[-20, -38], [55,  38]],
  americas: [[-170,-58], [-30, 75]],
  asia:     [[ 25, -12], [150, 75]],
  europe:   [[-28,  35], [50,  72]],
  oceania:  [[ 90, -50], [180, 25]],
};

// ── State ────────────────────────────────────────────────────────────────────
let byCode    = new Map();   // alpha3 → Map(year → value|null)
let cList     = [];          // [{code, name}] ordered by first appearance
let centroids = new Map();   // alpha3 → [lon, lat]
let topoData  = null;

const MIN_YEAR = 1957;
const MAX_YEAR = 2025;
let startYear = MIN_YEAR;
let curYear   = MAX_YEAR;
let rangeActive  = false;
let sliderXScale = null;

let playing  = false;
let timer    = null;
let selected = new Set();    // alpha3 codes
let search   = '';
let sortDir  = -1;           // −1 = descending
let isGlobe  = false;
let isZoomed = false;

let svgL, projL, geoPathL, gCountriesL;
let svgR, projR, geoPathR, gCountriesR;
let mapW, H;

let sliderHoverG = null, sliderTipCircle = null, sliderTipBg = null, sliderTipTxt = null;
let sliderR = 7, sliderW = 0, sliderTy = 14;

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  let csvRows;
  try {
    [csvRows, topoData] = await Promise.all([d3.csv(CSV_URL), d3.json(TOPO_URL)]);
  } catch (e) {
    document.getElementById('main-title').textContent =
      'Error loading data. Check CORS or download CSV manually.';
    return;
  }

  csvRows.forEach(r => {
    const code = r.code?.trim();
    if (!code) return;
    const year = +r.year;
    const v = (r.annual_launches === '' || r.annual_launches == null)
      ? null : +r.annual_launches;
    if (!byCode.has(code)) {
      byCode.set(code, new Map());
      cList.push({ code, name: r.entity.trim() });
    }
    byCode.get(code).set(year, v);
  });

  // Pre-compute centroids from topojson
  topojson.feature(topoData, topoData.objects.countries).features.forEach(f => {
    const a3 = N2A[+f.id];
    if (a3) centroids.set(a3, d3.geoCentroid(f));
  });

  setupMaps();
  buildLegend();
  setupControls();
  renderSidebar();
  requestAnimationFrame(() => { buildSlider(); setYear(MAX_YEAR); });
}

// ── Map ──────────────────────────────────────────────────────────────────────
function addHatch(s, id) {
  const defs = s.append('defs');
  const pat = defs.append('pattern')
    .attr('id', id).attr('width', 4).attr('height', 4)
    .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
  pat.append('rect').attr('width', 4).attr('height', 4).attr('fill', '#f5f2ee');
  pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 4)
    .attr('stroke', '#d0cac4').attr('stroke-width', 0.8);
}

function makeMap(svgId, hatchId, side) {
  const s = d3.select('#' + svgId).attr('width', mapW).attr('height', H);
  addHatch(s, hatchId);
  const p  = d3.geoNaturalEarth1().scale(mapW / 6.3).translate([mapW / 2, H / 2]);
  const gp = d3.geoPath(p);
  s.append('path').datum({ type: 'Sphere' }).attr('class', 'sphere').attr('d', gp)
    .on('click', () => { selected.clear(); updateSel(); updateClickLabel(); });
  s.append('path').datum(d3.geoGraticule()()).attr('class', 'graticule hidden').attr('d', gp);
  const features = topojson.feature(topoData, topoData.objects.countries).features
    .filter(f => +f.id !== 10);
  const gc = s.append('g');
  gc.selectAll('path').data(features).join('path')
    .attr('class', 'land')
    .attr('d', gp)
    .on('mousemove', (ev, d) => onHover(ev, d, side))
    .on('mouseleave', hideTip)
    .on('click', onClick);
  return { s, p, gp, gc };
}

function setupMaps() {
  const sec = document.getElementById('map-section');
  mapW = sec.clientWidth || 600;
  H = 390;

  const R = makeMap('map-right', 'hatch-R', 'R');
  const L = makeMap('map-left',  'hatch-L', 'L');
  svgL = L.s; projL = L.p; geoPathL = L.gp; gCountriesL = L.gc;
  svgR = R.s; projR = R.p; geoPathR = R.gp; gCountriesR = R.gc;
}

function setRangeMode(active) {
  if (rangeActive === active) return;
  rangeActive = active;
  document.getElementById('map-pair').classList.toggle('range-mode', active);
  document.getElementById('map-toolbar').style.display = active ? 'flex' : 'none';
  d3.select('.sl-left').style('display', active ? null : 'none');
  if (!active) document.getElementById('start-input').style.display = 'none';
  requestAnimationFrame(() => {
    if (active) {
      mapW = document.getElementById('map-right').getBoundingClientRect().width;
      svgL.attr('width', mapW); svgR.attr('width', mapW);
      projL = d3.geoNaturalEarth1().scale(mapW / 6.3).translate([mapW / 2, H / 2]);
      projR = d3.geoNaturalEarth1().scale(mapW / 6.3).translate([mapW / 2, H / 2]);
    } else {
      mapW = document.getElementById('map-section').clientWidth;
      svgR.attr('width', mapW);
      projR = d3.geoNaturalEarth1().scale(mapW / 6.3).translate([mapW / 2, H / 2]);
    }
    geoPathL = d3.geoPath(projL);
    geoPathR = d3.geoPath(projR);
    redraw();
    recolor();
  });
}

function getVal(code, year) {
  return byCode.get(code)?.get(year) ?? null;
}

function recolor() {
  if (rangeActive) {
    gCountriesL.selectAll('.land').attr('fill', d => fillFor(N2A[+d.id], startYear, 'url(#hatch-L)'));
  }
  gCountriesR.selectAll('.land').attr('fill', d => fillFor(N2A[+d.id], curYear, 'url(#hatch-R)'));
}

function redraw() {
  if (rangeActive) {
    svgL.select('.sphere').attr('d', geoPathL);
    svgL.select('.graticule').attr('d', geoPathL);
    gCountriesL.selectAll('.land').attr('d', geoPathL);
  }
  svgR.select('.sphere').attr('d', geoPathR);
  svgR.select('.graticule').attr('d', geoPathR);
  gCountriesR.selectAll('.land').attr('d', geoPathR);
  updateClickLabel();
}

// ── Year ─────────────────────────────────────────────────────────────────────
function setYear(y) {
  curYear = y;
  syncSliderHandles();
  recolor();
  renderList();
  updateClickLabel();
}

function syncSliderHandles() {
  const yd = document.getElementById('year-display');
  if (yd) yd.textContent = rangeActive ? `${startYear} to ${curYear}` : `${curYear}`;
  document.getElementById('start-yr-label').textContent = startYear;
  document.getElementById('end-yr-label').textContent = curYear;
  document.getElementById('start-input').value = startYear;
  document.getElementById('end-input').value = curYear;
  if (!sliderXScale) return;
  const svgD3 = d3.select('#slider-svg');
  const lx = sliderXScale(startYear);
  const rx = sliderXScale(curYear);
  svgD3.select('.sl-left').attr('cx', lx);
  svgD3.select('.sl-right').attr('cx', rx);
  const rangeX = rangeActive ? lx : rx;
  svgD3.select('.sl-range')
    .attr('x', rangeX)
    .attr('width', Math.max(0, rx - rangeX));
}

function updateHoverTip(x, force = false) {
  if (rangeActive && !force) { sliderHoverG.style('display', 'none'); return; }
  const yr = Math.round(sliderXScale.invert(Math.max(sliderR, Math.min(sliderW - sliderR, x))));
  const label = String(yr);
  const tw = label.length * 7.5 + 14;
  const th = 22;
  const cx = Math.max(tw / 2 + 2, Math.min(sliderW - tw / 2 - 2, x));
  const hx = Math.max(sliderR, Math.min(sliderW - sliderR, x));
  sliderTipCircle.attr('cx', hx);
  sliderTipBg.attr('x', cx - tw / 2).attr('y', sliderTy - th - 6).attr('width', tw).attr('height', th);
  sliderTipTxt.attr('x', cx).attr('y', sliderTy - th / 2 - 6).text(label);
  sliderHoverG.style('display', null);
}

function hideHoverTip() { sliderHoverG.style('display', 'none'); }

function buildSlider() {
  const svgEl = document.getElementById('slider-svg');
  const svgD3 = d3.select(svgEl);
  const w = svgEl.getBoundingClientRect().width || 200;
  const h = 28;
  const R = sliderR;
  const ty = sliderTy;
  sliderW = w;
  svgD3.attr('height', h).style('overflow', 'visible');

  sliderXScale = d3.scaleLinear().domain([MIN_YEAR, MAX_YEAR]).range([R, w - R]);

  const startEl = document.getElementById('start-input');
  const endEl   = document.getElementById('end-input');

  // Background track
  svgD3.append('rect')
    .attr('x', R).attr('y', ty - 4).attr('width', w - 2 * R).attr('height', 8)
    .attr('rx', 4).attr('fill', '#ddd');

  // Highlighted range (draggable — moves both handles together)
  svgD3.append('rect')
    .attr('class', 'sl-range')
    .attr('y', ty - 4).attr('height', 8).attr('rx', 4)
    .attr('fill', '#3a6abf').attr('x', 0).attr('width', 0)
    .style('cursor', 'grab')
    .call(d3.drag()
      .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
      .on('drag', function(event) {
        if (!rangeActive) return;
        const span = curYear - startYear;
        const newStart = Math.round(sliderXScale.invert(sliderXScale(startYear) + event.dx));
        const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR - span, newStart));
        startYear = clamped;
        curYear = clamped + span;
        syncSliderHandles();
        recolor();
        renderList();
      })
      .on('end', function() { d3.select(this).style('cursor', 'grab'); }));

  // Hover preview group
  sliderHoverG = svgD3.append('g').attr('class', 'sl-hover-tip').style('display', 'none').style('pointer-events', 'none');
  sliderTipCircle = sliderHoverG.append('circle')
    .attr('cy', ty).attr('r', R)
    .attr('fill', '#fff').attr('stroke', '#aaa').attr('stroke-width', 2);
  sliderTipBg = sliderHoverG.append('rect').attr('rx', 4).attr('ry', 4)
    .attr('fill', '#fff').attr('stroke', '#bbb').attr('stroke-width', 1);
  sliderTipTxt = sliderHoverG.append('text')
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-size', 13).attr('font-weight', 600).attr('fill', '#333');

  // Right handle
  svgD3.append('circle')
    .attr('class', 'sl-right')
    .attr('cy', ty).attr('r', R)
    .attr('fill', '#fff').attr('stroke', '#3a6abf').attr('stroke-width', 2)
    .style('cursor', 'ew-resize')
    .on('mouseover', () => { showInput(endEl); updateHoverTip(sliderXScale(curYear), true); })
    .on('mouseout',  () => { hideInput(endEl); sliderHoverG.style('display', 'none'); })
    .call(d3.drag()
      .on('start', () => showInput(endEl))
      .on('end',   () => hideInput(endEl))
      .on('drag', function(event) {
        curYear = Math.max(rangeActive ? startYear + 1 : MIN_YEAR, Math.min(MAX_YEAR, Math.round(sliderXScale.invert(event.x))));
        updateHoverTip(sliderXScale(curYear), true);
        syncSliderHandles();
        recolor();
        renderList();
      })
      .on('end', () => sliderHoverG.style('display', 'none')));

  // Left handle
  svgD3.append('circle')
    .attr('class', 'sl-left')
    .attr('cy', ty).attr('r', R)
    .attr('fill', '#fff').attr('stroke', '#3a6abf').attr('stroke-width', 2)
    .style('cursor', 'ew-resize')
    .style('display', 'none')
    .on('mouseover', () => { showInput(startEl); updateHoverTip(sliderXScale(startYear), true); })
    .on('mouseout',  () => { hideInput(startEl); sliderHoverG.style('display', 'none'); })
    .call(d3.drag()
      .on('start', () => showInput(startEl))
      .on('end',   () => hideInput(startEl))
      .on('drag', function(event) {
        const y = Math.round(sliderXScale.invert(event.x));
        if (y >= curYear) {
          startYear = MIN_YEAR;
          setRangeMode(false);
        } else {
          startYear = Math.max(MIN_YEAR, y);
        }
        updateHoverTip(sliderXScale(startYear), true);
        syncSliderHandles();
        recolor();
        renderList();
      })
      .on('end', () => sliderHoverG.style('display', 'none')));

  // SVG-level hover for ghost preview (works everywhere, doesn't block handle events)
  svgD3.style('cursor', 'pointer')
    .on('mousemove', function(event) { updateHoverTip(d3.pointer(event)[0]); })
    .on('mouseleave', () => sliderHoverG.style('display', 'none'))
    .on('click', function(event) {
      if (event.target.tagName === 'circle') return;
      const x = d3.pointer(event)[0];
      const clickedYear = Math.round(sliderXScale.invert(Math.max(R, Math.min(w - R, x))));
      sliderHoverG.style('display', 'none');
      if (clickedYear < curYear) {
        startYear = clickedYear;
        setRangeMode(true);
        syncSliderHandles();
        recolor();
        renderList();
      }
    });

  syncSliderHandles();
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
const tipEl   = document.getElementById('tooltip');
const tipName = document.getElementById('tip-name');
const tipVal  = document.getElementById('tip-val');
const tipChart= document.getElementById('tip-chart');

function onHover(event, d, side) {
  const year = side === 'L' ? startYear : curYear;
  const a3  = N2A[+d.id];
  const name = a3 ? (cList.find(c => c.code === a3)?.name ?? a3) : null;
  if (!name) return;

  const v = getVal(a3, year);
  tipName.textContent = name;
  tipVal.textContent  = v != null ? `${v.toLocaleString()} objects in ${year}` : 'No data';

  // Mini sparkline
  const series = [];
  const m = byCode.get(a3);
  if (m) for (let yr = 1957; yr <= 2025; yr++) {
    const sv = m.get(yr);
    if (sv != null) series.push([yr, sv]);
  }

  const cw = 160, ch = 72;
  const ml = 2, mr = 2, mt = 4, mb = 18; // margins for axes
  const iw = cw - ml - mr, ih = ch - mt - mb;

  d3.select(tipChart).attr('width', cw).attr('height', ch).selectAll('*').remove();
  const tc = d3.select(tipChart);
  const g  = tc.append('g').attr('transform', `translate(${ml},${mt})`);

  const xS = d3.scaleLinear().domain([1957, 2025]).range([0, iw]);
  const maxY = series.length ? d3.max(series, s => s[1]) : 1;
  const yS = d3.scaleLinear().domain([0, maxY]).range([ih, 0]);

  // x-axis line + year labels
  g.append('line')
    .attr('x1', 0).attr('y1', ih).attr('x2', iw).attr('y2', ih)
    .attr('stroke', '#ccc').attr('stroke-width', 0.8);
  g.append('text')
    .attr('x', 0).attr('y', ih + 12)
    .attr('font-size', 9).attr('fill', '#999').text('1957');
  g.append('text')
    .attr('x', iw).attr('y', ih + 12)
    .attr('font-size', 9).attr('fill', '#999')
    .attr('text-anchor', 'end').text('2025');

  // y-axis line
  g.append('line')
    .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', ih)
    .attr('stroke', '#ccc').attr('stroke-width', 0.8);

  if (series.length > 1) {
    g.append('path')
      .datum(series)
      .attr('fill', 'none')
      .attr('stroke', '#b04818')
      .attr('stroke-width', 1.5)
      .attr('d', d3.line().x(s => xS(s[0])).y(s => yS(s[1])));
    const cur = series.find(s => s[0] === year);
    if (cur) {
      g.append('circle')
        .attr('cx', xS(cur[0])).attr('cy', yS(cur[1]))
        .attr('r', 3).attr('fill', '#b04818');
    }
  } else {
    g.append('text')
      .attr('x', iw / 2).attr('y', ih / 2)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-size', 10).attr('fill', '#aaa')
      .text('No historical data');
  }

  const rect = document.getElementById('map-section').getBoundingClientRect();
  let tx = event.clientX - rect.left + 14;
  let ty = event.clientY - rect.top  - 30;
  if (tx + 200 > rect.width) tx = event.clientX - rect.left - 190;
  if (ty < 0) ty = 4;
  tipEl.style.left = tx + 'px';
  tipEl.style.top  = ty + 'px';
  tipEl.classList.remove('hidden');
}

function hideTip() { tipEl.classList.add('hidden'); }

// ── Click label ──────────────────────────────────────────────────────────────
function placeLabel(svg, proj, code, year) {
  const lonlat = centroids.get(code);
  if (!lonlat) return;
  const [cx, cy] = proj(lonlat);
  if (!isFinite(cx) || !isFinite(cy)) return;
  const val = getVal(code, year);
  if (val == null) return;
  svg.append('text')
    .attr('class', 'click-label')
    .attr('data-code', code)
    .attr('x', cx).attr('y', cy)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', 9).attr('font-weight', '700')
    .attr('fill', '#1a1a1a')
    .style('cursor', 'default')
    .on('mouseenter', () => highlightCode(code, true))
    .on('mouseleave', () => highlightCode(code, false))
    .text(val.toLocaleString());
}

function updateClickLabel() {
  svgR.selectAll('.click-label').remove();
  if (svgL) svgL.selectAll('.click-label').remove();

  selected.forEach(code => {
    placeLabel(svgR, projR, code, curYear);
    if (rangeActive) placeLabel(svgL, projL, code, startYear);
  });
}

function highlightCode(code, on) {
  [gCountriesL, gCountriesR].forEach(gc => {
    if (!gc) return;
    gc.selectAll('.land').filter(d => N2A[+d.id] === code).classed('label-hover', on);
  });
}

// ── Click / selection ────────────────────────────────────────────────────────
function onClick(event, d) {
  const a3 = N2A[+d.id];
  if (!a3) return;
  // clickedCountry = clickedCountry?.code === a3 ? null : { code: a3, feature: d };
  selected.has(a3) ? selected.delete(a3) : selected.add(a3);
  updateSel();
  updateClickLabel();
}

function updateSel() {
  if (rangeActive) gCountriesL.selectAll('.land').classed('sel', d => selected.has(N2A[+d.id]));
  gCountriesR.selectAll('.land').classed('sel', d => selected.has(N2A[+d.id]));

  const hasSel = selected.size > 0;
  document.getElementById('sel-section').classList.toggle('hidden', !hasSel);
  document.getElementById('sel-count').textContent = selected.size;
  showZoomControls();
  renderSelList();
  renderList();
}

// ── Zoom controls ─────────────────────────────────────────────────────────────
function showZoomControls() {
  document.getElementById('zoom-sel-btn').classList.toggle('hidden', !selected.size || isZoomed);
  document.getElementById('reset-zoom-btn').classList.toggle('hidden', !isZoomed);
}

function zoomToSel() {
  if (!selected.size) return;
  isGlobe = false;
  isZoomed = true;

  const features = topojson.feature(topoData, topoData.objects.countries).features
    .filter(f => selected.has(N2A[+f.id]));
  if (!features.length) return;

  const margin = 20;
  const collection = { type: 'FeatureCollection', features };
  const proj = d3.geoNaturalEarth1().fitExtent([[margin, margin], [mapW - margin, H - margin]], collection);
  projR = proj; geoPathR = d3.geoPath(projR);
  if (rangeActive) { projL = d3.geoNaturalEarth1().fitExtent([[margin, margin], [mapW - margin, H - margin]], collection); geoPathL = d3.geoPath(projL); }
  redraw(); recolor();
  showZoomControls();
}

function resetZoom() {
  isZoomed = false;
  document.getElementById('region-select').value = 'world';
  applyRegionZoom('world');
  showZoomControls();
}

function resetView() {
  isGlobe = false;
  startYear = MIN_YEAR;
  curYear = MAX_YEAR;
  document.getElementById('region-select').value = 'world';
  if (rangeActive) {
    setRangeMode(false);   // RAF inside will redraw with full-width world projection
    syncSliderHandles();
    recolor();
    renderList();
  } else {
    applyRegionZoom('world');
  }
}

function makeRegionProj(region, w) {
  const margin = 18;
  if (region === 'world') {
    return d3.geoNaturalEarth1().scale(w / 6.3).translate([w / 2, H / 2]);
  }
  const bbox = REGION_BBOX[region];
  if (!bbox) return d3.geoNaturalEarth1().scale(w / 6.3).translate([w / 2, H / 2]);
  const [[lon0, lat0], [lon1, lat1]] = bbox;
  const bboxFeature = {
    type: 'Feature',
    geometry: {
      type: 'MultiPoint',
      coordinates: [[lon0,lat0],[lon1,lat0],[lon1,lat1],[lon0,lat1]]
    }
  };
  return d3.geoNaturalEarth1().fitExtent([[margin, margin], [w - margin, H - margin]], bboxFeature);
}

function applyRegionZoom(region) {
  projR    = makeRegionProj(region, mapW);
  geoPathR = d3.geoPath(projR);
  if (rangeActive) {
    projL    = makeRegionProj(region, mapW);
    geoPathL = d3.geoPath(projL);
  }
  redraw();
  recolor();
}

// ── Legend ───────────────────────────────────────────────────────────────────
function highlightBucket(bucketIdx) {
  // bucketIdx: -1 = no data, 0..7 = color index
  [svgL, svgR].forEach(svg => { if (svg) svg.classed('map-dimmed', true); });
  [gCountriesL, gCountriesR].forEach(gc => {
    if (!gc) return;
    gc.selectAll('.land').classed('label-hover', d => {
      const a3 = N2A[+d.id];
      const year = gc === gCountriesL ? startYear : curYear;
      const v = getVal(a3, year);
      if (bucketIdx === -1) return v == null;
      const color = v != null ? colorScale(v) : null;
      return color === COLORS[bucketIdx];
    });
  });
}

function clearBucketHighlight() {
  [svgL, svgR].forEach(svg => { if (svg) svg.classed('map-dimmed', false); });
  [gCountriesL, gCountriesR].forEach(gc => {
    if (!gc) return;
    gc.selectAll('.land').classed('label-hover', false);
  });
}

function buildLegend() {
  const leg = document.getElementById('legend');
  const labels = ['0','1','3','10','30','100','300','1,000'];

  const noData = document.createElement('div');
  noData.className = 'leg-item leg-nodata';
  noData.innerHTML = `<div class="leg-swatch"></div><div class="leg-label">No data</div>`;
  noData.addEventListener('mouseenter', () => highlightBucket(-1));
  noData.addEventListener('mouseleave', clearBucketHighlight);
  leg.appendChild(noData);

  COLORS.forEach((clr, i) => {
    const item = document.createElement('div');
    item.className = 'leg-item';
    item.innerHTML = `
      <div class="leg-swatch" style="background:${clr}"></div>
      <div class="leg-label">${labels[i]}</div>`;
    item.addEventListener('mouseenter', () => highlightBucket(i));
    item.addEventListener('mouseleave', clearBucketHighlight);
    leg.appendChild(item);
  });
}

// ── Controls ─────────────────────────────────────────────────────────────────
function showInput(el) { el.style.display = ''; }
function hideInput(el) { if (document.activeElement !== el) el.style.display = 'none'; }

function commitStart(raw) {
  const el = document.getElementById('start-input');
  const y = parseInt(raw, 10);
  if (isNaN(y)) { el.value = startYear; return; }
  startYear = Math.max(MIN_YEAR, Math.min(curYear - 1, y));
  syncSliderHandles();
  recolor();
  renderList();
}

function commitEnd(raw) {
  const el = document.getElementById('end-input');
  const y = parseInt(raw, 10);
  if (isNaN(y)) { el.value = curYear; return; }
  setYear(Math.max(rangeActive ? startYear + 1 : MIN_YEAR, Math.min(MAX_YEAR, y)));
}

function setupControls() {
  const startInput = document.getElementById('start-input');
  const endInput   = document.getElementById('end-input');

  startInput.addEventListener('change',  e => commitStart(e.target.value));
  startInput.addEventListener('keydown', e => { if (e.key === 'Enter') { commitStart(e.target.value); startInput.blur(); } });
  startInput.addEventListener('blur',    () => { startInput.style.display = 'none'; });
  endInput.addEventListener('change',    e => commitEnd(e.target.value));
  endInput.addEventListener('keydown',   e => { if (e.key === 'Enter') { commitEnd(e.target.value); endInput.blur(); } });
  endInput.addEventListener('blur',      () => { endInput.style.display = 'none'; });

  const playBtn = document.getElementById('play-btn');
  playBtn.addEventListener('click', () => {
    if (playing) {
      clearInterval(timer); playing = false; playBtn.textContent = '▶';
    } else {
      playing = true; playBtn.textContent = '⏸';
      if (curYear >= MAX_YEAR) setYear(rangeActive ? startYear : MIN_YEAR);
      timer = setInterval(() => {
        if (curYear >= MAX_YEAR) { clearInterval(timer); playing = false; playBtn.textContent = '▶'; }
        else setYear(curYear + 1);
      }, 150);
    }
  });

  document.getElementById('reset-btn').addEventListener('click', resetView);
  document.getElementById('zoom-sel-btn').addEventListener('click', zoomToSel);
  document.getElementById('reset-zoom-btn').addEventListener('click', resetZoom);
  document.getElementById('region-select').addEventListener('change', e => {
    isZoomed = e.target.value !== 'world';
    applyRegionZoom(e.target.value);
    showZoomControls();
  });
  document.getElementById('clear-btn').addEventListener('click', () => { selected.clear(); updateSel(); isGlobe = false; resetView(); });
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar() {
  document.getElementById('sb-search').addEventListener('input', e => {
    search = e.target.value.toLowerCase(); renderList();
  });
  document.getElementById('sort-dir-btn').addEventListener('click', () => {
    sortDir *= -1;
    document.getElementById('sort-dir-btn').textContent = sortDir > 0 ? '↑' : '↓';
    renderList();
  });
  renderList();
}

function fmt(v) {
  if (v == null) return null;
  if (v >= 1000) return (v / 1000).toFixed(2).replace(/\.?0+$/, '') + 'k';
  return v.toLocaleString();
}

function getMaxVal() {
  let max = 0;
  cList.forEach(c => { const v = getVal(c.code, curYear); if (v != null && v > max) max = v; });
  return max;
}

function renderItem(parent, code, name, v, isSel) {
  const item = document.createElement('div');
  item.className = 'c-item' + (isSel ? ' is-sel' : '');
  const fmtV = fmt(v);

  // Bar = row background gradient (log scale)
  const maxVal = getMaxVal();
  const barPct = (v != null && maxVal > 0)
    ? Math.log1p(v) / Math.log1p(maxVal) * 100
    : 0;
  if (barPct > 0) {
    item.style.backgroundImage =
      `linear-gradient(to right, #dde5f0 ${barPct.toFixed(1)}%, transparent ${barPct.toFixed(1)}%)`;
  }

  item.innerHTML = `
    <div class="c-box${isSel ? ' on' : ''}">${isSel ? '✓' : ''}</div>
    <span class="c-name" title="${name}">${name}</span>
    <span class="c-val${fmtV == null ? ' nd' : ''}">${fmtV ?? 'No data'}</span>`;
  item.addEventListener('click', () => {
    selected.has(code) ? selected.delete(code) : selected.add(code);
    updateSel();
  });
  parent.appendChild(item);
}

function renderSelList() {
  const el = document.getElementById('sel-list');
  el.innerHTML = '';
  selected.forEach(code => {
    const name = cList.find(c => c.code === code)?.name ?? code;
    renderItem(el, code, name, getVal(code, curYear), true);
  });
}

function renderList() {
  const el = document.getElementById('country-list');
  el.innerHTML = '';

  let list = cList.map(c => ({ ...c, v: getVal(c.code, curYear) }));
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search));

  list.sort((a, b) => {
    if (a.v == null && b.v == null) return 0;
    if (a.v == null) return 1;
    if (b.v == null) return -1;
    return sortDir * (a.v - b.v);
  });

  list.forEach(c => renderItem(el, c.code, c.name, c.v, selected.has(c.code)));
}

init();
