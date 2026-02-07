(function () {
  'use strict';

  const pre = document.getElementById('butterfly');

  // Character palette: ascending visual weight for density gradient
  // Space → period → middle dot → colon → lowercase o → bullet → black circle
  const PALETTE = ' .\u00B7:o\u2022\u25CF';

  // Monospace cell aspect ratio (width / height at line-height: 1)
  const CELL_ASPECT = 0.55;

  // Wing geometry in world coordinates (origin at butterfly centre)
  // Each wing: ellipse centre, semi-axes, tilt angle, scallop count & depth
  const WINGS = [
    { cx:  7,   cy: -3,   rx: 10,  ry: 6.5, a: -0.3, sc: 5, sd: 0.07 }, // right upper
    { cx:  5.5, cy:  3.5, rx: 7.5, ry: 5,   a:  0.4, sc: 4, sd: 0.06 }, // right lower
    { cx: -7,   cy: -3,   rx: 10,  ry: 6.5, a:  0.3, sc: 5, sd: 0.07 }, // left upper
    { cx: -5.5, cy:  3.5, rx: 7.5, ry: 5,   a: -0.4, sc: 4, sd: 0.06 }, // left lower
  ];

  // --- Geometry ---

  function ellipseDist(px, py, cx, cy, rx, ry, angle, sc, sd) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = px - cx, dy = py - cy;
    const tx = c * dx + s * dy;
    const ty = -s * dx + c * dy;
    let d = (tx * tx) / (rx * rx) + (ty * ty) / (ry * ry);
    if (sc > 0) {
      const theta = Math.atan2(ty / ry, tx / rx);
      const scallop = 1 + sd * Math.sin(sc * theta);
      d /= scallop * scallop;
    }
    return d; // < 1 means inside
  }

  function wingDensity(wx, wy) {
    let max = 0;
    for (let i = 0; i < 4; i++) {
      const w = WINGS[i];
      const d = ellipseDist(wx, wy, w.cx, w.cy, w.rx, w.ry, w.a, w.sc, w.sd);
      if (d < 1) {
        const v = Math.pow(1 - d, 0.6);
        if (v > max) max = v;
      }
    }
    return max;
  }

  function bodyDensity(wx, wy) {
    // Thin vertical ellipse: rx=1, ry=6
    const d = wx * wx + (wy * wy) / 36;
    return d < 1 ? Math.pow(1 - d, 0.4) * 0.85 : 0;
  }

  function antennaDensity(wx, wy) {
    // Two club-tipped antennae curving up and outward from head
    let maxD = 0;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const ax = 0.5 + 2.5 * t * t;  // gentle outward curve
      const ay = -6 - 4.5 * t;        // upward from body top
      const th = 0.35 + 0.35 * t * t; // club: thicker at tip

      // Right antenna
      let dist = Math.hypot(wx - ax, wy - ay);
      if (dist < th) {
        const v = (th - dist) / th * 0.5;
        if (v > maxD) maxD = v;
      }
      // Left antenna (mirror)
      dist = Math.hypot(wx + ax, wy - ay);
      if (dist < th) {
        const v = (th - dist) / th * 0.5;
        if (v > maxD) maxD = v;
      }
    }
    return maxD;
  }

  // --- Grid sizing ---

  let cols, rows;

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fs = parseFloat(getComputedStyle(pre).fontSize);
    const cw = fs * 0.6;
    const ch = fs;
    cols = Math.min(85, Math.max(40, Math.floor(vw * 0.85 / cw)));
    rows = Math.min(42, Math.max(25, Math.floor(vh * 0.5 / ch)));
    if (cols % 2 === 0) cols++;
    if (rows % 2 === 0) rows++;
  }

  // --- Render loop ---

  function render(time) {
    const t = time * 0.001;
    const len = PALETTE.length;
    const hc = (cols - 1) / 2;
    const hr = (rows - 1) / 2;

    // Gentle vertical float
    const bob = 1.2 * Math.sin(t * 0.5);

    let out = '';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = (c - hc) * CELL_ASPECT;
        const wy = r - hr - bob;

        // Body and antennae: no animation transform (stable centre)
        let density = bodyDensity(wx, wy);
        const ad = antennaDensity(wx, wy);
        if (ad > density) density = ad;

        // Wings: 3D perspective undulation
        const side = wx >= 0 ? 1 : -1;
        const dist = Math.abs(wx);

        // Asymmetric timing: left and right wings slightly out of phase
        const freq = side > 0 ? 0.65 : 0.7;
        const phase = side > 0 ? 0 : 0.5;
        const rotBase = Math.sin(t * freq + phase);

        // Vertical wave ripples through the wing surface
        const vertWave = 0.15 * Math.sin(wy * 0.25 + t * 0.4);

        // Rotation increases from body to wingtip
        const rot = (0.55 + vertWave) * rotBase * Math.min(dist / 12, 1);

        const cosR = Math.cos(rot);
        if (Math.abs(cosR) > 0.05) {
          // Inverse perspective: find the original wing point at this display position
          const origWx = wx / cosR;
          let wd = wingDensity(origWx, wy);
          // Foreshortening: density proportional to surface facing the viewer
          wd *= Math.abs(cosR);
          if (wd > density) density = wd;
        }

        // Slow opacity breathing
        density *= 0.88 + 0.12 * Math.sin(t * 0.35 + dist * 0.08);

        // Deterministic texture variation (velvety micro-noise)
        const hash = ((c * 7 + r * 13 + 5) % 17) / 17;
        density = Math.max(0, Math.min(1, density + (hash - 0.5) * 0.1));

        out += PALETTE[Math.min(len - 1, Math.floor(density * len))];
      }
      if (r < rows - 1) out += '\n';
    }

    pre.textContent = out;
    requestAnimationFrame(render);
  }

  // --- Init ---

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(render);
})();
