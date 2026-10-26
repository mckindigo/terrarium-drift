/* Terrarium Drift - simulation (no DOM). */
(function () {
  const TD = (globalThis.TD = globalThis.TD || {});
  const PL = () => TD.PLANT;
  const IN = () => TD.INSECT;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  TD.rng = function (seed) {
    seed = seed | 0;
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const sim = (TD.sim = {});
  TD.fx = TD.fx || []; // transient visual events consumed by the renderer
  TD.fxMute = false;
  TD.pushFx = function (e) { if (TD.fxMute) return; TD.fx.push(e); if (TD.fx.length > 60) TD.fx.shift(); };

  /* ---------- state ---------- */
  sim.newMeta = function () {
    return {
      biomes: { temperate: true },
      seeds: 0,
      col: { plants: {}, morphs: {}, insects: {}, pairs: {} },
      exhibits: [],
      collapses: 0,
      playSec: 0,
      totalEarned: 0,
      startBiome: 'temperate',
      settings: { sound: false, quality: 1 },
    };
  };

  sim.startCols = function (M) {
    return Math.min(8, 5 + Math.floor(M.exhibits.length / 2));
  };

  sim.newJar = function (M, biome) {
    const n = M.exhibits.length;
    const cols = sim.startCols(M);
    const J = {
      id: Date.now() % 1e9,
      age: 0,
      playAge: 0,
      cols,
      soil: [],
      plants: [],
      nextId: 1,
      nutr: [],
      w: [],
      A: 0.4,
      D: 0.2,
      P: { spring: 0, pill: 0, aphid: 0, beetle: 0, moth: 0, lace: 0 },
      strain: 0,
      immune: 0,
      recover: 0,
      stability: 40 + 120 * n + (n > 0 ? 40 * n * n : 0),
      lifetime: 0,
      calm: 0,
      upg: {},
      bond: {},
      seedProg: 0,
      mistCd: 0,
      t: { mist: 0, snips: 0, ward: 0, event: 0 },
      seenAphid: false,
      harmony: 0.7,
      rate: 0,
      morphs: 0,
      pairsFound: 0,
      lastCollapse: 0,
      collapses: 0,
      log: [],
    };
    // heirloom starts: tenders from earlier exhibits
    if (n >= 1) J.upg.mister = 1;
    if (n >= 2) J.upg.snips = 1;
    if (n >= 3) J.upg.compost = 1;
    if (n >= 4) J.upg.valve = 1;
    for (let c = 0; c < cols; c++) {
      let top = 'loam', mid = 'loam', bot = 'clay';
      if (biome === 'desert' && M.biomes.desert) { top = 'sand'; mid = 'sand'; bot = 'loam'; }
      else if (biome === 'bog' && M.biomes.bog) { top = 'peat'; mid = 'peat'; bot = 'clay'; }
      else if (biome === 'alpine' && M.biomes.alpine) { top = 'scree'; mid = 'humus'; bot = 'loam'; }
      J.soil.push([top, mid, bot]);
      const st = sim.soilStat(J, c);
      J.nutr.push(st.fert * (0.65 + 0.08 * Math.min(n, 4)));
      J.w.push(0.62 + 0.3 * st.ret * 0.5);
    }
    const mossC = Math.floor(cols / 2);
    const starter = biome === 'desert' && M.biomes.desert ? 'succ' : biome === 'bog' && M.biomes.bog ? 'reed' : biome === 'alpine' && M.biomes.alpine ? 'gentian' : 'moss';
    sim.addPlant(J, starter, mossC, 0.5);
    if (starter === 'moss') sim.addPlant(J, 'fern', Math.max(0, mossC - 1), 0.3);
    else if (n >= 1) sim.addPlant(J, 'moss', Math.max(0, mossC - 1), 0.5);
    if (n >= 3) sim.addPlant(J, 'vine', Math.min(cols - 1, mossC + 1), 0.5);
    J.log.push({ t: 0, m: 'A new jar is sealed under glass. Let it settle.' });
    return J;
  };

  sim.newState = function () {
    const M = sim.newMeta();
    const S = { v: TD.VERSION, savedAt: Date.now(), meta: M, jar: null };
    S.jar = sim.newJar(M, 'temperate');
    markCollection(S);
    return S;
  };

  sim.addPlant = function (J, sp, c, size) {
    const p = { id: J.nextId++, sp, c, size: size == null ? 0.08 : size, hp: 0.6, seed: (Math.random() * 1e9) | 0, morph: 0, age: 0, fit: 0.6, L: 0.9 };
    J.plants.push(p);
    return p;
  };

  sim.soilStat = function (J, c) {
    const s = J.soil[c];
    const W = [0.5, 0.3, 0.2];
    let fert = 0, ret = 0;
    for (let i = 0; i < 3; i++) {
      const t = TD.SOILS[s[i]] || TD.SOILS.loam;
      fert += t.fert * W[i];
      ret += t.ret * W[i];
    }
    return { fert, ret };
  };

  function markCollection(S) {
    const col = S.meta.col, J = S.jar;
    for (const p of J.plants) {
      col.plants[p.sp] = true;
      if (p.morph) col.morphs[p.sp + ':' + p.morph] = true;
    }
  }

  sim.lvl = (J, id) => J.upg[id] || 0;
  sim.exhibitMult = function (M) {
    let m = 0;
    for (const e of M.exhibits) m += e.radiance;
    return 1 + m;
  };
  sim.collectionCount = function (M) {
    const c = M.col;
    return Object.keys(c.plants).length + Object.keys(c.morphs).length + Object.keys(c.insects).length + Object.keys(c.pairs).length;
  };
  sim.collectionMult = (M) => 1 + 0.005 * sim.collectionCount(M);
  sim.collectionTotal = () => TD.PLANTS.length + TD.PLANTS.length * 3 + 5 + TD.PAIRS.length;

  sim.logMsg = function (S, m, kind) {
    const J = S.jar;
    J.log.push({ t: J.age, m, k: kind || '' });
    if (J.log.length > 40) J.log.shift();
    if (S._sum) S._sum.notes.push(m);
    if (TD.onLog && !TD.fxMute) TD.onLog(m, kind || '');
  };

  sim.maxCols = (J) => Math.min(TD.MAX_COLS, J.cols);

  /* ---------- interaction (disturbance) ---------- */
  sim.calmKeep = function (J) {
    return [0.5, 0.65, 0.78, 0.88][sim.lvl(J, 'hush')];
  };
  sim.disturb = function (S, f) {
    const J = S.jar;
    J.calm *= Math.pow(sim.calmKeep(J), f == null ? 1 : f);
  };

  /* ---------- derived values ---------- */
  sim.calmTier = function (J) {
    return J.calm >= TD.MORPHS[3].calm ? 3 : J.calm >= TD.MORPHS[2].calm ? 2 : J.calm >= TD.MORPHS[1].calm ? 1 : 0;
  };

  sim.biomeCount = (M) => Object.keys(M.biomes).length;

  function pairActive(J, pr) {
    const A = J.plants.filter((p) => p.sp === pr.a && p.hp > 0.5);
    if (!A.length) return null;
    if (pr.ib) {
      if ((J.P[pr.ib] || 0) >= pr.ibMin) return { plants: A };
      return null;
    }
    for (const a of A) {
      const bs = J.plants.filter((p) => p.sp === pr.b && p.hp > 0.5 && Math.abs(p.c - a.c) <= 2);
      if (bs.length) return { plants: [a].concat(bs) };
    }
    return null;
  }
  sim.pairActive = pairActive;

  /* ---------- the tick ---------- */
  sim.step = function (S, dt, o) {
    o = o || {};
    const J = S.jar, M = S.meta;
    const off = !!o.off;
    const eff = o.eff == null ? 1 : o.eff;
    const sum = S._sum;
    const n = J.cols;
    const P = J.P;
    const U = J.upg;
    const PLd = PL();

    J.age += dt;
    J.calm += dt;
    if (!off) { M.playSec += dt; J.playAge = (J.playAge || 0) + dt; }
    J.mistCd = Math.max(0, J.mistCd - dt);
    J.immune = Math.max(0, J.immune - dt);
    J.recover = Math.max(0, J.recover - dt);
    J.t.mist += dt; J.t.snips += dt; J.t.ward += dt; J.t.event += dt;

    const compostL = U.compost || 0;
    const rootsM = 1 + 0.2 * (U.roots || 0);
    const exMult = sim.exhibitMult(M);
    const growEx = 1 + 0.05 * M.exhibits.length;

    // soil stats
    const st = new Array(n);
    for (let c = 0; c < n; c++) st[c] = sim.soilStat(J, c);

    /* --- water cycle: soil -> air -> condensation -> soil --- */
    let evapTot = 0;
    for (let c = 0; c < n; c++) {
      const e = (0.008 * (1 - 0.92 * st[c].ret) + 0.0004) * J.w[c] * dt;
      J.w[c] -= e;
      evapTot += e;
    }
    // condensation returns to soil, favouring water-holding soils (so sand stays dry, peat stays wet)
    const condTot = Math.min(J.A * n, 0.008 * J.A * n * dt);
    let wsum = 0;
    const wg = sim._wg || (sim._wg = []);
    for (let c = 0; c < n; c++) { wg[c] = 0.1 + st[c].ret * st[c].ret; wsum += wg[c]; }
    for (let c = 0; c < n; c++) J.w[c] += (condTot * wg[c]) / wsum;
    J.A += (evapTot - condTot) / n - 0.0003 * J.A * dt;
    for (let c = 0; c < n - 1; c++) {
      const d = 0.003 * (J.w[c + 1] - J.w[c]) * dt;
      J.w[c] += d; J.w[c + 1] -= d;
    }
    let spill = 0;
    for (let c = 0; c < n; c++) { if (J.w[c] > 1) { spill += J.w[c] - 1; J.w[c] = 1; } else if (J.w[c] < 0) J.w[c] = 0; }
    J.A = clamp(J.A + (spill * 0.7) / n, 0, 1);

    /* --- shade --- */
    const plants = J.plants;
    const np = plants.length;
    for (let i = 0; i < np; i++) {
      const q = plants[i], sq = PLd[q.sp] ? PLd[q.sp] : PLd.moss;
      const hq = sq.height * Math.min(q.size, 1.3);
      let shade = 0;
      for (let k = 0; k < np; k++) {
        if (k === i) continue;
        const p = plants[k], d = Math.abs(p.c - q.c);
        if (d === 0 || d > 2) continue;
        const sp = PLd[p.sp];
        const hp = sp.height * Math.min(p.size, 1.3);
        if (hp > hq * 0.7) shade += sp.canopy * Math.min(p.size, 1.2) * (d === 1 ? 0.6 : 0.25);
      }
      q.L = Math.max(0.1, (1 - Math.min(shade, 0.85)) * 0.9);
    }

    /* --- plants --- */
    let bio = 0, flowerB = 0, sundropB = 0, hSum = 0, hW = 0, nutrAdd = 0;
    const dead = [];
    const species = {};
    for (let i = 0; i < np; i++) {
      const p = plants[i], sp = PLd[p.sp];
      p.age += dt;
      species[p.sp] = 1;
      const c = Math.min(p.c, n - 1);
      const d = Math.abs(p.L - sp.light);
      const fL = Math.max(0.1, 1 - (d / sp.lw) * (d / sp.lw));
      const w = J.w[c];
      let fW = 1;
      if (w < sp.wlo) fW = 1 - (sp.wlo - w) / 0.3;
      else if (w > sp.whi) fW = 1 - (w - sp.whi) / 0.3;
      fW = clamp(fW, 0, 1);
      const fN = clamp(J.nutr[c] / (sp.nutr * 0.8), 0, 1);
      const fit = 0.5 * Math.pow(fL * fW * fN, 1 / 3) + 0.5 * Math.min(fL, fW, fN);
      p.fit = fit; p.fL = fL; p.fW = fW; p.fN = fN;
      p.hp += (fit - p.hp) * Math.min(1, 0.035 * dt);
      if (p.hp > 0.3) {
        const g = (dt / sp.mature) * rootsM * growEx * p.hp * (J.recover > 0 ? 2 : 1);
        if (p.size < 1) p.size = Math.min(1, p.size + g * (0.4 + 0.6 * fit));
        else if (fN > 0.7 && fW > 0.7) p.size = Math.min(1.4, p.size + g * 0.1 * fit);
      } else if (p.hp < 0.2) {
        p.size -= 0.0015 * dt * (1 + (0.2 - p.hp) * 5);
        if (p.size < 0.04) dead.push(p);
      }
      // resources
      J.w[c] = Math.max(0, J.w[c] - sp.thirst * p.size * dt);
      J.A += (0.8 * sp.thirst * p.size * dt) / n;
      J.nutr[c] = Math.max(0, J.nutr[c] - sp.nutr * 0.0015 * p.size * dt);
      J.D += sp.shed * p.size * dt;
      // biomass bookkeeping
      const bm = p.size * p.hp;
      bio += bm * sp.palat;
      if (sp.flower) flowerB += bm * sp.flower;
      if (p.sp === 'sundrop') sundropB += bm;
      hSum += p.hp * (0.3 + p.size); hW += 0.3 + p.size;
      // bellcap decomposes litter directly
      if (p.sp === 'bell') {
        const dpc = J.D / n;
        const conv = Math.min(J.D * 0.5, 0.006 * p.size * (dpc / (dpc + 0.1)) * dt * (1 + 0.5 * compostL));
        J.D -= conv;
        for (let k = Math.max(0, c - 1); k <= Math.min(n - 1, c + 1); k++) J.nutr[k] += (conv * 0.9) / 3;
      }
    }
    for (const p of dead) {
      plants.splice(plants.indexOf(p), 1);
      J.D += 0.15;
      if (sum) sum.lost++;
      sim.logMsg(S, PLd[p.sp].name + ' withered away.', 'bad');
    }

    /* --- detritus -> nutrients (microbes) --- */
    {
      const moist = J.w.reduce((a, b) => a + b, 0) / n;
      const conv = Math.min(J.D * 0.6, 0.004 * J.D * (0.3 + moist) * dt * (1 + 0.6 * compostL));
      J.D -= conv;
      nutrAdd += conv * 0.85;
      // slow mineral weathering
      for (let c = 0; c < n; c++) {
        const cap = st[c].fert;
        J.nutr[c] += 0.0003 * st[c].fert * Math.max(0, 1 - J.nutr[c] / cap) * dt;
      }
    }

    /* --- insects --- */
    const dpc = J.D / n;
    const moist = J.w.reduce((a, b) => a + b, 0) / n;
    const sat = dpc / (dpc + 0.15);
    const Pn = J.P;
    // springtail & pillbug: decomposers
    {
      const sp = IN().spring, pb = IN().pill;
      const Ks = sp.K * n, Kp = pb.K * n;
      const eatS = Math.min(J.D * 0.4, 0.0012 * Pn.spring * sat * dt * (1 + 0.6 * compostL));
      J.D -= eatS; nutrAdd += eatS * 0.9;
      const eatP = Math.min(J.D * 0.4, 0.0022 * Pn.pill * sat * dt * (1 + 0.6 * compostL));
      J.D -= eatP; nutrAdd += eatP * 0.9;
      const dry = moist < 0.25 ? 1 : 0;
      Pn.spring += (0.012 * Pn.spring * (1 - Pn.spring / Ks) * sat * (moist > 0.25 ? 1 : 0) - 0.004 * Pn.spring - 0.012 * dry * Pn.spring) * dt;
      Pn.pill += (0.007 * Pn.pill * (1 - Pn.pill / Kp) * sat * (moist > 0.3 ? 1 : 0) - 0.0025 * Pn.pill - 0.01 * dry * Pn.pill) * dt;
    }
    // aphids (pest), beetles and lacewings (predators), moths (pollinators)
    {
      const Ka = IN().aphid.K * n, Km = IN().moth.K * n;
      const food = bio / (bio + 2);
      let aphidChange = 0.01 * Pn.aphid * Math.max(0, 1 - Pn.aphid / Ka) * food - 0.008 * Pn.aphid;
      // aphid damage on plants
      if (Pn.aphid > 0.05 && np) {
        const dmg = 0.0007 * Pn.aphid * dt;
        let tot = 0;
        for (const p of plants) tot += p.size * PLd[p.sp].palat;
        if (tot > 0.001) for (const p of plants) {
          const share = (p.size * PLd[p.sp].palat) / tot;
          p.size = Math.max(0.03, p.size - dmg * share * 0.5);
          p.hp = Math.max(0, p.hp - dmg * share * 1.5);
        }
      }
      // beetle predation
      const Cb = Math.min(Pn.aphid * 0.6 * 1, 0.02 * Pn.beetle * (Pn.aphid / (Pn.aphid + 1)) * dt);
      aphidChange -= Cb / dt;
      Pn.beetle += (0.45 * Cb) - 0.012 * Pn.beetle * dt;
      // lacewing predation
      const Cl = Math.min(Pn.aphid * 0.6, 0.016 * Pn.lace * (Pn.aphid / (Pn.aphid + 1)) * dt);
      const Cs = Math.min(Pn.spring * 0.3, 0.004 * Pn.lace * (Pn.spring / (Pn.spring + 2)) * dt);
      aphidChange -= Cl / dt;
      Pn.spring -= Cs;
      Pn.lace += 0.4 * (Cl + Cs) - 0.01 * Pn.lace * dt;
      // sundrop predation
      if (sundropB > 0) {
        const k = 0.0009 * sundropB * dt;
        const ea = Math.min(Pn.aphid * 0.3, Pn.aphid * k), es = Math.min(Pn.spring * 0.3, Pn.spring * k * 0.5), em = Math.min(Pn.moth * 0.3, Pn.moth * k * 0.5);
        aphidChange -= ea / dt; Pn.spring -= es; Pn.moth -= em;
        nutrAdd += 0.8 * (ea + es + em);
      }
      Pn.aphid += aphidChange * dt;
      // warden tender
      const wardL = U.warden || 0;
      if (wardL && Pn.aphid > 0.2) Pn.aphid -= Pn.aphid * 0.006 * wardL * dt + 0.0005 * wardL * dt;
      // moth
      const fl = flowerB / (flowerB + 0.5);
      Pn.moth += (0.01 * Pn.moth * Math.max(0, 1 - Pn.moth / Km) * fl - 0.006 * Pn.moth) * dt;
    }
    for (const k in Pn) { if (Pn[k] < 0.08) Pn[k] = 0; if (Pn[k] > 0 && IN()[k]) { M.col.insects[k] = M.col.insects[k] || (k !== 'aphid'); } }
    if (Pn.aphid > 0.5) J.seenAphid = true;
    // distribute nutrients
    if (nutrAdd > 0) {
      const lvl = compostL;
      for (let c = 0; c < n; c++) J.nutr[c] = Math.min(st[c].fert * 1.2, J.nutr[c] + nutrAdd / n * (1 + 0.0 * lvl));
    }
    if (compostL) {
      let avg = 0;
      for (let c = 0; c < n; c++) avg += J.nutr[c] / Math.max(0.1, st[c].fert);
      avg /= n;
      for (let c = 0; c < n; c++) {
        const frac = J.nutr[c] / Math.max(0.1, st[c].fert);
        J.nutr[c] += (avg - frac) * 0.004 * compostL * dt * st[c].fert;
      }
    }

    /* --- harmony & strain --- */
    const harm = hW > 0 ? hSum / hW : 0.7;
    J.harmony = harm;
    let diversity = Object.keys(species).length;
    {
      const pestP = Pn.aphid / (1 + bio * 1.5);
      const dpcNow = J.D / n;
      let gain = Math.max(0, 0.5 - harm) * 1.2 + Math.max(0, pestP - 1.2) * 0.25 + Math.max(0, dpcNow - 0.8) * 0.6 + Math.max(0, J.A - 0.85) * 3;
      let charcoal = 0;
      for (let c = 0; c < n; c++) for (let i = 0; i < 3; i++) if (J.soil[c][i] === 'charcoal') charcoal += 1;
      gain *= 1 - Math.min(0.25, charcoal / (n * 3) * 0.6);
      gain *= Math.max(0.6, 1 - 0.05 * Math.max(0, diversity - 1));
      gain *= Math.pow(0.75, U.valve || 0);
      if (off) gain *= 0.5;
      if (J.immune > 0 || np === 0) gain = 0;
      const decay = harm > 0.62 ? (harm - 0.55) * 1.5 : 0;
      J.strain = clamp(J.strain + (gain - decay) * dt, 0, 100);
      if (J.strain >= 100 && np > 0) sim.collapse(S, off);
    }

    /* --- production --- */
    {
      let prod = 0;
      const act = [];
      for (const pr of TD.PAIRS) {
        if (M.col.pairs[pr.id]) { const a = pairActive(J, pr); if (a) act.push({ pr, a }); }
      }
      const pairBonus = new Map();
      for (const x of act) for (const p of x.a.plants) pairBonus.set(p, (pairBonus.get(p) || 0) + x.pr.bonus);
      for (const p of plants) {
        const sp = PLd[p.sp];
        const sz = Math.min(p.size, 1) + Math.max(0, p.size - 1) * 0.8;
        let y = sp.yield * sz * p.hp * (p.morph ? TD.MORPHS[p.morph].mult : 1) * (1 + (pairBonus.get(p) || 0));
        prod += y;
      }
      for (const k in Pn) { const ins = IN()[k]; if (ins && ins.iy) prod += ins.iy * Pn[k]; }
      const dMult = 1 + 0.06 * Math.max(0, diversity - 1);
      const hMult = 0.4 + 0.6 * clamp(harm / 0.8, 0, 1);
      const upM = 1 + 0.25 * (U.glow || 0);
      const biomeM = 1 + 0.05 * (sim.biomeCount(M) - 1);
      let rate = prod * dMult * hMult * upM * biomeM * exMult * sim.collectionMult(M);
      J.rawRate = rate;
      rate *= eff;
      J.rate = rate;
      J.stability += rate * dt;
      J.lifetime += rate * dt;
      M.totalEarned += rate * dt;
      if (sum) sum.stability += rate * dt;

      // rare seeds
      const pollin = 1 + 0.35 * Math.sqrt(Pn.moth);
      const seedRate = (1 / 1200) * pollin * (1 + 0.3 * (U.seedlib || 0)) * (1 + 0.1 * Math.max(0, diversity - 1)) * (np ? 1 : 0) * (off ? eff : 1);
      J.seedProg += seedRate * dt;
      if (J.seedProg >= 1) {
        J.seedProg -= 1;
        M.seeds = Math.min(99, M.seeds + 1);
        if (sum) sum.seeds++;
        sim.logMsg(S, 'A rare seed drifted down from a flower.', 'good');
        TD.pushFx({ type: 'seed' });
      }

      // long-idle morphs
      const tier = sim.calmTier(J);
      for (let t = 1; t <= tier; t++) {
        if (np && Math.random() < TD.MORPHS[t].rate * dt * (off ? 1 : 1)) {
          const cand = plants.filter((p) => p.morph < t);
          if (cand.length) sim.applyMorph(S, cand[(Math.random() * cand.length) | 0], t, 'drift');
        }
      }
      // symbiotic bonds
      if (J.calm >= 300) {
        for (const pr of TD.PAIRS) {
          if (M.col.pairs[pr.id]) continue;
          if (!M.biomes[PLd[pr.a].biome] || (pr.b && !M.biomes[PLd[pr.b].biome])) continue;
          const a = pairActive(J, pr);
          if (a) {
            J.bond[pr.id] = (J.bond[pr.id] || 0) + dt;
            if (J.bond[pr.id] >= pr.req) {
              M.col.pairs[pr.id] = true;
              J.pairsFound++;
              if (sum) sum.pairs.push(pr.name);
              sim.logMsg(S, 'A symbiosis has formed: ' + pr.name + '!', 'rare');
              TD.pushFx({ type: 'pair', id: pr.id });
            }
          }
        }
      }
    }

    /* --- tenders --- */
    {
      const ml = U.mister || 0;
      if (ml && J.t.mist >= 6) {
        J.t.mist = 0;
        let mn = 1;
        for (let c = 0; c < n; c++) mn = Math.min(mn, J.w[c] / Math.max(0.01, 1));
        // average-based so peat/sand columns do not trigger endlessly
        const avg = J.w.reduce((a, b) => a + b, 0) / n;
        if (avg < [0, 0.3, 0.36, 0.42][ml] && J.A < 0.8) sim.mist(S, false, 0.22 + 0.06 * ml);
      }
      const sl = U.snips || 0;
      if (sl && J.t.snips >= 10) {
        J.t.snips = 0;
        for (const p of plants) if (p.size > [0, 1.3, 1.2, 1.08][sl]) sim.prune(S, p, false);
      }
    }

    /* --- random events --- */
    if (J.t.event >= 20) {
      J.t.event = 0;
      // hitchhiking aphids once the jar is lush
      if (np >= 3 && Pn.aphid === 0 && J.age > 300 && Math.random() < (off ? 0.02 : 0.025) * Math.min(3, np / 3)) {
        Pn.aphid = 2.5;
        if (sum) sum.events++;
        sim.logMsg(S, 'A few aphids hitched a ride in on the glass. Beetles or lacewings will deal with them.', 'bad');
      }
    }
    // keep collection in sync
    if (!off || (J.age | 0) % 30 === 0) for (const p of plants) { M.col.plants[p.sp] = true; }
  };

  sim.applyMorph = function (S, p, tier, how) {
    const J = S.jar, M = S.meta;
    p.morph = tier;
    J.morphs++;
    const key = p.sp + ':' + tier;
    const isNew = !M.col.morphs[key];
    M.col.morphs[key] = true;
    if (S._sum) S._sum.morphs.push(TD.MORPHS[tier].name + ' ' + TD.PLANT[p.sp].name);
    sim.logMsg(S, 'A ' + TD.MORPHS[tier].name + ' morph bloomed on a ' + TD.PLANT[p.sp].name + (isNew ? ' (new for the collection!)' : '.'), 'rare');
    TD.pushFx({ type: 'morph', id: p.id });
  };

  sim.collapse = function (S, soft) {
    const J = S.jar, M = S.meta;
    const k = soft ? 0.5 : 0.35;
    for (const p of J.plants) {
      p.size = Math.max(0.12, p.size * k);
      p.hp = 0.25;
    }
    for (const key in J.P) J.P[key] *= soft ? 0.5 : 0.25;
    J.A = 0.25;
    for (let c = 0; c < J.cols; c++) { J.w[c] = Math.max(J.w[c], 0.75); J.nutr[c] = Math.min(sim.soilStat(J, c).fert * 1.2, J.nutr[c] + 0.35); }
    J.D = Math.max(0, J.D * 0.3);
    const lost = J.stability * (soft ? 0.1 : 0.2);
    J.stability -= lost;
    J.strain = 15;
    J.immune = 120;
    J.recover = 180;
    J.collapses++;
    M.collapses++;
    J.lastCollapse = J.age;
    if (S._sum) S._sum.collapses++;
    sim.logMsg(S, 'The jar collapsed! The glass fogged over and life retreated. It will regrow from the rich ruin (' + TD.fmt(lost) + ' stability lost).', 'bad');
    TD.pushFx({ type: 'collapse' });
    // collapse-born rare morph chance for the collection
    if (J.plants.length && Math.random() < 0.3) { const q = J.plants[(Math.random() * J.plants.length) | 0]; if (q.morph < 1) sim.applyMorph(S, q, 1, 'ash'); }
  };

  /* ---------- offline ---------- */
  sim.offlineEff = (J) => TD.OFFLINE_EFF[sim.lvl(J, 'lantern')];

  sim.runOffline = function (S, seconds) {
    const real = seconds;
    const el = Math.min(seconds, TD.OFFLINE_CAP);
    const sum = { real, secs: el, capped: real > TD.OFFLINE_CAP, stability: 0, seeds: 0, morphs: [], pairs: [], collapses: 0, lost: 0, events: 0, notes: [], eff: sim.offlineEff(S.jar),
      before: { plants: S.jar.plants.length, sizeAvg: avgSize(S.jar) } };
    S._sum = sum;
    TD.fxMute = true;
    const eff = sum.eff;
    let t = 0;
    const calmBefore = S.jar.calm;
    while (t < el) {
      const dt = Math.min(2, el - t);
      sim.step(S, dt, { off: true, eff });
      t += dt;
    }
    sum.after = { plants: S.jar.plants.length, sizeAvg: avgSize(S.jar) };
    TD.fxMute = false;
    sum.calm = S.jar.calm;
    sum.notes = sum.notes.slice(-8);
    S._sum = null;
    return sum;
  };
  function avgSize(J) { return J.plants.length ? J.plants.reduce((a, p) => a + p.size, 0) / J.plants.length : 0; }

  /* ---------- actions ---------- */
  sim.canPlace = function (S, spId, c) {
    const J = S.jar, sp = TD.PLANT[spId];
    if (!sp) return 'Unknown plant';
    if (!S.meta.biomes[sp.biome]) return 'Biome locked';
    if (c < 0 || c >= J.cols) return 'No such column';
    if (J.plants.some((p) => p.c === c)) return 'That column is occupied';
    if (J.stability < sp.cost) return 'Not enough stability';
    return '';
  };
  sim.place = function (S, spId, c) {
    const err = sim.canPlace(S, spId, c);
    if (err) return { ok: false, msg: err };
    const J = S.jar, sp = TD.PLANT[spId];
    J.stability -= sp.cost;
    const p = sim.addPlant(J, spId, c, 0.08);
    S.meta.col.plants[spId] = true;
    sim.disturb(S, 0.7);
    TD.pushFx({ type: 'plant', id: p.id, c });
    let msg = 'Planted ' + sp.name + '.';
    if (J.age > 240 && J.plants.length >= 3 && J.P.aphid === 0 && Math.random() < 0.2) {
      J.P.aphid = 2; msg += ' A few aphids came in on the seedling!';
      sim.logMsg(S, 'Aphids hitched a ride on the new seedling.', 'bad');
    }
    return { ok: true, msg, plant: p };
  };
  sim.setSoil = function (S, c, row, type) {
    const J = S.jar;
    if (!TD.SOILS[type] || !S.meta.biomes[TD.SOILS[type].biome]) return { ok: false, msg: 'Soil locked' };
    if (J.soil[c][row] === type) return { ok: false, msg: 'Already ' + TD.SOILS[type].name };
    if (J.stability < TD.SOIL_COST) return { ok: false, msg: 'Not enough stability' };
    J.stability -= TD.SOIL_COST;
    J.soil[c][row] = type;
    const cap = sim.soilStat(J, c).fert * 1.2;
    J.nutr[c] = Math.min(J.nutr[c], cap);
    sim.disturb(S, 0.5);
    TD.pushFx({ type: 'soil' });
    return { ok: true, msg: 'Layered ' + TD.SOILS[type].name + '.' };
  };
  sim.uproot = function (S, p) {
    const J = S.jar;
    const i = J.plants.indexOf(p);
    if (i < 0) return { ok: false, msg: 'Gone' };
    J.plants.splice(i, 1);
    J.D += p.size * 0.25;
    sim.disturb(S, 0.7);
    return { ok: true, msg: 'Uprooted ' + TD.PLANT[p.sp].name + '. It will feed the soil.' };
  };
  sim.prune = function (S, p, manual) {
    const J = S.jar, sp = TD.PLANT[p.sp];
    if (p.size < 0.3 && manual) return { ok: false, msg: 'Too small to prune' };
    let bonus = 0;
    if (p.size > 1.0) bonus = sp.yield * 40 * (p.size - 0.95) * (manual ? 1 : 0.5) * (J.rate > 0 ? 1 : 0);
    const target = manual ? Math.min(p.size, 0.72) : Math.min(p.size, 0.85);
    J.D += (p.size - target) * 0.3;
    p.size = target;
    p.hp = Math.min(1, p.hp + 0.05);
    if (bonus) { J.stability += bonus; J.lifetime += bonus; S.meta.totalEarned += bonus; }
    if (manual) sim.disturb(S, 0.8);
    TD.pushFx({ type: 'prune', id: p.id });
    return { ok: true, msg: 'Pruned ' + sp.name + (bonus ? ' (+' + TD.fmt(bonus) + ' stability)' : '.'), bonus };
  };
  sim.mist = function (S, manual, amt) {
    const J = S.jar;
    if (manual && J.mistCd > 0) return { ok: false, msg: 'Wait ' + Math.ceil(J.mistCd) + 's' };
    amt = amt || 0.4;
    for (let c = 0; c < J.cols; c++) J.w[c] = Math.min(1, J.w[c] + amt * clamp(0.25 + sim.soilStat(J, c).ret, 0.25, 1));
    J.A = Math.min(1, J.A + 0.04);
    if (manual) { J.mistCd = 10; sim.disturb(S, 0.6); }
    TD.pushFx({ type: 'mist', manual });
    return { ok: true, msg: 'Misted the jar.' };
  };
  sim.introduce = function (S, id) {
    const J = S.jar, ins = TD.INSECT[id];
    if (!ins || ins.pest) return { ok: false, msg: 'Cannot introduce that' };
    if (J.stability < ins.cost) return { ok: false, msg: 'Not enough stability' };
    if (!sim.insectAvailable(S, ins)) return { ok: false, msg: 'Not yet discovered' };
    J.stability -= ins.cost;
    J.P[id] = Math.min(ins.K * J.cols, (J.P[id] || 0) + ins.add);
    S.meta.col.insects[id] = true;
    sim.disturb(S, 0.7);
    TD.pushFx({ type: 'insect', id });
    return { ok: true, msg: 'Released ' + ins.add + ' ' + ins.name + 's.' };
  };
  sim.insectAvailable = function (S, ins) {
    if (ins.pest) return false;
    if (ins.id === 'beetle') return S.jar.seenAphid || S.jar.lifetime >= ins.unlock;
    return S.jar.lifetime >= ins.unlock || S.meta.col.insects[ins.id];
  };
  sim.graft = function (S, p) {
    const J = S.jar, M = S.meta;
    if (M.seeds < 1) return { ok: false, msg: 'No rare seeds' };
    if (J.calm < 300) return { ok: false, msg: 'The jar is too restless. It needs 5 minutes of calm.' };
    const tmax = sim.calmTier(J) || 1;
    let tier = tmax;
    if (tmax > 1 && Math.random() < 0.5) tier = tmax - 1;
    if (p.morph >= tier) {
      if (p.morph >= 3) return { ok: false, msg: 'Already an Aurora morph' };
      tier = Math.min(3, p.morph + 1);
      if (tier > tmax) return { ok: false, msg: 'Needs more calm for a better morph (' + TD.fmtTime(TD.MORPHS[tier].calm) + ')' };
    }
    M.seeds--;
    sim.applyMorph(S, p, tier, 'seed');
    sim.disturb(S, 1);
    return { ok: true, msg: 'The seed took: ' + TD.MORPHS[tier].name + ' morph!' };
  };
  sim.upgradeCost = function (S, id) {
    const u = TD.UPGRADE[id], l = sim.lvl(S.jar, id);
    return l >= u.max ? Infinity : TD.upgradeCost(u, l);
  };
  sim.buyUpgrade = function (S, id) {
    const J = S.jar, u = TD.UPGRADE[id];
    const cost = sim.upgradeCost(S, id);
    if (cost === Infinity) return { ok: false, msg: 'Maxed' };
    if (J.stability < cost) return { ok: false, msg: 'Not enough stability' };
    J.stability -= cost;
    J.upg[id] = (J.upg[id] || 0) + 1;
    if (id === 'width') {
      const add = Math.min(2, TD.MAX_COLS - J.cols);
      for (let i = 0; i < add; i++) {
        const c = J.cols;
        J.cols++;
        const top = J.soil[c - 1].slice();
        J.soil.push(top);
        J.nutr.push(sim.soilStat(J, c).fert * 0.9);
        J.w.push(0.6);
      }
    }
    return { ok: true, msg: u.name + ' improved.' };
  };
  sim.buyBiome = function (S, id) {
    const b = TD.BIOMES[id], M = S.meta, J = S.jar;
    if (M.biomes[id]) return { ok: false, msg: 'Already unlocked' };
    if (J.stability < b.cost) return { ok: false, msg: 'Not enough stability' };
    J.stability -= b.cost;
    M.biomes[id] = true;
    sim.logMsg(S, b.name + ' unlocked: new plants and soils are available.', 'good');
    return { ok: true, msg: b.name + ' unlocked!' };
  };

  /* ---------- sealing (prestige) ---------- */
  sim.sealRequirement = (M) => Math.round(TD.SEAL_BASE * Math.pow(TD.SEAL_GROWTH, M.exhibits.length));
  sim.speciesCount = (J) => new Set(J.plants.map((p) => p.sp)).size;
  sim.canSeal = function (S) {
    const J = S.jar, M = S.meta;
    const req = sim.sealRequirement(M);
    const why = [];
    if (J.lifetime < req) why.push('Earn ' + TD.fmt(req) + ' stability in this jar (' + TD.fmt(J.lifetime) + ')');
    if ((J.playAge || 0) < TD.SEAL_MIN_AGE) why.push('Tend the jar for ' + TD.fmtTime(TD.SEAL_MIN_AGE) + ' of active play (' + TD.fmtTime(J.playAge || 0) + ')');
    const sc = sim.speciesCount(J);
    if (sc < TD.SEAL_MIN_SPECIES) why.push('Grow at least ' + TD.SEAL_MIN_SPECIES + ' plant species (' + sc + ')');
    return { ok: why.length === 0, why, req };
  };
  sim.exhibitRadiance = function (S) {
    const J = S.jar;
    const sc = sim.speciesCount(J);
    const morphs = J.plants.filter((p) => p.morph).length;
    const pairs = TD.PAIRS.filter((pr) => S.meta.col.pairs[pr.id] && pairActive(J, pr)).length;
    return 0.2 + 0.03 * sc + 0.02 * Math.min(6, morphs) + 0.04 * pairs;
  };
  sim.dominantBiome = function (J) {
    const cnt = {};
    for (const p of J.plants) { const b = TD.PLANT[p.sp].biome; cnt[b] = (cnt[b] || 0) + p.size; }
    let best = 'temperate', bv = -1;
    for (const k in cnt) if (cnt[k] > bv) { bv = cnt[k]; best = k; }
    return best;
  };
  sim.seal = function (S, startBiome, thumb) {
    const chk = sim.canSeal(S);
    if (!chk.ok) return { ok: false, msg: chk.why[0] };
    const J = S.jar, M = S.meta;
    const ex = {
      id: M.exhibits.length + 1,
      at: Date.now(),
      radiance: sim.exhibitRadiance(S),
      species: sim.speciesCount(J),
      plants: J.plants.map((p) => ({ sp: p.sp, c: p.c, size: Math.min(1, p.size), morph: p.morph, seed: p.seed })),
      cols: J.cols,
      soil: J.soil.map((s) => s.slice()),
      lifetime: J.lifetime,
      age: J.age,
      biome: sim.dominantBiome(J),
      thumb: thumb || '',
    };
    M.exhibits.push(ex);
    if (!M.biomes[startBiome]) startBiome = 'temperate';
    M.startBiome = startBiome;
    S.jar = sim.newJar(M, startBiome);
    markCollection(S);
    TD.pushFx({ type: 'seal' });
    return { ok: true, msg: 'Exhibit #' + ex.id + ' sealed: +' + Math.round(ex.radiance * 100) + '% stability forever.', exhibit: ex };
  };

  /* ---------- plant info for the UI ---------- */
  sim.plantAdvice = function (S, p) {
    const sp = TD.PLANT[p.sp];
    const out = [];
    if (p.fW < 0.7) out.push(J_w(S, p) < sp.wlo ? 'Too dry here.' : 'Too wet here.');
    if (p.fN < 0.7) out.push('Short of nutrients.');
    if (p.fL < 0.7) out.push(p.L < sp.light ? 'Too shaded.' : 'Too bright for it.');
    if (p.size > 1.15) out.push('Overgrown: prune for a stability burst.');
    if (!out.length) out.push(p.hp > 0.7 ? 'Thriving.' : 'Settling in.');
    return out;
  };
  function J_w(S, p) { return S.jar.w[Math.min(p.c, S.jar.cols - 1)]; }

  /* ---------- save / load ---------- */
  sim.KEY = 'terrariumDrift.save.v1';
  sim.serialize = function (S) {
    S.savedAt = Date.now();
    const copy = { v: S.v, savedAt: S.savedAt, meta: S.meta, jar: S.jar };
    return JSON.stringify(copy);
  };
  sim.normalize = function (raw) {
    const D = sim.newState();
    const M = Object.assign(D.meta, raw.meta || {});
    M.col = Object.assign({ plants: {}, morphs: {}, insects: {}, pairs: {} }, (raw.meta && raw.meta.col) || {});
    M.biomes = Object.assign({ temperate: true }, (raw.meta && raw.meta.biomes) || {});
    M.exhibits = Array.isArray(M.exhibits) ? M.exhibits : [];
    M.settings = Object.assign({ sound: false, quality: 1 }, M.settings || {});
    const J = Object.assign(D.jar, raw.jar || {});
    J.P = Object.assign({ spring: 0, pill: 0, aphid: 0, beetle: 0, moth: 0, lace: 0 }, (raw.jar && raw.jar.P) || {});
    J.t = Object.assign({ mist: 0, snips: 0, ward: 0, event: 0 }, (raw.jar && raw.jar.t) || {});
    J.upg = (raw.jar && raw.jar.upg) || {};
    J.bond = (raw.jar && raw.jar.bond) || {};
    J.log = (raw.jar && raw.jar.log) || [];
    J.plants = ((raw.jar && raw.jar.plants) || []).filter((p) => TD.PLANT[p.sp] && p.c < J.cols);
    // fill missing arrays
    J.cols = clamp(J.cols | 0, 3, TD.MAX_COLS);
    while (J.soil.length < J.cols) J.soil.push(['loam', 'loam', 'clay']);
    while (J.nutr.length < J.cols) J.nutr.push(0.8);
    while (J.w.length < J.cols) J.w.push(0.6);
    for (const p of J.plants) { if (p.fit == null) p.fit = 0.6; if (p.L == null) p.L = 0.9; if (p.hp == null) p.hp = 0.6; p.morph = p.morph | 0; }
    const maxId = J.plants.reduce((a, p) => Math.max(a, p.id || 0), 0);
    J.nextId = Math.max(J.nextId || 1, maxId + 1);
    for (const k of ['stability', 'lifetime', 'strain', 'calm', 'age', 'A', 'D']) if (!isFinite(J[k])) J[k] = D.jar[k];
    return { v: TD.VERSION, savedAt: raw.savedAt || Date.now(), meta: M, jar: J };
  };
  sim.parse = function (text) {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || !raw.jar || !raw.meta) throw new Error('Not a Terrarium Drift save');
    return sim.normalize(raw);
  };
  sim.exportText = function (S) {
    const json = sim.serialize(S);
    const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
    return 'TD1:' + b64;
  };
  sim.importText = function (text) {
    text = String(text || '').trim();
    if (text.startsWith('TD1:')) text = text.slice(4);
    let json;
    if (text.startsWith('{')) json = text;
    else {
      try { json = typeof atob === 'function' ? decodeURIComponent(escape(atob(text))) : Buffer.from(text, 'base64').toString('utf8'); }
      catch (e) { throw new Error('Could not decode the save text'); }
    }
    return sim.parse(json);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TD;
})();
