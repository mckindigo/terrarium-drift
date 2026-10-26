/* Terrarium Drift - UI glue, game loop, save/load. */
(function () {
  const TD = (globalThis.TD = globalThis.TD || {});
  const sim = TD.sim;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = TD.fmt;

  let S, R;
  let tab = 'grow';
  let tool = null; // {kind:'plant'|'soil', id}
  let selId = null;
  let last = Date.now();
  let lastSave = 0;
  let lastHTML = {};
  let liveVals = {};
  let quality = 1;
  const TABS = [['grow', 'Grow'], ['tend', 'Tend'], ['tinker', 'Tinker'], ['collection', 'Collection'], ['seal', 'Seal'], ['data', 'Data']];

  /* ---------------- save / load ---------------- */
  function loadSave() {
    try {
      const raw = localStorage.getItem(sim.KEY);
      if (raw) return { S: sim.parse(raw), had: true };
    } catch (e) { console.warn('Save could not be read, starting fresh.', e && e.message); }
    return { S: sim.newState(), had: false };
  }
  function persist() {
    if (TD.suspendSave) return false;
    try { localStorage.setItem(sim.KEY, sim.serialize(S)); lastSave = Date.now(); return true; } catch (e) { console.warn('Could not save', e && e.message); return false; }
  }

  /* ---------------- toasts & modal ---------------- */
  function toast(msg, kind) {
    const box = $('#toasts');
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.textContent = msg;
    box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), 4200);
    $('#logline').textContent = msg;
  }
  TD.onLog = function (m, k) { toast(m, k); };
  function showModal(html) { const m = $('#modal'); m.innerHTML = '<div class="box">' + html + '</div>'; m.hidden = false; }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }

  function showAway(sum) {
    const rows = [];
    rows.push(['Stability earned', '✦ ' + fmt(sum.stability)]);
    if (sum.seeds) rows.push(['Rare seeds found', '◆ ' + sum.seeds]);
    if (sum.morphs.length) rows.push(['Rare morphs bloomed', String(sum.morphs.length)]);
    if (sum.pairs.length) rows.push(['Symbioses formed', String(sum.pairs.length)]);
    if (sum.lost) rows.push(['Plants that withered', String(sum.lost)]);
    if (sum.collapses) rows.push(['Collapses', '<span style="color:var(--bad)">' + sum.collapses + '</span>']);
    const calmNow = S.jar.calm;
    const eff = Math.round(sum.eff * 100);
    let html = '<h2>While you were away</h2><div class="sub">' + TD.fmtTime(sum.real) + ' passed' + (sum.capped ? ' (progress counts up to ' + TD.fmtTime(TD.OFFLINE_CAP) + ')' : '') + '. The jar ran at ' + eff + '% efficiency' + (eff < 100 ? ' (upgrade the Night Lantern to raise it)' : '') + '.</div>';
    html += rows.map((r) => '<div class="sumrow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    if (sum.morphs.length) html += '<div class="notes"><b>New growth:</b> ' + esc(sum.morphs.slice(0, 6).join(', ')) + (sum.morphs.length > 6 ? '…' : '') + '</div>';
    if (sum.pairs.length) html += '<div class="notes"><b>Bonded:</b> ' + esc(sum.pairs.join(', ')) + '</div>';
    if (sum.collapses) html += '<div class="notes">The jar collapsed while unattended, but it is regrowing from the ruin. A Dew Wick and Fog Valve will keep it steadier.</div>';
    else if (!sum.morphs.length && !sum.pairs.length) html += '<div class="notes">A quiet, steady stretch. Long calm lets rare morphs and symbioses appear.</div>';
    html += '<div class="notes">Calm is now ' + TD.fmtTime(calmNow) + '.</div>';
    html += '<div class="actions"><button class="btn primary" data-act="modal:close">Welcome back</button></div>';
    showModal(html);
  }

  /* ---------------- helpers for display ---------------- */
  const lightLabel = (v) => (v < 0.4 ? 'Shade' : v < 0.7 ? 'Part sun' : 'Full sun');
  const waterLabel = (sp) => (sp.whi <= 0.45 ? 'Dry' : sp.wlo >= 0.6 ? 'Wet' : 'Moist');
  function strainLabel(v) { return v < 30 ? 'Calm' : v < 55 ? 'Uneasy' : v < 80 ? 'Fogging' : 'Critical'; }
  function calmText(J) {
    const t = sim.calmTier(J);
    return TD.fmtTime(J.calm) + (t ? ' · ' + TD.MORPHS[t].name : '');
  }
  const can = (cost) => (S.jar.stability >= cost ? 'can' : 'cant');

  /* ---------------- tab renderers ---------------- */
  function icon(spId, morph, hidden) {
    return '<canvas width="112" height="128" data-icon="' + spId + '" data-morph="' + (morph || 0) + '"' + (hidden ? ' data-hidden="1"' : '') + '></canvas>';
  }

  function growHTML() {
    const J = S.jar, M = S.meta;
    let h = '<h3>Plants</h3><div class="grid">';
    for (const sp of TD.PLANTS) {
      const locked = !M.biomes[sp.biome];
      const sel = tool && tool.kind === 'plant' && tool.id === sp.id;
      if (locked) {
        h += '<div class="card pcard locked">' + icon(sp.id, 0, true) + '<div><h5>' + esc(sp.name) + '</h5><p>Unlock ' + esc(TD.BIOMES[sp.biome].name) + ' in Tinker</p></div></div>';
        continue;
      }
      h += '<button class="card pcard ' + can(sp.cost) + (sel ? ' sel' : '') + '" data-act="tool:plant:' + sp.id + '" title="' + esc(sp.desc) + '">' + icon(sp.id, 0) +
        '<div><h5>' + esc(sp.name) + '</h5><span class="cost">✦ ' + fmt(sp.cost) + '</span><div class="tags"><span class="tag">' + lightLabel(sp.light) + '</span><span class="tag">' + waterLabel(sp) + '</span><span class="tag">✦' + sp.yield + '/s</span></div></div></button>';
    }
    h += '</div><p class="muted" style="margin-top:6px">Pick a plant, then tap an empty column in the jar. Shade, water and soil decide how well it grows.</p>';
    h += '<h3>Soil layers</h3><div class="grid">';
    for (const id of TD.SOIL_ORDER) {
      const s = TD.SOILS[id];
      const locked = !M.biomes[s.biome];
      const sel = tool && tool.kind === 'soil' && tool.id === id;
      const sw = 'background:hsl(' + s.base[0] + ',' + s.base[1] + '%,' + (s.base[2] + 4) + '%)';
      if (locked) { h += '<div class="card locked"><h5><span><span class="swatch" style="' + sw + '"></span>' + s.name + '</span></h5><p>Unlock ' + esc(TD.BIOMES[s.biome].name) + '</p></div>'; continue; }
      h += '<button class="card ' + can(TD.SOIL_COST) + (sel ? ' sel' : '') + '" data-act="tool:soil:' + id + '"><h5><span><span class="swatch" style="' + sw + '"></span>' + s.name + '</span><span class="cost">✦ ' + TD.SOIL_COST + '</span></h5><p>' + esc(s.note) + ' Holds ' + Math.round(s.ret * 100) + '% water, ' + Math.round(s.fert * 100) + '% fertile.</p></button>';
    }
    h += '</div><p class="muted" style="margin-top:6px">Pick a soil, then tap or drag across the three soil layers in the jar. Dry plants want sand and gravel; wet plants want peat and clay.</p>';
    h += '<h3>Critters</h3><div class="grid wide">';
    for (const ins of TD.INSECTS) {
      if (ins.pest) continue;
      const avail = sim.insectAvailable(S, ins);
      const pop = J.P[ins.id] || 0;
      if (!avail) { h += '<div class="card locked"><h5>???</h5><p>Appears after ✦' + fmt(ins.unlock) + ' earned' + (ins.id === 'beetle' ? ', or when aphids arrive' : '') + '.</p></div>'; continue; }
      h += '<button class="card ' + can(ins.cost) + '" data-act="release:' + ins.id + '"><h5><span><span class="swatch" style="background:' + ins.col + ';border-radius:50%"></span>' + ins.name + '</span><span class="cost">✦ ' + ins.cost + '</span></h5><p>' + esc(ins.desc) + '</p><p>In jar: <span data-lt="pop_' + ins.id + '"></span></p></button>';
    }
    h += '</div>';
    return h;
  }

  function alerts() {
    const J = S.jar, out = [];
    const avgw = J.w.reduce((a, b) => a + b, 0) / J.cols;
    if (avgw < 0.3) out.push({ k: 'bad', t: 'The soil is drying out. Mist the jar (or buy a Dew Wick).' });
    if (J.P.aphid >= 1) out.push({ k: 'bad', t: 'Aphids are feeding on your plants. Release Dot Beetles or Lacewings.' });
    const over = J.plants.filter((p) => p.size > 1.1).length;
    if (over) out.push({ k: 'info', t: over + ' plant' + (over > 1 ? 's are' : ' is') + ' overgrown. Prune for a burst of stability and less shade.' });
    if (J.strain > 55) out.push({ k: 'bad', t: 'Strain is ' + Math.round(J.strain) + '%. At 100% the jar collapses. Fix whatever is hurting the plants.' });
    if (J.D / J.cols > 0.7) out.push({ k: 'bad', t: 'Leaf litter is piling up. Springtails, Pillbugs and Bellcaps recycle it.' });
    const weak = J.plants.filter((p) => p.hp < 0.35 && p.size > 0.1).length;
    if (weak) out.push({ k: 'bad', t: weak + ' plant' + (weak > 1 ? 's are' : ' is') + ' struggling. Select one in the jar for advice.' });
    if (J.recover > 0) out.push({ k: 'info', t: 'Regrowing after the collapse (growth is doubled for ' + TD.fmtTime(J.recover) + ').' });
    if (!out.length) out.push({ k: 'ok', t: 'All is well. Leave the jar alone for a while: long calm lets rare morphs and symbioses appear.' });
    return out;
  }

  function tendHTML() {
    const J = S.jar, M = S.meta;
    let h = '<button class="btn primary big-btn" data-act="mist">Mist the jar<i data-lw="mist"></i></button>';
    h += '<h3>Needs attention</h3>';
    for (const a of alerts()) h += '<div class="alert ' + a.k + '">' + esc(a.t) + '</div>';
    const over = J.plants.filter((p) => p.size > 0.9).length;
    h += '<div class="row2"><button class="btn ' + (over ? '' : 'cant') + '" data-act="pruneall">Prune big plants (' + over + ')</button><span class="muted">Overgrown plants pay a stability burst.</span></div>';
    h += '<h3>Soil gauges</h3><div class="gauges">';
    for (let c = 0; c < J.cols; c++) h += '<div class="gauge"><i class="w" data-lh="w' + c + '"></i><i class="n" data-lh="n' + c + '"></i></div>';
    h += '</div><div class="legend"><b class="w"></b>Moisture<b class="n"></b>Nutrients (per column, left to right)</div>';
    h += '<h3>Ecosystem</h3><div class="grid wide">';
    for (const ins of TD.INSECTS) {
      const pop = J.P[ins.id] || 0;
      if (pop < 0.1 && !(M.col.insects[ins.id] && !ins.pest)) continue;
      h += '<div class="card"><h5><span><span class="swatch" style="background:' + ins.col + ';border-radius:50%"></span>' + ins.name + '</span><span class="cost" data-lt="pop_' + ins.id + '"></span></h5></div>';
    }
    h += '<div class="card"><h5>Leaf litter<span class="cost" data-lt="detr"></span></h5><p>Recycled into nutrients by microbes and decomposers.</p></div>';
    h += '<div class="card"><h5>Air humidity<span class="cost" data-lt="air"></span></h5><p>Too much fog invites rot.</p></div></div>';
    h += '<h3>Rare seeds</h3><p class="muted">You have <b data-lt="seedsT"></b> rare seed(s). Select a plant in the jar and press <b>Graft</b> to try for a color morph: it needs at least 5 minutes of calm, and the longer the calm, the rarer the morph.</p>';
    return h;
  }

  function pips(n, max) { let s = '<div class="pipsrow">'; for (let i = 0; i < max; i++) s += '<span class="' + (i < n ? 'on' : '') + '"></span>'; return s + '</div>'; }

  function tinkerHTML() {
    const J = S.jar, M = S.meta;
    let h = '';
    const groups = ['Growth', 'Jar', 'Tenders', 'Away'];
    for (const g of groups) {
      h += '<h3>' + (g === 'Tenders' ? 'Automatic tenders' : g === 'Away' ? 'While away' : g) + '</h3><div class="grid wide">';
      for (const u of TD.UPGRADES.filter((x) => x.group === g)) {
        const lvl = sim.lvl(J, u.id), cost = sim.upgradeCost(S, u.id);
        const maxed = lvl >= u.max;
        const wmax = u.id === 'width' && J.cols >= TD.MAX_COLS;
        h += '<button class="card ' + (maxed || wmax ? 'locked' : can(cost)) + '" data-act="buy:' + u.id + '"><h5><span>' + esc(u.name) + '</span><span class="cost">' + (maxed || wmax ? 'MAX' : '✦ ' + fmt(cost)) + '</span></h5>' + pips(lvl, u.max) + '<p>' + esc(u.desc) + '</p></button>';
      }
      h += '</div>';
    }
    h += '<h3>Biomes</h3><div class="grid wide">';
    for (const b of Object.values(TD.BIOMES)) {
      const has = !!M.biomes[b.id];
      if (b.id === 'temperate') continue;
      h += '<button class="card ' + (has ? 'locked' : can(b.cost)) + '" data-act="biome:' + b.id + '"><h5><span>' + esc(b.name) + '</span><span class="cost">' + (has ? 'Unlocked' : '✦ ' + fmt(b.cost)) + '</span></h5><p>' + esc(b.desc) + '</p><p>Permanent. Also +5% stability for every unlocked biome.</p></button>';
    }
    h += '</div>';
    return h;
  }

  function collectionHTML() {
    const M = S.meta, J = S.jar;
    const n = sim.collectionCount(M), tot = sim.collectionTotal();
    let h = '<p class="muted">Collected <b>' + n + ' / ' + tot + '</b> entries: <b>+' + (n * 0.5).toFixed(1) + '%</b> stability, forever. Rare morphs and symbioses only appear after long, calm idle stretches (and while you are away).</p>';
    h += '<h3>Plants &amp; morphs</h3><div class="grid">';
    for (const sp of TD.PLANTS) {
      const seen = !!M.col.plants[sp.id];
      h += '<div class="card pcard ' + (seen ? '' : 'locked') + '">' + icon(sp.id, 0, !seen) + '<div><h5>' + (seen ? esc(sp.name) : '???') + '</h5><div class="pips">';
      for (let m = 1; m <= 3; m++) { const on = M.col.morphs[sp.id + ':' + m]; h += '<span class="pip ' + (on ? 'on' : '') + '" style="color:' + (on ? 'hsl(' + TD.MORPHS[m].hue.acc + ',80%,70%)' : '#fff') + '" title="' + TD.MORPHS[m].name + '"></span>'; }
      h += '</div><p>' + (seen ? Object.keys(M.col.morphs).filter((k) => k.startsWith(sp.id + ':')).length + '/3 morphs' : 'Not yet grown') + '</p></div></div>';
    }
    h += '</div><h3>Morph forms</h3><div class="grid wide">';
    for (let m = 1; m <= 3; m++) { const mo = TD.MORPHS[m]; h += '<div class="card"><h5><span style="color:hsl(' + mo.hue.acc + ',80%,72%)">' + mo.name + '</span><span class="cost">×' + mo.mult + '</span></h5><p>' + mo.desc + ' Yields ×' + mo.mult + '.</p></div>'; }
    h += '</div><h3>Critters seen</h3><div class="grid">';
    for (const ins of TD.INSECTS) { const seen = !!M.col.insects[ins.id]; h += '<div class="card ' + (seen ? '' : 'locked') + '"><h5><span><span class="swatch" style="background:' + (seen ? ins.col : '#555') + ';border-radius:50%"></span>' + (seen ? esc(ins.name) : '???') + '</span></h5></div>'; }
    h += '</div><h3>Symbiotic pairs</h3><div class="grid wide">';
    for (const pr of TD.PAIRS) {
      const found = !!M.col.pairs[pr.id];
      const prog = Math.min(1, (J.bond[pr.id] || 0) / pr.req);
      const a = TD.PLANT[pr.a].name, b = pr.b ? TD.PLANT[pr.b].name : TD.INSECT[pr.ib].name;
      h += '<div class="card ' + (found ? '' : 'locked') + '"><h5><span style="color:var(--rare)">' + (found ? esc(pr.name) : '???') + '</span>' + (found ? '<span class="cost">+' + Math.round(pr.bonus * 100) + '%</span>' : '') + '</h5><p>' + (found ? esc(pr.desc) + ' ' : '') + esc(a) + ' + ' + esc(b) + (found ? '' : ' · bond ' + Math.round(prog * 100) + '%') + '</p></div>';
    }
    h += '</div>';
    return h;
  }

  function sealHTML() {
    const J = S.jar, M = S.meta;
    const chk = sim.canSeal(S);
    let h = '<h3>Sealed exhibits</h3>';
    if (!M.exhibits.length) h += '<p class="muted">Seal a mature terrarium into a permanent exhibit. It glows on your shelf and boosts stability in every future jar, and the next jar starts with better conditions.</p>';
    else {
      h += '<div class="exhibits">' + M.exhibits.map((e) => '<div class="exhibit">' + (e.thumb ? '<img alt="Exhibit ' + e.id + '" src="' + e.thumb + '">' : '') + 'Exhibit ' + e.id + '<br>+' + Math.round(e.radiance * 100) + '% · ' + e.species + ' species</div>').join('') + '</div>';
      h += '<p class="muted">Total exhibit bonus: <b>×' + sim.exhibitMult(M).toFixed(2) + '</b> stability.</p>';
    }
    h += '<h3>Seal this jar</h3><ul class="req">';
    const req = chk.req;
    h += '<li class="' + (J.lifetime >= req ? 'ok' : '') + '">Earn ✦' + fmt(req) + ' in this jar (<span data-lt="life"></span>)</li>';
    h += '<li class="' + ((J.playAge || 0) >= TD.SEAL_MIN_AGE ? 'ok' : '') + '">Tend the jar for ' + TD.fmtTime(TD.SEAL_MIN_AGE) + ' of active play (<span data-lt="age"></span>)</li>';
    const sc = sim.speciesCount(J);
    h += '<li class="' + (sc >= TD.SEAL_MIN_SPECIES ? 'ok' : '') + '">Grow ' + TD.SEAL_MIN_SPECIES + '+ plant species (' + sc + ')</li></ul>';
    h += '<div class="bar" style="height:8px;background:rgba(255,255,255,.1);border-radius:6px;overflow:hidden"><i data-lw="sealprog" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#c9a24a,#f6d98a)"></i></div>';
    const rad = sim.exhibitRadiance(S);
    h += '<p class="muted">Sealing now would grant <b>+' + Math.round(rad * 100) + '%</b> permanent stability (more species, rare morphs and active symbioses make a brighter exhibit).</p>';
    const n = M.exhibits.length + 1;
    h += '<p class="muted">The next jar starts with ✦' + fmt(40 + 120 * n + (n > 0 ? 40 * n * n : 0)) + ', ' + Math.min(8, 5 + Math.floor(n / 2)) + ' columns, richer soil' + (n >= 1 ? ', a Dew Wick tender' : '') + (n >= 2 ? ', Silver Snips' : '') + (n >= 3 ? ', a Compost Tender' : '') + '. Biomes, the collection and rare seeds are kept.</p>';
    h += '<button class="btn gold big-btn ' + (chk.ok ? '' : 'cant') + '" data-act="seal">' + (chk.ok ? 'Seal this terrarium' : 'Not ready to seal') + '</button>';
    return h;
  }

  function dataHTML() {
    const M = S.meta;
    let h = '<h3>Save</h3><p class="muted">Your jar autosaves every 10 seconds to this browser, and when you leave. Last save: <span data-lt="saved"></span>.</p>';
    h += '<div class="row2"><button class="btn primary" data-act="save">Save now</button><button class="btn" data-act="export">Export save text</button><button class="btn" data-act="quality">Visuals: ' + (quality >= 1 ? 'Full' : 'Light') + '</button></div>';
    h += '<textarea id="savebox" spellcheck="false" placeholder="Export puts your save text here. To import, paste a save and press Import."></textarea>';
    h += '<div class="row2"><button class="btn" data-act="import">Import pasted save</button><button class="btn" data-act="reset">Erase everything…</button></div>';
    h += '<h3>Stats</h3><p class="muted">Time played: ' + TD.fmtTime(M.playSec) + ' · Total stability: ✦' + fmt(M.totalEarned) + ' · Collapses survived: ' + M.collapses + ' · Exhibits: ' + M.exhibits.length + '</p>';
    h += '<h3>Journal</h3><div class="loglist">' + S.jar.log.slice(-14).reverse().map((l) => '<div class="' + (l.k || '') + '">' + esc(l.m) + '</div>').join('') + '</div>';
    h += '<h3>How it works</h3><p class="muted">Plants make <b>stability</b> (✦). Tall plants shade their neighbours; each plant wants its own light, moisture and nutrients. Dead leaves feed decomposers, which feed the soil. Pests eat plants, predators eat pests. If <b>harmony</b> stays low, <b>strain</b> builds and the jar collapses. A collapse hurts but is recoverable. Leave the jar calm for a long time and rare morphs and symbiotic pairs appear. Seal a mature jar to start a better one.</p>';
    return h;
  }

  const BUILD = { grow: growHTML, tend: tendHTML, tinker: tinkerHTML, collection: collectionHTML, seal: sealHTML, data: dataHTML };

  function renderTabs() {
    const J = S.jar;
    const chk = sim.canSeal(S);
    const warn = alerts().some((a) => a.k === 'bad');
    const html = TABS.map(([id, label]) => '<button role="tab" class="' + (tab === id ? 'on' : '') + '" data-act="tab:' + id + '">' + label + (id === 'tend' && warn ? '<span class="dot bad"></span>' : '') + (id === 'seal' && chk.ok ? '<span class="dot"></span>' : '') + '</button>').join('');
    if (lastHTML.tabs !== html) { $('#tabs').innerHTML = html; lastHTML.tabs = html; }
  }

  function renderTab(force) {
    const body = $('#tabbody');
    let html = BUILD[tab]();
    if (tab === 'data') { const ta = $('#savebox'); if (ta && !force) html = lastHTML.body; }
    if (force || html !== lastHTML.body || lastHTML.tab !== tab) {
      const sc = lastHTML.tab === tab ? body.scrollTop : 0;
      const ta = tab === 'data' && $('#savebox') ? $('#savebox').value : null;
      body.innerHTML = html;
      body.scrollTop = sc;
      if (ta != null) $('#savebox').value = ta;
      lastHTML.body = html; lastHTML.tab = tab;
      body.querySelectorAll('canvas[data-icon]').forEach((cv) => TD.drawPlantIcon(cv, cv.dataset.icon, +cv.dataset.morph, !!cv.dataset.hidden));
    }
    renderTabs();
  }

  /* ---------------- selection card ---------------- */
  function selPlant() { return selId == null ? null : S.jar.plants.find((p) => p.id === selId) || null; }
  function renderSel() {
    const el = $('#selcard');
    const p = selPlant();
    if (!p) { if (!el.hidden) { el.hidden = true; el.innerHTML = ''; lastHTML.sel = ''; } if (selId != null) { selId = null; R.selected = null; } return; }
    const sp = TD.PLANT[p.sp], J = S.jar;
    const adv = sim.plantAdvice(S, p);
    const canGraft = S.meta.seeds >= 1 && J.calm >= 300;
    const html = '<h4>' + esc(sp.name) + (p.morph ? '<em>' + TD.MORPHS[p.morph].name + ' morph ×' + TD.MORPHS[p.morph].mult + '</em>' : '') + '</h4>' +
      '<div class="row"><label>Health</label><div class="bar"><i data-lw="s_hp" style="background:#8be0a8"></i></div></div>' +
      '<div class="row"><label>Growth</label><div class="bar"><i data-lw="s_size" style="background:#e9d27a"></i></div></div>' +
      '<div class="row"><label>Light</label><div class="bar"><i data-lw="s_L" style="background:#fff2a8"></i></div><span>wants ' + lightLabel(sp.light).toLowerCase() + '</span></div>' +
      '<div class="row"><label>Water</label><div class="bar"><i data-lw="s_w" style="background:#6db8f0"></i></div><span>wants ' + waterLabel(sp).toLowerCase() + '</span></div>' +
      '<div class="row"><label>Nutrients</label><div class="bar"><i data-lw="s_n" style="background:#8bd36a"></i></div></div>' +
      '<div class="advice">' + esc(adv.join(' ')) + '</div>' +
      '<div class="btns"><button class="btn" data-act="sel:prune">Prune</button><button class="btn ' + (canGraft ? 'primary' : 'cant') + '" data-act="sel:graft" title="Spend a rare seed to roll a morph (needs 5 min of calm)">Graft ◆</button><button class="btn" data-act="sel:uproot">Uproot</button><button class="btn" data-act="sel:close">Close</button></div>';
    if (html !== lastHTML.sel) { el.innerHTML = html; lastHTML.sel = html; }
    el.hidden = false;
  }

  /* ---------------- live values ---------------- */
  function computeLive() {
    const J = S.jar, M = S.meta;
    const v = {};
    for (const ins of TD.INSECTS) v['pop_' + ins.id] = (J.P[ins.id] || 0).toFixed(1);
    v.detr = (J.D / J.cols).toFixed(2);
    v.air = Math.round(J.A * 100) + '%';
    v.seedsT = String(M.seeds);
    v.life = fmt(J.lifetime);
    v.age = TD.fmtTime(J.playAge || 0);
    v.saved = lastSave ? TD.fmtTime((Date.now() - lastSave) / 1000) + ' ago' : 'not yet';
    v.mist = 1 - J.mistCd / 10;
    v.sealprog = Math.min(1, J.lifetime / sim.sealRequirement(M));
    for (let c = 0; c < J.cols; c++) { v['w' + c] = J.w[c] * 100; v['n' + c] = Math.min(100, (J.nutr[c] / Math.max(0.1, sim.soilStat(J, c).fert)) * 100); }
    const p = selPlant();
    if (p) { v.s_hp = p.hp; v.s_size = Math.min(1, p.size); v.s_L = p.L; v.s_w = J.w[Math.min(p.c, J.cols - 1)]; v.s_n = Math.min(1, J.nutr[Math.min(p.c, J.cols - 1)] / Math.max(0.1, sim.soilStat(J, Math.min(p.c, J.cols - 1)).fert)); }
    return v;
  }
  function applyLive() {
    liveVals = computeLive();
    document.querySelectorAll('[data-lt]').forEach((e) => { const x = liveVals[e.dataset.lt]; if (x != null) e.textContent = x; });
    document.querySelectorAll('[data-lw]').forEach((e) => { const x = liveVals[e.dataset.lw]; if (x != null) e.style.width = Math.max(0, Math.min(1, x)) * 100 + '%'; });
    document.querySelectorAll('[data-lh]').forEach((e) => { const x = liveVals[e.dataset.lh]; if (x != null) e.style.height = Math.max(3, Math.min(100, x)) + '%'; });
  }
  function header() {
    const J = S.jar, M = S.meta;
    $('#v-stab').textContent = fmt(J.stability);
    $('#v-rate').textContent = '+' + fmt(J.rate) + '/s';
    $('#v-seeds').textContent = M.seeds;
    $('#b-harm').style.width = Math.round(Math.max(0, Math.min(1, J.harmony)) * 100) + '%';
    $('#v-harm').textContent = Math.round(J.harmony * 100) + '%';
    $('#b-strain').style.width = Math.round(J.strain) + '%';
    $('#v-strain').textContent = strainLabel(J.strain);
    $('#v-calm').textContent = calmText(J);
  }

  /* ---------------- actions ---------------- */
  function result(r) {
    if (!r) return;
    if (r.msg) toast(r.msg, r.ok ? '' : 'bad');
    refresh(true);
  }
  function refresh(force) { header(); renderTab(force); renderSel(); applyLive(); updateHint(); }

  function updateHint() {
    const el = $('#toolhint');
    if (!tool) { el.hidden = true; R.tool = null; return; }
    const name = tool.kind === 'plant' ? TD.PLANT[tool.id].name : TD.SOILS[tool.id].name + ' soil';
    const html = (tool.kind === 'plant' ? 'Tap an empty column to plant ' : 'Tap a soil layer to lay ') + '<b>' + esc(name) + '</b><button data-act="tool:none">Done</button>';
    if (lastHTML.hint !== html) { el.innerHTML = html; lastHTML.hint = html; }
    el.hidden = false; R.tool = tool;
  }

  function act(a) {
    const [k, x, y] = a.split(':');
    switch (k) {
      case 'tab': tab = x; refresh(true); break;
      case 'modal': closeModal(); break;
      case 'tool':
        tool = x === 'none' ? null : { kind: x, id: y };
        if (tool) { selId = null; R.selected = null; }
        refresh(true); break;
      case 'release': result(sim.introduce(S, x)); break;
      case 'buy': result(sim.buyUpgrade(S, x)); break;
      case 'biome': result(sim.buyBiome(S, x)); break;
      case 'mist': result(sim.mist(S, true)); break;
      case 'pruneall': {
        let n = 0, bonus = 0;
        for (const p of S.jar.plants.slice()) if (p.size > 0.9) { const r = sim.prune(S, p, true); if (r.ok) { n++; bonus += r.bonus || 0; } }
        result({ ok: n > 0, msg: n ? 'Pruned ' + n + ' plant' + (n > 1 ? 's' : '') + (bonus ? ' (+' + fmt(bonus) + ' stability)' : '.') : 'Nothing big enough to prune.' });
        break;
      }
      case 'sel': {
        const p = selPlant(); if (!p && x !== 'close') break;
        if (x === 'prune') result(sim.prune(S, p, true));
        else if (x === 'graft') result(sim.graft(S, p));
        else if (x === 'uproot') { result(sim.uproot(S, p)); selId = null; R.selected = null; refresh(true); }
        else { selId = null; R.selected = null; refresh(true); }
        break;
      }
      case 'seal': openSeal(); break;
      case 'sealgo': doSeal(); break;
      case 'save': { const ok = persist(); toast(ok ? 'Saved.' : 'Could not save (storage unavailable).', ok ? '' : 'bad'); refresh(true); break; }
      case 'export': {
        const txt = sim.exportText(S);
        const ta = $('#savebox'); if (ta) { ta.value = txt; ta.focus(); ta.select(); }
        let copied = false;
        try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(() => toast('Save text copied to clipboard.'), () => {}); copied = true; } } catch (e) { /* ignore */ }
        toast(copied ? 'Save text ready (copying to clipboard).' : 'Save text ready: copy it from the box.');
        break;
      }
      case 'import': doImport(); break;
      case 'reset':
        showModal('<h2>Erase everything?</h2><div class="sub">This deletes your jar, exhibits and collection from this browser. Export your save first if you might want it back.</div><div class="actions"><button class="btn" data-act="modal:close">Keep playing</button><button class="btn gold" data-act="resetgo">Erase</button></div>');
        break;
      case 'resetgo': S = sim.newState(); selId = null; tool = null; R.selected = null; closeModal(); persist(); lastHTML = {}; last = Date.now(); toast('A fresh jar.'); refresh(true); break;
      case 'quality': quality = quality >= 1 ? 0.5 : 1; R.quality = quality; S.meta.settings.quality = quality; refresh(true); break;
      default: break;
    }
  }

  function openSeal() {
    const chk = sim.canSeal(S);
    if (!chk.ok) { toast(chk.why[0], 'bad'); return; }
    const M = S.meta;
    const rad = sim.exhibitRadiance(S);
    const opts = Object.values(TD.BIOMES).filter((b) => M.biomes[b.id]).map((b) => '<option value="' + b.id + '"' + (b.id === M.startBiome ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('');
    const thumb = R.snapshot(130, 150);
    showModal('<h2>Seal this terrarium?</h2><div class="sub">It becomes a permanent exhibit: <b>+' + Math.round(rad * 100) + '%</b> stability, forever. A new jar begins with better starting conditions.</div>' + (thumb ? '<img class="thumb" alt="Preview" src="' + thumb + '">' : '') +
      '<div class="sumrow"><span>Start the next jar as</span><select id="startBiome">' + opts + '</select></div><div class="notes">Resets this jar\'s plants, upgrades and stability. Keeps biomes, rare seeds, the collection and all exhibits.</div>' +
      '<div class="actions"><button class="btn" data-act="modal:close">Not yet</button><button class="btn gold" data-act="sealgo">Seal it</button></div>');
  }
  function doSeal() {
    const sel = $('#startBiome');
    const biome = sel ? sel.value : 'temperate';
    const thumb = R.snapshot(130, 150);
    const r = sim.seal(S, biome, thumb);
    closeModal();
    if (!r.ok) { toast(r.msg, 'bad'); return; }
    selId = null; R.selected = null; tool = null;
    persist();
    toast(r.msg, 'rare');
    tab = 'seal';
    refresh(true);
  }
  function doImport() {
    const ta = $('#savebox');
    const txt = ta ? ta.value.trim() : '';
    if (!txt) { toast('Paste save text into the box first.', 'bad'); return; }
    try {
      const ns = sim.importText(txt);
      S = ns; selId = null; tool = null; R.selected = null; lastHTML = {}; last = Date.now();
      S.savedAt = Date.now();
      persist();
      toast('Save imported.', 'good');
      refresh(true);
    } catch (e) { toast('Import failed: ' + (e && e.message ? e.message : 'invalid save'), 'bad'); }
  }

  /* ---------------- ticking ---------------- */
  function tick() {
    const now = Date.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) return;
    if (dt > 45) {
      const sum = sim.runOffline(S, dt);
      showAway(sum);
      persist();
    } else {
      while (dt > 1e-6) { const d = Math.min(dt, 2); sim.step(S, d, {}); dt -= d; }
    }
    if (now - lastSave > 10000) persist();
    refresh(false);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    const loaded = loadSave();
    S = loaded.S;
    quality = S.meta.settings && S.meta.settings.quality === 0.5 ? 0.5 : 1;
    const canvas = $('#jar');
    R = TD.createRenderer(canvas);
    R.quality = quality;
    let pending = null;
    if (loaded.had) {
      const away = (Date.now() - (S.savedAt || Date.now())) / 1000;
      if (away > 45) { pending = sim.runOffline(S, away); }
    }
    last = Date.now();
    lastSave = loaded.had ? S.savedAt || 0 : 0;
    if (!loaded.had) { persist(); S.jar.log.push({ t: 0, m: 'Welcome. Plant something small, and keep the glass misty.' }); }
    // events
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (t && !t.disabled) { act(t.dataset.act); }
    });
    canvas.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; painting = true; clickCanvas(e); });
    window.addEventListener('pointerup', () => { painting = false; lastCell = ''; });
    canvas.addEventListener('pointermove', (e) => {
      const h = R.hit(e.clientX, e.clientY, S);
      R.hover = h && tool ? h : null;
      if (painting && tool && tool.kind === 'soil' && h && h.row >= 0) { const key = h.c + ':' + h.row; if (key !== lastCell) { lastCell = key; paintSoil(h); } }
    });
    canvas.addEventListener('pointerleave', () => { R.hover = null; });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { tool = null; selId = null; R.selected = null; closeModal(); refresh(true); } });
    let rz = 0;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => R.resize(), 120); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); else tick(); });
    window.addEventListener('pagehide', persist);
    window.addEventListener('beforeunload', persist);
    renderTab(true); refresh(true);
    if (pending && pending.real > 90) showAway(pending);
    setInterval(tick, 500);
    // render loop, capped at ~30fps and paused when hidden
    let lastDraw = 0, frames = 0, acc = 0;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frameMs = reduce ? 50 : 33;
    function frame(ts) {
      requestAnimationFrame(frame);
      if (document.hidden) { lastDraw = ts; return; }
      if (ts - lastDraw < frameMs - 2) return;
      const dtr = Math.min(0.2, (ts - lastDraw) / 1000);
      lastDraw = ts;
      const t0 = performance.now();
      try { R.draw(S, dtr, ts / 1000); } catch (err) { console.error('render error', err); }
      acc += performance.now() - t0; frames++;
      if (frames >= 90) { if (acc / frames > 14 && R.quality > 0.5) { R.quality = 0.5; quality = 0.5; } acc = 0; frames = 0; }
    }
    requestAnimationFrame(frame);
    TD.app = {
      get S() { return S; }, get R() { return R; }, tick, act, persist, refresh, showAway, toast,
      setState(ns) { S = ns; last = Date.now(); lastHTML = {}; selId = null; refresh(true); },
      select(id) { selId = id; R.selected = id; refresh(true); },
      get tab() { return tab; },
    };
  }
  let painting = false, lastCell = '', downPos = null;
  function paintSoil(h) { result(sim.setSoil(S, h.c, h.row, tool.id)); }
  function clickCanvas(e) {
    const h = R.hit(e.clientX, e.clientY, S);
    if (!h) { if (!tool) { selId = null; R.selected = null; refresh(true); } return; }
    if (tool && tool.kind === 'plant') {
      if (h.plant) { selId = h.plant.id; R.selected = selId; tool = null; refresh(true); return; }
      const r = sim.place(S, tool.id, h.c);
      result(r);
      if (!r.ok && /enough/.test(r.msg)) { tool = null; refresh(true); }
    } else if (tool && tool.kind === 'soil') {
      if (h.row >= 0) { lastCell = h.c + ':' + h.row; paintSoil(h); }
    } else {
      if (h.plant) { selId = h.plant.id; R.selected = selId; } else { selId = null; R.selected = null; }
      refresh(true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
