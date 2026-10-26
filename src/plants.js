/* Terrarium Drift - procedural plant drawing (canvas 2D, no assets). */
(function () {
  const TD = (globalThis.TD = globalThis.TD || {});
  const UNIT = 280; // px for height 1.0 in the jar canvas

  function leaf(c, x, y, ang, len, wid, fill) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.45, -wid, len, 0);
    c.quadraticCurveTo(len * 0.45, wid, 0, 0);
    c.fillStyle = fill; c.fill(); c.restore();
  }
  function heart(c, x, y, ang, s, fill) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(s * 0.9, -s * 0.5, s * 1.3, -s * 1.5, s * 0.5, -s * 1.7);
    c.bezierCurveTo(s * 0.2, -s * 1.75, 0, -s * 1.4, 0, -s * 1.2);
    c.bezierCurveTo(0, -s * 1.4, -s * 0.2, -s * 1.75, -s * 0.5, -s * 1.7);
    c.bezierCurveTo(-s * 1.3, -s * 1.5, -s * 0.9, -s * 0.5, 0, 0);
    c.fillStyle = fill; c.fill(); c.restore();
  }
  function stem(c, pts, w0, w1, color) {
    c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      c.lineWidth = w0 + (w1 - w0) * (i / (pts.length - 1));
      c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    }
  }

  const shapes = {
    moss(c, o) {
      const { r, col, s, t } = o;
      const W = 22 + 26 * s;
      c.fillStyle = col('stem', -6); c.beginPath(); c.ellipse(0, 0, W * 0.55, 5 + 5 * s, 0, Math.PI, 0); c.fill();
      for (let i = 0; i < 22; i++) {
        const bx = (r() - 0.5) * W * 1.05, by = -r() * (6 + 12 * s) * (1 - Math.abs(bx) / W * 0.7);
        const rad = (3 + r() * 6) * (0.5 + 0.5 * s);
        c.fillStyle = col('leaf', (r() - 0.4) * 16);
        c.beginPath(); c.arc(bx, by, rad, 0, 6.3); c.fill();
      }
      for (let i = 0; i < 8; i++) {
        const bx = (r() - 0.5) * W, by = -r() * (6 + 12 * s) - 2;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
        c.fillStyle = col('acc', 6).replace(')', ',' + (0.3 + 0.5 * tw) + ')').replace('hsl(', 'hsla(');
        c.beginPath(); c.arc(bx, by, 1.2 + tw, 0, 6.3); c.fill();
      }
    },
    fern(c, o) {
      const { r, col, hpx, bend } = o;
      const nf = 4 + (o.s > 0.6 ? 1 : 0) + (o.s > 0.95 ? 1 : 0);
      for (let k = 0; k < nf; k++) {
        const base = -Math.PI / 2 + (k - (nf - 1) / 2) * 0.5 + (r() - 0.5) * 0.15;
        const L = hpx * (0.75 + r() * 0.35);
        const seg = 12;
        let x = 0, y = 0;
        const side = k - (nf - 1) / 2 >= 0 ? 1 : -1;
        const pts = [[0, 0]];
        const ang = [];
        for (let i = 1; i <= seg; i++) {
          const u = i / seg;
          const a = base + side * u * u * 1.0 + bend(u) * 0.012 + o.droop * side * u * 0.8;
          x += Math.cos(a) * L / seg; y += Math.sin(a) * L / seg;
          pts.push([x, y]); ang.push(a);
        }
        stem(c, pts, 2, 0.8, col('stem', 2));
        for (let i = 2; i <= seg; i++) {
          const u = i / seg, ll = (1 - u * 0.75) * L * 0.2 + 2;
          const p = pts[i], a = ang[i - 1];
          const fill = col('leaf', (u - 0.5) * 14);
          leaf(c, p[0], p[1], a - 1.1, ll, ll * 0.32, fill);
          leaf(c, p[0], p[1], a + 1.1, ll, ll * 0.32, fill);
        }
        leaf(c, x, y, ang[seg - 1], 6, 2.5, col('acc', 8));
      }
    },
    vine(c, o) {
      const { r, col, hpx, bend } = o;
      const seg = 22;
      const pts = [];
      const ph = r() * 6;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        pts.push([Math.sin(u * 7 + ph) * (7 + 8 * u) + bend(u), -u * hpx]);
      }
      stem(c, pts, 2.6, 1.2, col('stem'));
      for (let i = 3; i <= seg; i += 2) {
        const u = i / seg, p = pts[i];
        const side = (i / 2) % 2 === 0 ? 1 : -1;
        const sz = (5 + 6 * (1 - u * 0.5)) * Math.min(1, o.s + 0.2);
        heart(c, p[0], p[1], side * (1.2 + 0.2 * Math.sin(o.t + i)) + Math.PI, sz, col('leaf', (r() - 0.5) * 14));
        if (r() < 0.35 && o.s > 0.5) {
          const dx = p[0] + side * sz * 0.8, dy = p[1] + sz * 0.9;
          c.fillStyle = 'rgba(210,240,255,0.7)'; c.beginPath(); c.arc(dx, dy, 1.6, 0, 6.3); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(dx - 0.5, dy - 0.5, 0.6, 0, 6.3); c.fill();
        }
      }
      if (o.s > 0.75) {
        const p = pts[seg];
        for (let k = 0; k < 5; k++) { c.fillStyle = col('acc', 10); c.beginPath(); c.ellipse(p[0] + Math.cos(k * 1.256) * 3.5, p[1] - 3 + Math.sin(k * 1.256) * 3.5, 2.5, 1.6, k * 1.256, 0, 6.3); c.fill(); }
        c.fillStyle = 'hsl(48,90%,70%)'; c.beginPath(); c.arc(p[0], p[1] - 3, 1.5, 0, 6.3); c.fill();
      }
    },
    bell(c, o) {
      const { r, col, hpx, t } = o;
      const n = 2 + (o.s > 0.5 ? 1 : 0) + (o.s > 0.85 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const ox = (k - (n - 1) / 2) * 15 + (r() - 0.5) * 5;
        const h = hpx * (0.5 + r() * 0.5), cr = (7 + r() * 7) * (0.5 + 0.6 * o.s);
        const lean = (r() - 0.5) * 0.3 + o.bend(1) * 0.01;
        c.save(); c.translate(ox, 0); c.rotate(lean);
        c.fillStyle = col('stem'); c.beginPath(); c.moveTo(-2.4, 0); c.quadraticCurveTo(-1.6, -h * 0.5, -2, -h); c.lineTo(2, -h); c.quadraticCurveTo(1.6, -h * 0.5, 2.4, 0); c.fill();
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + k);
        const g = c.createRadialGradient(0, -h, 1, 0, -h, cr * 2.2);
        g.addColorStop(0, col('acc', 6).replace('hsl(', 'hsla(').replace(')', ',' + (0.28 * pulse + 0.1) + ')'));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(-cr * 2.4, -h - cr * 2.4, cr * 4.8, cr * 4.8);
        c.fillStyle = col('leaf', -4); c.beginPath(); c.ellipse(0, -h, cr, cr * 0.75, 0, Math.PI, 0); c.fill();
        c.fillStyle = col('leaf', -14); c.beginPath(); c.ellipse(0, -h, cr, cr * 0.22, 0, 0, Math.PI); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.65)';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.arc((r() - 0.5) * cr * 1.3, -h - r() * cr * 0.55, 0.9 + r() * 1.1, 0, 6.3); c.fill(); }
        c.restore();
      }
    },
    sun(c, o) {
      const { r, col, hpx, bend } = o;
      const seg = 14, pts = [];
      for (let i = 0; i <= seg; i++) { const u = i / seg; pts.push([bend(u) + Math.sin(u * 3) * 2, -u * hpx]); }
      stem(c, pts, 3.4, 2, col('stem'));
      const nl = 3;
      for (let k = 0; k < nl; k++) {
        const u = 0.2 + k * 0.2, p = pts[Math.round(u * seg)], sd = k % 2 ? 1 : -1;
        leaf(c, p[0], p[1], sd < 0 ? -Math.PI + 0.6 + r() * 0.2 : -0.6 - r() * 0.2, 22 * (0.4 + o.s * 0.7), 6 + 3 * o.s, col('leaf', (r() - 0.5) * 10));
      }
      if (o.s > 0.4) {
        const p = pts[seg], R = (8 + 11 * Math.min(o.s, 1.2));
        const bloom = Math.min(1, (o.s - 0.4) / 0.4);
        const np = 11;
        for (let k = 0; k < np; k++) {
          const a = (k / np) * 6.283 + o.t * 0.05;
          c.save(); c.translate(p[0], p[1] - 2); c.rotate(a);
          c.fillStyle = col('acc', (k % 2) * 6); c.beginPath(); c.ellipse(R * 0.85 * bloom, 0, R * 0.55 * bloom, R * 0.2 * bloom, 0, 0, 6.3); c.fill();
          c.restore();
        }
        c.fillStyle = 'hsl(28,60%,28%)'; c.beginPath(); c.arc(p[0], p[1] - 2, R * 0.38 * bloom, 0, 6.3); c.fill();
        c.fillStyle = 'hsl(36,70%,45%)'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(p[0] + (r() - 0.5) * R * 0.5, p[1] - 2 + (r() - 0.5) * R * 0.5, 1, 0, 6.3); c.fill(); }
      }
    },
    succ(c, o) {
      const { r, col, hpx } = o;
      const R = Math.max(10, hpx * 1.05);
      for (let ring = 2; ring >= 0; ring--) {
        const n = 7 + ring * 2, len = R * (0.55 + ring * 0.2) * (1 - 0.08 * ring);
        for (let k = 0; k < n; k++) {
          const a = -Math.PI + (k + 0.5) / n * Math.PI + (r() - 0.5) * 0.1;
          const ay = ring === 0 ? 0.9 : ring === 1 ? 0.7 : 0.5;
          c.save(); c.translate(0, -ring * 3);
          c.rotate(a * 0.55 + (-Math.PI / 2) * 0.45 + Math.PI * 0.45 * 0);
          c.restore();
          // upward-fanning pointed leaf
          const ang = -Math.PI / 2 + (k / (n - 1) - 0.5) * (2.2 - ring * 0.35);
          const x1 = Math.cos(ang) * len, y1 = Math.sin(ang) * len * ay;
          c.save(); c.translate(0, -ring * 3);
          c.beginPath(); c.moveTo(0, 0);
          c.quadraticCurveTo(x1 * 0.5 - 5 * Math.sin(ang), y1 * 0.5 + 5 * Math.cos(ang) * 0.3, x1, y1);
          c.quadraticCurveTo(x1 * 0.5 + 5 * Math.sin(ang), y1 * 0.5 - 5 * Math.cos(ang) * 0.3, 0, 0);
          c.fillStyle = col('leaf', -8 + ring * 7 + (r() - 0.5) * 6); c.fill();
          c.fillStyle = col('acc', 4); c.beginPath(); c.arc(x1, y1, 1.6, 0, 6.3); c.fill();
          c.restore();
        }
      }
    },
    cactus(c, o) {
      const { r, col, hpx, bend } = o;
      const w = 9 + 9 * Math.min(o.s, 1.2);
      const lean = bend(1) * 0.8;
      c.save(); c.translate(0, 0);
      const body = (x0, w0, h0, lean0) => {
        c.beginPath();
        c.moveTo(x0 - w0, 0); c.lineTo(x0 - w0 + lean0 * 0.2, -h0 * 0.8);
        c.quadraticCurveTo(x0 + lean0, -h0 - w0 * 0.3, x0 + w0 + lean0 * 0.6, -h0 * 0.8);
        c.lineTo(x0 + w0, 0); c.closePath();
        c.fillStyle = col('leaf'); c.fill();
        c.strokeStyle = col('leaf', -12); c.lineWidth = 1;
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x0 + k * w0 * 0.4, -1); c.quadraticCurveTo(x0 + k * w0 * 0.45 + lean0 * 0.3, -h0 * 0.5, x0 + k * w0 * 0.2 + lean0 * 0.8, -h0 * 0.95); c.stroke(); }
        c.fillStyle = 'rgba(255,255,230,0.8)';
        for (let k = 0; k < h0 / 9; k++) for (let m = -1; m <= 1; m += 2) { c.fillRect(x0 + m * w0 * 0.45 + lean0 * (k * 9 / h0) * 0.7, -6 - k * 9, 1.2, 1.2); }
      };
      body(0, w, hpx, lean);
      if (o.s > 0.55) { // arm
        const ay = -hpx * 0.45, ah = hpx * 0.4;
        c.strokeStyle = col('leaf'); c.lineWidth = w * 0.7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(w * 0.6, ay); c.quadraticCurveTo(w * 2, ay, w * 2, ay - ah * 0.5); c.lineTo(w * 2 + lean * 0.3, ay - ah); c.stroke();
      }
      if (o.s > 0.8) {
        const fx = lean * 0.9, fy = -hpx - w * 0.2;
        for (let k = 0; k < 6; k++) { c.fillStyle = col('acc', (k % 2) * 6); c.beginPath(); c.ellipse(fx + Math.cos(k * 1.05) * 4, fy + Math.sin(k * 1.05) * 3 - 2, 4, 2, k * 1.05, 0, 6.3); c.fill(); }
        c.fillStyle = 'hsl(48,95%,65%)'; c.beginPath(); c.arc(fx, fy - 2, 2, 0, 6.3); c.fill();
      }
      c.restore();
    },
    reed(c, o) {
      const { r, col, hpx, bend } = o;
      const n = 6;
      const tops = [];
      for (let k = 0; k < n; k++) {
        const x0 = (k - (n - 1) / 2) * 6, L = hpx * (0.55 + r() * 0.45), lean = (r() - 0.5) * 22 + (k - 2.5) * 3;
        c.beginPath(); c.moveTo(x0 - 2.2, 0);
        const bx = (u) => x0 + lean * u * u + bend(u) * (0.6 + 0.2 * k % 2);
        c.quadraticCurveTo(x0 - 1.5 + lean * 0.2, -L * 0.5, bx(1), -L);
        c.quadraticCurveTo(x0 + 2 + lean * 0.3, -L * 0.5, x0 + 2.2, 0);
        c.fillStyle = col('leaf', (r() - 0.5) * 12); c.fill();
        if (k % 2 === 0 && o.s > 0.5) tops.push([bx(1), -L, L]);
      }
      for (const [x, y, L] of tops.slice(0, 3)) {
        c.strokeStyle = col('stem'); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x - 1, y + L * 0.2); c.lineTo(x, y - 6); c.stroke();
        c.fillStyle = col('acc'); c.beginPath(); c.roundRect ? c.roundRect(x - 3, y - 14, 6, 17, 3) : c.rect(x - 3, y - 14, 6, 17); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x - 1.5, y - 12, 1.2, 12);
      }
    },
    sundrop(c, o) {
      const { r, col, hpx, t } = o;
      const R = Math.max(12, Math.min(70, hpx * 0.85)), n = 9;
      for (let k = 0; k < n; k++) {
        const ang = -Math.PI + (k + 0.5) / n * Math.PI;
        const len = R * (0.6 + r() * 0.4);
        const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len * 0.75 - 3;
        c.save();
        c.beginPath(); c.moveTo(0, 0);
        c.quadraticCurveTo(ex * 0.5 + 3, ey * 0.5 - 4, ex, ey);
        c.quadraticCurveTo(ex * 0.5 - 3, ey * 0.5 + 4, 0, 0);
        c.fillStyle = col('leaf', (r() - 0.5) * 8); c.fill();
        // spoon head
        c.beginPath(); c.ellipse(ex, ey, 5.5, 3.8, ang, 0, 6.3); c.fillStyle = col('acc', -10); c.fill();
        c.strokeStyle = col('acc', 4); c.lineWidth = 0.8;
        for (let h = 0; h < 7; h++) { const ha = h / 7 * 6.28; c.beginPath(); c.moveTo(ex + Math.cos(ha) * 3, ey + Math.sin(ha) * 2); c.lineTo(ex + Math.cos(ha) * 7.5, ey + Math.sin(ha) * 6); c.stroke(); c.fillStyle = 'rgba(255,200,210,0.85)'; c.beginPath(); c.arc(ex + Math.cos(ha) * 7.5, ey + Math.sin(ha) * 6, 1.1, 0, 6.3); c.fill(); }
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + k);
        c.fillStyle = 'rgba(255,120,150,' + (0.2 + 0.25 * tw) + ')'; c.beginPath(); c.arc(ex, ey, 7 + 2 * tw, 0, 6.3); c.fill();
        c.restore();
      }
    },
    gentian(c, o) {
      const { r, col, hpx, bend } = o;
      const n = 3;
      for (let k = 0; k < n; k++) {
        const lean = (k - 1) * 12 + (r() - 0.5) * 6, L = hpx * (0.65 + r() * 0.35);
        const pts = [];
        for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([lean * u * u * 1.2 + bend(u) * 0.9, -u * L]); }
        stem(c, pts, 2, 1.2, col('stem'));
        for (let i = 2; i < 10; i += 2) { const p = pts[i]; const sd = (i / 2) % 2 ? 1 : -1; leaf(c, p[0], p[1], sd > 0 ? -0.4 : -Math.PI + 0.4, 10 * (1 - i / 14), 2.6, col('leaf', (r() - 0.5) * 8)); }
        if (o.s > 0.5) {
          const p = pts[10];
          c.save(); c.translate(p[0], p[1]); c.rotate((k - 1) * 0.2);
          c.beginPath(); c.moveTo(-3, 0); c.quadraticCurveTo(-8, -10, -9, -17); c.lineTo(-5, -15); c.lineTo(-2.5, -18.5); c.lineTo(0, -15.5); c.lineTo(2.5, -18.5); c.lineTo(5, -15); c.lineTo(9, -17); c.quadraticCurveTo(8, -10, 3, 0); c.closePath();
          c.fillStyle = col('acc'); c.fill();
          c.fillStyle = col('acc', 14); c.beginPath(); c.ellipse(0, -14, 4, 2, 0, 0, 6.3); c.fill();
          c.restore();
        }
      }
    },
    cushion(c, o) {
      const { r, col, hpx, t } = o;
      const W = 22 + 30 * Math.min(1.2, o.s), Hh = Math.max(8, hpx);
      c.beginPath(); c.ellipse(0, 0, W, Hh, 0, Math.PI, 0); c.fillStyle = col('leaf', -8); c.fill();
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI, rr = Math.sqrt(r());
        const x = -Math.cos(a) * W * rr * 0.95, y = -Math.sin(a) * Hh * rr * 0.95;
        c.fillStyle = col('leaf', (r() - 0.3) * 18); c.beginPath(); c.arc(x, y, 2 + r() * 2.5, 0, 6.3); c.fill();
      }
      const nf = Math.floor(8 + 8 * Math.min(1, o.s));
      for (let i = 0; i < nf; i++) {
        const a = r() * Math.PI, rr = 0.2 + 0.75 * Math.sqrt(r());
        const x = -Math.cos(a) * W * rr, y = -Math.sin(a) * Hh * rr - 1;
        const tw = 0.7 + 0.3 * Math.sin(t * 1.4 + i);
        c.fillStyle = col('acc', (i % 3) * 4); 
        for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + Math.cos(k * 1.257) * 2.2, y + Math.sin(k * 1.257) * 2.2, 1.6 * tw, 0, 6.3); c.fill(); }
        c.fillStyle = 'hsl(50,90%,70%)'; c.beginPath(); c.arc(x, y, 1, 0, 6.3); c.fill();
      }
    },
    edel(c, o) {
      const { r, col, hpx, bend, t } = o;
      const seg = 12, pts = [];
      for (let i = 0; i <= seg; i++) { const u = i / seg; pts.push([bend(u) * 0.8 + Math.sin(u * 2.2) * 3, -u * hpx]); }
      stem(c, pts, 3, 1.8, col('stem'));
      for (let k = 0; k < 4; k++) { const p = pts[2 + k * 2]; const sd = k % 2 ? 1 : -1; leaf(c, p[0], p[1], sd > 0 ? -0.5 : -Math.PI + 0.5, 15 * (1 - k * 0.15), 3.4, col('leaf', 6)); }
      if (o.s > 0.4) {
        const p = pts[seg], R = 9 + 12 * Math.min(1.1, o.s), n = 9;
        const bloom = Math.min(1, (o.s - 0.4) / 0.35);
        const g = c.createRadialGradient(p[0], p[1], 2, p[0], p[1], R * 1.8);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.25 + 0.1 * Math.sin(t * 1.5)) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(p[0] - R * 2, p[1] - R * 2, R * 4, R * 4);
        for (let k = 0; k < n; k++) {
          const a = k / n * 6.283 + 0.2;
          c.save(); c.translate(p[0], p[1]); c.rotate(a);
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(R * 0.4 * bloom, -R * 0.2 * bloom, R * bloom, 0); c.quadraticCurveTo(R * 0.4 * bloom, R * 0.2 * bloom, 0, 0);
          c.fillStyle = col('acc', (k % 2) * -5); c.fill(); c.restore();
        }
        c.fillStyle = 'hsl(48,80%,62%)'; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(p[0] + (r() - 0.5) * R * 0.5, p[1] + (r() - 0.5) * R * 0.5, 1.4, 0, 6.3); c.fill(); }
      }
    },
  };

  /**
   * Draw a plant with base at (x, y).
   * p: {sp (id), size, morph, seed, hp}
   */
  TD.drawPlant = function (c, p, x, y, t, opt) {
    opt = opt || {};
    const sp = TD.PLANT[p.sp];
    const unit = opt.unit || UNIT;
    const size = Math.min(p.size, 1.4);
    const s = Math.max(0.08, size);
    const hpx = Math.max(6, sp.height * unit * Math.pow(s, 0.9));
    const wilt = Math.max(0, Math.min(1, (0.5 - (p.hp == null ? 1 : p.hp)) / 0.5));
    const morph = p.morph || 0;
    const ph = ((p.seed || 1) % 628) / 100;
    const sa = opt.still ? 0 : 3 + hpx * 0.06;
    const dir = (p.seed & 1) ? 1 : -1;
    const bend = (u) => (Math.sin(t * 0.8 + ph) * 0.65 + Math.sin(t * 1.9 + ph * 2) * 0.25) * sa * u * u + wilt * hpx * 0.22 * u * u * dir;
    const col = (part, dl, a) => {
      const b = TD.plantColor(sp, morph, part);
      const h = b[0] + (40 - b[0]) * wilt * 0.35, sat = b[1] * (1 - 0.55 * wilt), l = b[2] - 7 * wilt + (dl || 0);
      return a == null ? 'hsl(' + Math.round(h) + ',' + Math.round(sat) + '%,' + Math.round(Math.max(5, Math.min(95, l))) + '%)' : 'hsla(' + Math.round(h) + ',' + Math.round(sat) + '%,' + Math.round(Math.max(5, Math.min(95, l))) + '%,' + a + ')';
    };
    const r = TD.rng(p.seed || 1);
    c.save();
    c.translate(x, y);
    if (opt.f && opt.f !== 1) c.scale(opt.f, opt.f);
    if (morph && !opt.noGlow) {
      const m = TD.MORPHS[morph];
      const pul = 0.5 + 0.5 * Math.sin(t * 1.6 + ph);
      const gr = Math.max(26, hpx * 0.75 + 16);
      const g = c.createRadialGradient(0, -hpx * 0.5, 2, 0, -hpx * 0.5, gr);
      const a = (morph === 1 ? 0.14 : morph === 2 ? 0.22 : 0.3) * (0.7 + 0.3 * pul);
      g.addColorStop(0, m.glow + a + ')'); g.addColorStop(1, m.glow + '0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = g; c.fillRect(-gr, -hpx * 0.5 - gr, gr * 2, gr * 2);
      c.globalCompositeOperation = 'source-over';
    }
    (shapes[sp.id] || shapes.moss)(c, { r, col, hpx, s, t, bend, droop: wilt * 0.5 * dir });
    c.restore();
  };

  TD.plantScale = function (cols) { const cw = 352 / cols; return Math.max(0.7, Math.min(1, 0.5 + cw / 120)); };

  TD.drawPlantIcon = function (canvas, spId, morph, hidden) {
    const c = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    const sp = TD.PLANT[spId];
    const g = c.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h * 0.55, w * 0.7);
    g.addColorStop(0, 'rgba(160,220,210,0.18)'); g.addColorStop(1, 'rgba(160,220,210,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save();
    if (hidden) c.filter = 'brightness(0) opacity(0.35)';
    const k = Math.min((h * 0.8) / (Math.max(sp.height, 0.22) * 200), (w * 0.72) / 90, 1.3);
    TD.drawPlant(c, { sp: spId, size: 1, morph: morph || 0, seed: 12345 + spId.length * 77, hp: 1 }, w / 2, h * 0.9, 1.3, { unit: 200, f: k, still: true });
    c.restore();
    c.fillStyle = 'rgba(30,50,50,0.7)'; c.fillRect(0, h * 0.9, w, 2);
  };
})();
