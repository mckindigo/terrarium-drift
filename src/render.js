/* Terrarium Drift - jar renderer (canvas 2D, all procedural). */
(function () {
  const TD = (globalThis.TD = globalThis.TD || {});
  const W = 500, H = 600;
  const G = { IL: 74, IR: 426, ST: 470, ROW: 26, IB: 548, TOP: 98 };
  TD.GEO = G;
  TD.colX = (c, cols) => G.IL + ((c + 0.5) * (G.IR - G.IL)) / cols;

  function jarPath(c, d) {
    d = d || 0;
    c.beginPath();
    c.moveTo(118 + d, 86 + d); c.lineTo(382 - d, 86 + d);
    c.quadraticCurveTo(440 - d, 92 + d, 440 - d, 150);
    c.lineTo(440 - d, 508); c.quadraticCurveTo(440 - d, 562 - d, 386 - d, 562 - d);
    c.lineTo(114 + d, 562 - d); c.quadraticCurveTo(60 + d, 562 - d, 60 + d, 508);
    c.lineTo(60 + d, 150); c.quadraticCurveTo(60 + d, 92 + d, 118 + d, 86 + d);
    c.closePath();
  }

  function soilGrains(c, type, x, y, w, h, r) {
    const info = TD.SOILS[type] || TD.SOILS.loam;
    const b = info.base;
    const L = (dl, a) => 'hsla(' + b[0] + ',' + b[1] + '%,' + Math.max(4, Math.min(92, b[2] + dl)) + '%,' + (a == null ? 1 : a) + ')';
    c.fillStyle = L((r() - 0.5) * 4);
    c.fillRect(x, y, w, h);
    const count = Math.floor((w * h) / 5);
    for (let i = 0; i < count; i++) {
      const gx = x + r() * w, gy = y + r() * h;
      const v = r();
      c.fillStyle = L(v < 0.5 ? -4 - r() * 8 : 4 + r() * 10, 0.35 + r() * 0.3);
      c.fillRect(gx, gy, 1 + (r() < 0.25 ? 1 : 0), 1);
    }
    const stones = Math.floor((w * h) / 90);
    for (let i = 0; i < stones; i++) {
      const gx = x + r() * w, gy = y + r() * h;
      if (type === 'gravel' || type === 'scree' || type === 'charcoal') {
        const rad = 1.5 + r() * (type === 'gravel' ? 3.5 : 2.5);
        c.fillStyle = L(-6 + r() * 20, 0.9);
        c.beginPath();
        if (type === 'gravel') c.ellipse(gx, gy, rad * 1.2, rad, r() * 3, 0, 6.3);
        else { c.moveTo(gx - rad, gy + rad * 0.6); c.lineTo(gx - rad * 0.2, gy - rad); c.lineTo(gx + rad, gy - rad * 0.2); c.lineTo(gx + rad * 0.5, gy + rad); }
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(gx - rad * 0.4, gy - rad * 0.6, rad * 0.6, 1);
      } else if (type === 'peat' || type === 'humus') {
        c.strokeStyle = L(r() < 0.5 ? -6 : 8, 0.7); c.lineWidth = 1;
        c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + (r() - 0.5) * 8, gy + (r() - 0.5) * 3); c.stroke();
      } else if (type === 'sand') {
        c.fillStyle = L(14, 0.5); c.fillRect(gx, gy, 1, 1);
      } else if (type === 'loam' && r() < 0.4) {
        c.fillStyle = L(12 + r() * 10, 0.55); c.beginPath(); c.arc(gx, gy, 1 + r() * 1.5, 0, 6.3); c.fill();
      } else if (type === 'clay') {
        c.strokeStyle = L(-8, 0.35); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 6 + r() * 8, gy + (r() - 0.5) * 2); c.stroke();
      }
    }
  }

  TD.createRenderer = function (canvas) {
    const ctx = canvas.getContext('2d');
    let dpr = 1, scale = 1;
    const soilCv = document.createElement('canvas');
    const sctx = soilCv.getContext('2d');
    let soilKey = '';
    const bugs = [];
    const spores = [];
    const drops = [];
    const rain = [];
    const sparkles = [];
    let tNow = 0, collapseT = 0, sealT = 0, strainSmooth = 0, flash = 0;
    const bokeh = [];
    const rb = TD.rng(7);
    for (let i = 0; i < 14; i++) bokeh.push({ x: rb() * W, y: rb() * H, r: 14 + rb() * 40, a: 0.03 + rb() * 0.05, ph: rb() * 6 });
    const corkR = TD.rng(99);
    const corkSpecks = [];
    for (let i = 0; i < 60; i++) corkSpecks.push([130 + corkR() * 240, 58 + corkR() * 30, 0.5 + corkR() * 1.4, corkR()]);
    const gr = TD.rng(31);
    for (let i = 0; i < 16; i++) drops.push(newDrop(gr, true));

    function newDrop(rr, init) {
      const side = rr();
      let x, y;
      if (side < 0.45) { x = 78 + rr() * 10; y = 120 + rr() * 330; }
      else if (side < 0.9) { x = 412 + rr() * 10; y = 120 + rr() * 330; }
      else { x = 100 + rr() * 300; y = 100 + rr() * 12; }
      return { x, y, r: 1.3 + rr() * 2.2, vy: 0, slide: 0, trail: 0, wait: rr() * 20 + (init ? rr() * 20 : 5) };
    }

    const R = {
      canvas, bugs,
      hover: null, tool: null, selected: null, quality: 1,
      resize() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const cw = Math.max(200, Math.round(rect.width * dpr));
        canvas.width = cw; canvas.height = Math.round(cw * (H / W));
        scale = canvas.width / W;
        soilCv.width = canvas.width; soilCv.height = canvas.height;
        soilKey = '';
      },
      hit(clientX, clientY, S) {
        const rect = canvas.getBoundingClientRect();
        const lx = ((clientX - rect.left) / rect.width) * W, ly = ((clientY - rect.top) / rect.height) * H;
        const J = S.jar;
        if (lx < G.IL || lx > G.IR) return null;
        const cw = (G.IR - G.IL) / J.cols;
        const c = Math.min(J.cols - 1, Math.floor((lx - G.IL) / cw));
        let row = -1;
        if (ly >= G.ST && ly < G.ST + 3 * G.ROW) row = Math.floor((ly - G.ST) / G.ROW);
        const plant = J.plants.find((p) => p.c === c) || null;
        return { c, row, plant, lx, ly };
      },
      snapshot(w, h) {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        x.drawImage(canvas, 0, 40 * scale, W * scale, (H - 40) * scale * 0.97, 0, 0, w, h);
        try { return cv.toDataURL('image/jpeg', 0.75); } catch (e) { return ''; }
      },
      processFx(S) {
        while (TD.fx.length) {
          const e = TD.fx.shift();
          if (e.type === 'mist') {
            const n = e.manual ? 46 : 26;
            for (let i = 0; i < n; i++) rain.push({ x: G.IL + 6 + Math.random() * (G.IR - G.IL - 12), y: G.TOP + Math.random() * 40 - 40, vy: 220 + Math.random() * 220, r: 1 + Math.random() * 1.4, life: 1, splash: 0 });
          } else if (e.type === 'collapse') { collapseT = 5; flash = 1; }
          else if (e.type === 'seal') { sealT = 3; }
          else if (e.type === 'morph' || e.type === 'pair' || e.type === 'seed') {
            for (let i = 0; i < 18; i++) sparkles.push({ x: G.IL + Math.random() * (G.IR - G.IL), y: 160 + Math.random() * 300, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30, life: 1.4 + Math.random(), max: 2.4, hue: e.type === 'seed' ? 50 : e.type === 'pair' ? 330 : 170 });
          } else if (e.type === 'plant' || e.type === 'prune') {
            const J = S.jar; const p = J.plants.find((q) => q.id === e.id);
            if (p) for (let i = 0; i < 8; i++) sparkles.push({ x: TD.colX(p.c, J.cols) + (Math.random() - 0.5) * 20, y: G.ST - 6, vx: (Math.random() - 0.5) * 30, vy: -25 - Math.random() * 25, life: 0.8, max: 0.8, hue: e.type === 'plant' ? 120 : 40 });
          }
        }
      },
      /* ---- main draw ---- */
      draw(S, dtReal, t) {
        const J = S.jar, M = S.meta;
        tNow = t;
        const dt = Math.min(0.1, dtReal);
        R.processFx(S);
        collapseT = Math.max(0, collapseT - dt); sealT = Math.max(0, sealT - dt); flash = Math.max(0, flash - dt * 0.8);
        strainSmooth += (J.strain - strainSmooth) * Math.min(1, dt * 2);
        const c = ctx;
        c.setTransform(scale, 0, 0, scale, 0, 0);
        c.clearRect(0, 0, W, H);

        // ----- backdrop tinted by dominant biome
        const dom = TD.sim.dominantBiome(J);
        const tint = TD.BIOMES[dom].tint;
        const bg = c.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, 'hsl(' + tint[0] + ',' + (tint[1] * 0.45) + '%,13%)');
        bg.addColorStop(1, 'hsl(' + (tint[0] + 20) + ',' + (tint[1] * 0.4) + '%,7%)');
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        for (const b of bokeh) {
          const a = b.a * (0.7 + 0.3 * Math.sin(t * 0.3 + b.ph));
          c.fillStyle = 'hsla(' + (tint[0] + 10) + ',60%,70%,' + a + ')';
          c.beginPath(); c.arc(b.x + Math.sin(t * 0.05 + b.ph) * 6, b.y, b.r, 0, 6.3); c.fill();
        }
        // table glow & shadow
        const tg = c.createLinearGradient(0, 560, 0, H);
        tg.addColorStop(0, 'hsla(' + tint[0] + ',30%,22%,0.9)'); tg.addColorStop(1, 'hsla(' + tint[0] + ',30%,10%,1)');
        c.fillStyle = tg; c.fillRect(0, 565, W, H - 565);
        const sh = c.createRadialGradient(250, 568, 10, 250, 568, 210);
        sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        c.save(); c.translate(0, 568); c.scale(1, 0.1); c.translate(0, -568); c.fillStyle = sh; c.fillRect(0, 540, W, 60); c.restore();
        // seal glow behind jar
        if (sealT > 0 || (M.exhibits.length > 0)) {
          const a = 0.05 + Math.min(0.12, M.exhibits.length * 0.015) + (sealT > 0 ? 0.3 * (sealT / 3) : 0);
          const hg = c.createRadialGradient(250, 330, 60, 250, 330, 330);
          hg.addColorStop(0, 'rgba(255,230,170,' + a + ')'); hg.addColorStop(1, 'rgba(255,230,170,0)');
          c.fillStyle = hg; c.fillRect(0, 0, W, H);
        }

        // ----- jar interior
        c.save();
        jarPath(c, 8); c.clip();
        const ig = c.createLinearGradient(0, G.TOP, 0, G.ST);
        ig.addColorStop(0, 'hsla(' + (tint[0] + 40) + ',50%,80%,0.10)'); ig.addColorStop(1, 'hsla(' + tint[0] + ',40%,70%,0.04)');
        c.fillStyle = ig; c.fillRect(0, G.TOP, W, G.IB - G.TOP);
        // light beams
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const o = 90 + i * 100 + Math.sin(t * 0.15 + i) * 14;
          const a = 0.035 + 0.02 * Math.sin(t * 0.3 + i * 2);
          const lg = c.createLinearGradient(o, G.TOP, o + 120, G.ST);
          lg.addColorStop(0, 'rgba(255,250,215,' + a * 1.8 + ')'); lg.addColorStop(1, 'rgba(255,250,215,0)');
          c.fillStyle = lg; c.beginPath(); c.moveTo(o, G.TOP); c.lineTo(o + 46, G.TOP); c.lineTo(o + 190, G.ST); c.lineTo(o + 110, G.ST); c.closePath(); c.fill();
        }
        c.globalCompositeOperation = 'source-over';

        // soil
        R.drawSoil(S);
        c.drawImage(soilCv, 0, 0, soilCv.width, soilCv.height, 0, 0, W, H);
        const cw = (G.IR - G.IL) / J.cols;
        for (let i = 0; i < J.cols; i++) {
          const w = J.w[i];
          c.fillStyle = 'rgba(6,20,32,' + (0.04 + 0.34 * w) + ')';
          c.fillRect(G.IL + i * cw, G.ST, cw + 0.5, 3 * G.ROW + 6);
          // moist sheen at surface
          if (w > 0.6) { c.fillStyle = 'rgba(190,230,255,' + 0.14 * (w - 0.6) + ')'; c.fillRect(G.IL + i * cw, G.ST, cw, 3); }
        }
        // roots
        c.lineCap = 'round';
        for (const p of J.plants) {
          const x = TD.colX(p.c, J.cols), rr = TD.rng(p.seed ^ 0x55);
          const len = 12 + 38 * Math.min(1, p.size);
          c.strokeStyle = 'rgba(235,225,190,0.32)'; c.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            c.beginPath(); c.moveTo(x + (rr() - 0.5) * 6, G.ST);
            c.quadraticCurveTo(x + (rr() - 0.5) * 24, G.ST + len * 0.5, x + (rr() - 0.5) * cw * 0.8, G.ST + len * (0.6 + rr() * 0.4));
            c.stroke();
          }
        }
        // plants (back to front: tall first so low ones in front)
        const order = J.plants.slice().sort((a, b) => TD.PLANT[b.sp].height - TD.PLANT[a.sp].height);
        const pf = TD.plantScale(J.cols);
        for (const p of order) TD.drawPlant(c, p, TD.colX(p.c, J.cols), G.ST + 3, t, { f: pf });
        // selected ring
        if (R.selected) {
          const p = J.plants.find((q) => q.id === R.selected);
          if (p) {
            const x = TD.colX(p.c, J.cols);
            c.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.2 * Math.sin(t * 4)) + ')'; c.setLineDash([4, 4]); c.lineWidth = 1.5;
            c.strokeRect(x - cw / 2 + 2, G.TOP + 8, cw - 4, G.ST - G.TOP - 6 + 3 * G.ROW); c.setLineDash([]);
          }
        }
        R.updateBugs(S, dt, t);
        R.drawBugs(c, t);
        R.updateSpores(S, dt, t);
        R.drawSpores(c);
        // rain
        for (let i = rain.length - 1; i >= 0; i--) {
          const d = rain[i];
          if (d.splash > 0) { d.splash -= dt * 2.5; if (d.splash <= 0) { rain.splice(i, 1); continue; } c.strokeStyle = 'rgba(200,235,255,' + d.splash * 0.5 + ')'; c.beginPath(); c.ellipse(d.x, G.ST, 6 * (1 - d.splash) + 1, 1.5, 0, 0, 6.3); c.stroke(); continue; }
          d.y += d.vy * dt;
          if (d.y >= G.ST - 2) { d.splash = 1; continue; }
          c.strokeStyle = 'rgba(200,235,255,0.65)'; c.lineWidth = d.r; c.lineCap = 'round';
          c.beginPath(); c.moveTo(d.x, d.y - 7); c.lineTo(d.x, d.y); c.stroke();
        }
        // hover preview
        if (R.hover && R.tool) R.drawHover(c, S, t);
        // fog (humidity) & strain
        const fog = Math.min(0.4, J.A * 0.28 + (strainSmooth > 55 ? (strainSmooth - 55) / 45 * 0.25 : 0) + (collapseT > 0 ? 0.3 * collapseT / 5 : 0));
        if (fog > 0.01) {
          const fg = c.createRadialGradient(250, 320, 40, 250, 320, 300);
          fg.addColorStop(0, 'rgba(225,238,245,' + fog * 0.4 + ')'); fg.addColorStop(1, 'rgba(225,238,245,' + fog + ')');
          c.fillStyle = fg; c.fillRect(0, G.TOP - 10, W, G.IB - G.TOP + 20);
        }
        if (strainSmooth > 60) {
          const a = (strainSmooth - 60) / 40 * 0.3 * (0.75 + 0.25 * Math.sin(t * 3));
          const vg = c.createRadialGradient(250, 330, 120, 250, 330, 280);
          vg.addColorStop(0, 'rgba(255,110,60,0)'); vg.addColorStop(1, 'rgba(255,110,60,' + a + ')');
          c.fillStyle = vg; c.fillRect(0, G.TOP - 10, W, G.IB - G.TOP + 20);
        }
        if (collapseT > 0) {
          c.fillStyle = 'rgba(80,70,60,' + 0.28 * Math.min(1, collapseT) + ')'; c.fillRect(0, G.TOP - 10, W, G.IB - G.TOP + 20);
          if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash * 0.5 + ')'; c.fillRect(0, G.TOP - 10, W, G.IB - G.TOP + 20); }
        }
        c.restore();

        R.drawGlass(c, S, t, tint);
        // sparkles (above glass)
        for (let i = sparkles.length - 1; i >= 0; i--) {
          const s = sparkles[i]; s.life -= dt; if (s.life <= 0) { sparkles.splice(i, 1); continue; }
          s.x += s.vx * dt; s.y += s.vy * dt;
          const a = Math.min(1, s.life / s.max * 2);
          c.fillStyle = 'hsla(' + s.hue + ',90%,75%,' + a + ')';
          c.beginPath(); c.arc(s.x, s.y, 1.4 + a, 0, 6.3); c.fill();
        }
        // exhibit halo text-free: ring on seal
        if (sealT > 0) {
          c.strokeStyle = 'rgba(255,235,180,' + sealT / 3 * 0.8 + ')'; c.lineWidth = 3;
          c.beginPath(); c.arc(250, 330, (3 - sealT) * 140, 0, 6.3); c.stroke();
        }
      },
      drawHover(c, S, t) {
        const J = S.jar, h = R.hover;
        const cw = (G.IR - G.IL) / J.cols;
        const x = G.IL + h.c * cw;
        c.fillStyle = 'rgba(255,255,255,0.07)';
        if (R.tool.kind === 'soil') {
          const row = h.row >= 0 ? h.row : 0;
          c.fillRect(x, G.ST + row * G.ROW, cw, G.ROW);
          c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; c.strokeRect(x + 0.75, G.ST + row * G.ROW + 0.75, cw - 1.5, G.ROW - 1.5);
        } else {
          c.fillRect(x, G.TOP + 8, cw, G.ST - G.TOP - 8 + 3 * G.ROW);
          if (R.tool.kind === 'plant' && !J.plants.some((p) => p.c === h.c)) {
            c.globalAlpha = 0.5;
            TD.drawPlant(c, { sp: R.tool.id, size: 0.7, morph: 0, seed: 4242, hp: 1 }, x + cw / 2, G.ST + 3, t, { noGlow: true, f: TD.plantScale(J.cols) });
            c.globalAlpha = 1;
          }
        }
      },
      drawSoil(S) {
        const J = S.jar;
        const key = J.cols + '|' + J.soil.map((s) => s.join(',')).join(';') + '|' + soilCv.width;
        if (key === soilKey) return;
        soilKey = key;
        const c = sctx;
        c.setTransform(scale, 0, 0, scale, 0, 0);
        c.clearRect(0, 0, W, H);
        const cw = (G.IR - G.IL) / J.cols;
        const r = TD.rng(12345);
        for (let row = 2; row >= 0; row--) {
          for (let i = 0; i < J.cols; i++) soilGrains(c, J.soil[i][row], G.IL + i * cw - 1, G.ST + row * G.ROW + (row === 0 ? 0 : -1), cw + 2, G.ROW + 2, r);
        }
        // layer separators & wavy top edge
        for (let row = 1; row < 3; row++) {
          c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1.5; c.beginPath();
          for (let x = G.IL; x <= G.IR; x += 6) { const y = G.ST + row * G.ROW + Math.sin(x * 0.13 + row) * 1.5; if (x === G.IL) c.moveTo(x, y); else c.lineTo(x, y); }
          c.stroke();
          c.strokeStyle = 'rgba(255,255,255,0.07)'; c.beginPath();
          for (let x = G.IL; x <= G.IR; x += 6) { const y = G.ST + row * G.ROW + 2 + Math.sin(x * 0.13 + row) * 1.5; if (x === G.IL) c.moveTo(x, y); else c.lineTo(x, y); }
          c.stroke();
        }
        // top highlight of the surface
        const sg = c.createLinearGradient(0, G.ST, 0, G.ST + 8);
        sg.addColorStop(0, 'rgba(255,255,255,0.14)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sg; c.fillRect(G.IL, G.ST, G.IR - G.IL, 8);
        // column dividers (very faint)
        c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1;
        for (let i = 1; i < J.cols; i++) { c.beginPath(); c.moveTo(G.IL + i * cw, G.ST); c.lineTo(G.IL + i * cw, G.ST + 3 * G.ROW + 6); c.stroke(); }
        // darken toward the bottom for depth
        const dg = c.createLinearGradient(0, G.ST, 0, G.IB + 14);
        dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(0,0,0,0.38)');
        c.fillStyle = dg; c.fillRect(G.IL - 4, G.ST, G.IR - G.IL + 8, G.IB - G.ST + 16);
      },
      /* ---- insects ---- */
      updateBugs(S, dt, t) {
        const J = S.jar;
        const q = R.quality;
        // sync counts
        for (const ins of TD.INSECTS) {
          const pop = J.P[ins.id] || 0;
          const cap = ins.kind === 'air' ? 10 : 14;
          const want = pop < 0.15 ? 0 : Math.min(Math.round(cap * q), Math.max(1, Math.round(pop * 1.3)));
          let have = 0;
          for (const b of bugs) if (b.sp === ins.id && !b.dying) have++;
          if (have < want) for (let i = have; i < want; i++) bugs.push(R.spawnBug(ins, J));
          else if (have > want) { let k = have - want; for (const b of bugs) if (b.sp === ins.id && !b.dying && k > 0) { b.dying = true; k--; } }
        }
        const plants = J.plants;
        for (let i = bugs.length - 1; i >= 0; i--) {
          const b = bugs[i], ins = TD.INSECT[b.sp];
          b.a = Math.max(0, Math.min(1, b.a + (b.dying ? -dt * 1.5 : dt * 1.5)));
          if (b.dying && b.a <= 0) { bugs.splice(i, 1); continue; }
          b.wait -= dt;
          if (b.wait <= 0 || (Math.abs(b.tx - b.x) < 3 && Math.abs(b.ty - b.y) < 3)) R.pickTarget(b, ins, J);
          const sp = b.speed;
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) + 0.001;
          const wob = ins.kind === 'air' ? Math.sin(t * 3 + b.ph) * 14 : 0;
          const vx = (dx / d) * sp, vy = (dy / d) * sp + wob * 0.6;
          b.vx += (vx - b.vx) * Math.min(1, dt * 3); b.vy += (vy - b.vy) * Math.min(1, dt * 3);
          if (d > 2 && b.pause <= 0) { b.x += b.vx * dt; b.y += b.vy * dt; if (Math.abs(b.vx) > 1 || Math.abs(b.vy) > 1) b.ang = Math.atan2(b.vy, b.vx); }
          else b.pause -= dt;
          if (ins.kind === 'ground') { b.y = G.ST - 1.5 - (b.sp === 'spring' ? Math.abs(Math.sin(t * 7 + b.ph)) * 7 * (d > 4 ? 1 : 0) : 0); }
          b.x = Math.max(G.IL + 4, Math.min(G.IR - 4, b.x)); b.y = Math.max(G.TOP + 10, Math.min(G.ST - 1, b.y));
        }
      },
      spawnBug(ins, J) {
        const x = G.IL + 20 + Math.random() * (G.IR - G.IL - 40);
        const y = ins.kind === 'air' ? G.TOP + 40 + Math.random() * 200 : G.ST - 2;
        return { sp: ins.id, x, y, vx: 0, vy: 0, tx: x, ty: y, ang: 0, a: 0, ph: Math.random() * 6, wait: 0, pause: 0, speed: 12, dying: false };
      },
      pickTarget(b, ins, J) {
        const plants = J.plants;
        if (ins.kind === 'air') {
          let tx = G.IL + 20 + Math.random() * (G.IR - G.IL - 40), ty = G.TOP + 30 + Math.random() * (G.ST - G.TOP - 60);
          if (b.sp === 'moth') {
            const fl = plants.filter((p) => TD.PLANT[p.sp].flower > 0.5);
            if (fl.length && Math.random() < 0.7) { const p = fl[(Math.random() * fl.length) | 0]; tx = TD.colX(p.c, J.cols) + (Math.random() - 0.5) * 30; ty = G.ST - TD.PLANT[p.sp].height * 280 * Math.min(1, p.size) - 10 + Math.random() * 24; }
          }
          b.tx = tx; b.ty = ty; b.speed = 28 + Math.random() * 26; b.wait = 1.5 + Math.random() * 2.5;
        } else if (ins.kind === 'crawl') {
          if (plants.length && Math.random() < 0.85) {
            const p = plants[(Math.random() * plants.length) | 0];
            const h = TD.PLANT[p.sp].height * 280 * Math.min(1, p.size);
            b.tx = TD.colX(p.c, J.cols) + (Math.random() - 0.5) * 16; b.ty = G.ST - 4 - Math.random() * h * 0.9;
          } else { b.tx = G.IL + 10 + Math.random() * (G.IR - G.IL - 20); b.ty = G.ST - 2; }
          b.speed = 8 + Math.random() * 8; b.wait = 3 + Math.random() * 4; b.pause = Math.random() * 1.2;
        } else {
          b.tx = G.IL + 10 + Math.random() * (G.IR - G.IL - 20); b.ty = G.ST - 2;
          b.speed = b.sp === 'spring' ? 22 : 9; b.wait = 2 + Math.random() * 4; b.pause = Math.random() * (b.sp === 'spring' ? 1.5 : 0.8);
        }
      },
      drawBugs(c, t) {
        for (const b of bugs) {
          const ins = TD.INSECT[b.sp];
          c.save();
          c.globalAlpha = b.a;
          c.translate(b.x, b.y); c.rotate(b.ang);
          const s = ins.size * 1.3;
          if (b.sp === 'moth' || b.sp === 'lace') {
            const gl = c.createRadialGradient(0, 0, 0, 0, 0, s * 6);
            gl.addColorStop(0, b.sp === 'moth' ? 'rgba(255,240,150,0.45)' : 'rgba(190,255,215,0.25)'); gl.addColorStop(1, 'rgba(255,240,150,0)');
            c.globalCompositeOperation = 'lighter'; c.fillStyle = gl; c.fillRect(-s * 6, -s * 6, s * 12, s * 12); c.globalCompositeOperation = 'source-over';
          }
          if (ins.kind === 'air' || b.sp === 'beetle') {
            const flap = ins.kind === 'air' ? Math.sin(t * 38 + b.ph) : 0.15 * Math.sin(t * 3 + b.ph);
            const wl = s * (b.sp === 'lace' ? 3.6 : 2.6);
            c.fillStyle = b.sp === 'lace' ? 'rgba(220,255,235,0.45)' : b.sp === 'moth' ? 'rgba(255,248,200,0.6)' : 'rgba(255,255,255,0.28)';
            for (const sgn of [-1, 1]) {
              c.save(); c.rotate(sgn * (0.9 + 0.5 * flap)); c.beginPath(); c.ellipse(-wl * 0.15, sgn * 0, wl * 0.55, wl * (b.sp === 'moth' ? 0.38 : 0.22), -0.4 * sgn, 0, 6.3); c.translate(0, 0); c.fill(); c.restore();
            }
          }
          if (b.sp === 'pill') {
            c.fillStyle = ins.col; c.beginPath(); c.ellipse(0, 0, s * 1.5, s * 1.0, 0, 0, 6.3); c.fill();
            c.strokeStyle = 'rgba(40,50,60,0.45)'; c.lineWidth = 0.6; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(k * s * 0.6, -s); c.lineTo(k * s * 0.6, s); c.stroke(); }
          } else if (b.sp === 'beetle') {
            c.fillStyle = ins.col; c.beginPath(); c.ellipse(0, 0, s * 1.15, s * 0.95, 0, 0, 6.3); c.fill();
            c.fillStyle = '#2b1a1a'; c.beginPath(); c.arc(s * 0.95, 0, s * 0.48, 0, 6.3); c.fill();
            c.fillRect(-s * 1.0, -0.3, s * 2, 0.6);
            c.beginPath(); c.arc(-s * 0.3, -s * 0.4, 0.7, 0, 6.3); c.arc(s * 0.2, s * 0.4, 0.7, 0, 6.3); c.fill();
          } else {
            c.fillStyle = ins.col; c.beginPath(); c.arc(0, 0, s, 0, 6.3); c.fill();
            if (b.sp === 'moth') { c.fillStyle = '#fffbd8'; c.beginPath(); c.ellipse(0, 0, s * 1.3, s * 0.7, 0, 0, 6.3); c.fill(); }
            if (b.sp === 'aphid') { c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(-s * 0.3, -s * 0.3, s * 0.35, 0, 6.3); c.fill(); }
          }
          c.restore();
        }
      },
      /* ---- spores ---- */
      updateSpores(S, dt, t) {
        const J = S.jar;
        const cap = Math.floor(34 * R.quality);
        let emit = 2.2 * dt * R.quality;
        const emitters = [];
        for (const p of J.plants) {
          if (p.sp === 'bell') { emit += 1.4 * dt * p.size; emitters.push(p); }
          if (p.morph) { emit += (0.8 + p.morph * 0.6) * dt; emitters.push(p); }
        }
        while (emit > 0 && spores.length < cap) {
          if (Math.random() > emit) break; emit -= 1;
          let x, y, hue = 150, sat = 70;
          if (emitters.length && Math.random() < 0.8) {
            const p = emitters[(Math.random() * emitters.length) | 0];
            x = TD.colX(p.c, J.cols) + (Math.random() - 0.5) * 24; y = G.ST - TD.PLANT[p.sp].height * 280 * Math.min(1, p.size) * (0.4 + Math.random() * 0.6);
            if (p.morph) { const mh = TD.MORPHS[p.morph].hue.acc; hue = mh; } else hue = 320;
          } else { x = G.IL + 10 + Math.random() * (G.IR - G.IL - 20); y = G.ST - 20 - Math.random() * 150; hue = 80 + Math.random() * 90; }
          spores.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 8, life: 0, max: 5 + Math.random() * 6, r: 1 + Math.random() * 1.6, hue, ph: Math.random() * 6 });
        }
        for (let i = spores.length - 1; i >= 0; i--) {
          const s = spores[i]; s.life += dt;
          if (s.life > s.max || s.y < G.TOP + 6) { spores.splice(i, 1); continue; }
          s.x += (s.vx + Math.sin(t * 0.8 + s.ph) * 6) * dt; s.y += s.vy * dt;
        }
      },
      drawSpores(c) {
        c.globalCompositeOperation = 'lighter';
        for (const s of spores) {
          const k = s.life / s.max, a = Math.sin(k * Math.PI) * 0.8;
          const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4.5);
          g.addColorStop(0, 'hsla(' + s.hue + ',90%,75%,' + a + ')'); g.addColorStop(1, 'hsla(' + s.hue + ',90%,70%,0)');
          c.fillStyle = g; c.fillRect(s.x - s.r * 5, s.y - s.r * 5, s.r * 10, s.r * 10);
        }
        c.globalCompositeOperation = 'source-over';
      },
      /* ---- the glass ---- */
      drawGlass(c, S, t, tint) {
        const J = S.jar;
        // droplets on glass
        const want = Math.round(6 + J.A * 16 + (collapseT > 0 ? 6 : 0));
        while (drops.length < want) drops.push(newDrop(Math.random, false));
        while (drops.length > want + 4) drops.pop();
        for (const d of drops) {
          if (d.slide > 0) { d.vy += 60 * 0.033; d.y += d.vy * 0.033; d.slide -= 0.033; c.strokeStyle = 'rgba(220,240,255,0.14)'; c.lineWidth = d.r * 0.8; c.beginPath(); c.moveTo(d.x, d.y - d.trail); c.lineTo(d.x, d.y); c.stroke(); d.trail = Math.min(40, d.trail + 1.2); if (d.slide <= 0 || d.y > 470) Object.assign(d, newDrop(Math.random, false)); }
          else { d.wait -= 0.033; if (d.wait <= 0 && d.y < 400) { d.slide = 1.2 + Math.random() * 1.5; d.vy = 4; d.trail = 0; } }
          c.fillStyle = 'rgba(210,235,255,0.22)'; c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * 1.15, 0, 0, 6.3); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.32, 0, 6.3); c.fill();
          c.strokeStyle = 'rgba(160,200,230,0.3)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * 1.15, 0, 0, 6.3); c.stroke();
        }
        // body tint
        jarPath(c, 0);
        const gg = c.createLinearGradient(60, 0, 440, 0);
        gg.addColorStop(0, 'rgba(190,230,255,0.17)'); gg.addColorStop(0.15, 'rgba(190,230,255,0.04)'); gg.addColorStop(0.85, 'rgba(190,230,255,0.03)'); gg.addColorStop(1, 'rgba(190,230,255,0.15)');
        c.fillStyle = gg; c.fill();
        // outline
        const og = c.createLinearGradient(60, 80, 440, 560);
        og.addColorStop(0, 'rgba(235,250,255,0.75)'); og.addColorStop(0.5, 'rgba(180,220,240,0.35)'); og.addColorStop(1, 'rgba(235,250,255,0.6)');
        c.strokeStyle = og; c.lineWidth = 4; jarPath(c, 0); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.2; jarPath(c, 7); c.stroke();
        // highlights
        const hl = c.createLinearGradient(0, 130, 0, 500);
        hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.25, 'rgba(255,255,255,0.4)'); hl.addColorStop(0.8, 'rgba(255,255,255,0.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = hl; c.beginPath(); c.roundRect ? c.roundRect(76, 130, 9, 370, 5) : c.rect(76, 130, 9, 370); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.roundRect ? c.roundRect(92, 160, 3, 90, 2) : c.rect(92, 160, 3, 90); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.14)'; c.beginPath(); c.roundRect ? c.roundRect(414, 170, 5, 150, 3) : c.rect(414, 170, 5, 150); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(80, 140); c.quadraticCurveTo(82, 104, 122, 98); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.moveTo(86, 540); c.quadraticCurveTo(100, 553, 130, 553); c.stroke();
        // rim band
        const rg = c.createLinearGradient(0, 80, 0, 104);
        rg.addColorStop(0, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0.05)');
        c.fillStyle = rg; c.beginPath(); c.roundRect ? c.roundRect(112, 84, 276, 14, 6) : c.rect(112, 84, 276, 14); c.fill();
        // cork lid
        const kg = c.createLinearGradient(0, 52, 0, 92);
        kg.addColorStop(0, 'hsl(34,40%,62%)'); kg.addColorStop(1, 'hsl(30,38%,42%)');
        c.fillStyle = kg; c.beginPath(); c.roundRect ? c.roundRect(130, 50, 240, 42, 8) : c.rect(130, 50, 240, 42); c.fill();
        for (const s of corkSpecks) { c.fillStyle = s[3] < 0.5 ? 'rgba(80,50,25,0.35)' : 'rgba(255,230,180,0.3)'; c.beginPath(); c.arc(s[0], s[1], s[2], 0, 6.3); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(138, 54, 224, 4);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(132, 86, 236, 5);
        // exhibit seal ring on lid
        const ex = S.meta.exhibits.length;
        if (ex > 0) { c.fillStyle = 'rgba(255,224,150,0.85)'; for (let i = 0; i < Math.min(ex, 10); i++) { c.beginPath(); c.arc(150 + i * 22, 71, 4, 0, 6.3); c.fill(); } }
      },
    };
    R.resize();
    return R;
  };
})();
