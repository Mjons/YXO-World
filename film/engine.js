// YXO film engine. Every frame is a function of t; shots are cut on SCORE downbeats.
// Needs window.SCORE (score.js) and window.MARK (mark.js). Exposes window.FILM.
(function () {
  "use strict";
  const S = window.SCORE,
    M = window.MARK;
  const BAR = S.bar,
    BEAT = BAR / 4,
    OFF = S.offset || 0,
    DUR = S.dur;
  const SHOT = 2 * BAR;
  const N = M.n;
  const RW = 1920,
    RH = 1080; // reference frame; everything is laid out in these units

  const COL = {
    deep: "#0f1236",
    navy: "#1a1f4e",
    orange: "#f97316",
    purple: "#6366f1",
    purpleL: "#818cf8",
    cream: "#f8f7f4",
  };
  const CYAN = [41, 190, 245],
    LIME = [196, 247, 138];

  // ── helpers ────────────────────────────────────────────────────────────
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => {
    u = clamp(u);
    return u * u * (3 - 2 * u);
  };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
  const easeInOut = (u) => {
    u = clamp(u);
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  };
  function hash(i, s) {
    let x = Math.imul(i + 1, 374761393) ^ Math.imul(s + 7, 668265263);
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }
  const R1 = new Float32Array(N),
    R2 = new Float32Array(N),
    R3 = new Float32Array(N);
  const MX = new Float32Array(N),
    MY = new Float32Array(N),
    MG = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    R1[i] = hash(i, 1);
    R2[i] = hash(i, 2);
    R3[i] = hash(i, 3);
    MX[i] = M.p[i * 3] / 1000;
    MY[i] = M.p[i * 3 + 1] / 1000;
    MG[i] = M.p[i * 3 + 2] / 99;
  }

  // ── score energy ──────────────────────────────────────────────────────
  function energy(t) {
    const f = clamp(t * S.hz, 0, S.low.length - 1.001);
    const i = Math.floor(f),
      u = f - i;
    const lo = lerp(S.low[i], S.low[i + 1], u),
      hi = lerp(S.high[i], S.high[i + 1], u);
    const ph = (((t - OFF) % BEAT) + BEAT) % BEAT;
    return { lo, hi, kick: Math.exp(-ph * 7) * lo };
  }

  // ── shots ─────────────────────────────────────────────────────────────
  const SHOTS = [
    { key: "field", name: "The field" },
    { key: "closeup", name: "The close-up" },
    { key: "pullback", name: "The pull-back" },
    { key: "follow", name: "The follow-cam" },
    { key: "overhead", name: "The overhead" },
    { key: "spin", name: "The spin" },
    { key: "mark", name: "The mark" },
  ];
  SHOTS.forEach((s, k) => {
    s.t0 = k === 0 ? 0 : OFF + k * SHOT;
    s.t1 = k === SHOTS.length - 1 ? DUR : OFF + (k + 1) * SHOT;
  });
  const shotAt = (t) => {
    for (let k = SHOTS.length - 1; k >= 0; k--) if (t >= SHOTS[k].t0) return k;
    return 0;
  };

  // camera: world (x,y) → reference screen. (ox,oy) is where the camera centre lands.
  function project(cam, x, y, out, i) {
    const dx = x - cam.x,
      dy = y - cam.y,
      c = Math.cos(cam.r || 0),
      s = Math.sin(cam.r || 0);
    out.x[i] = cam.ox + (dx * c - dy * s) * cam.z;
    out.y[i] = cam.oy + (dx * s + dy * c) * cam.z;
  }
  const buf = () => ({
    x: new Float32Array(N),
    y: new Float32Array(N),
    g: new Float32Array(N),
  });

  // ── the doubling (shots 2–3): every particle really splits from its parent ──
  const T2 = SHOTS[1].t0;
  const GENS = Math.round(Math.log2(N)); // 12
  const TG = (g) => T2 + (g - 1) * BEAT; // doubling g lands on a beat, the first on the cut
  const MAG = (g) => 170 * Math.pow(0.78, g);
  const split = (d) => (d <= 0 ? 0 : 1 - Math.exp(-7 * d) * (1 + 7 * d));
  function doublings(t) {
    let n = 0;
    for (let g = 1; g <= GENS; g++) if (t >= TG(g)) n = g;
    return n;
  }
  const OX = [],
    OY = []; // split vectors per (generation, parent index)
  for (let g = 1; g <= GENS; g++) {
    const n = 1 << (g - 1),
      ox = new Float32Array(n),
      oy = new Float32Array(n);
    for (let q = 0; q < n; q++) {
      const a = hash(q, g * 7 + 1) * Math.PI * 2,
        m = MAG(g) * (0.7 + 0.6 * hash(q, g * 7 + 2));
      ox[q] = Math.cos(a) * m;
      oy[q] = Math.sin(a) * m;
    }
    OX.push(ox);
    OY.push(oy);
  }
  function dblPos(i, t) {
    let x = 0,
      y = 0;
    for (let g = 1; g <= GENS; g++) {
      const e = split(t - TG(g));
      if (e <= 0) break;
      const q = i & ((1 << (g - 1)) - 1),
        side = (i >> (g - 1)) & 1 ? 0.5 : -0.5;
      x += side * OX[g - 1][q] * e;
      y += side * OY[g - 1][q] * e;
    }
    const w = t - T2;
    x += 4 * Math.sin(w * 1.3 + R1[i] * 6.28);
    y += 4 * Math.cos(w * 1.1 + R2[i] * 6.28);
    return [x, y];
  }
  function dblRadius(t) {
    let r = 34;
    for (let g = 1; g <= GENS; g++) r += MAG(g) * 0.5 * split(t - TG(g));
    return r;
  }
  const dblZoom = (t) => Math.min(3, 250 / dblRadius(t));

  // growth curve: particle i sits at x = log2(i+1) (its birth), y = i+1 (the count)
  const CX = new Float32Array(N),
    CY = new Float32Array(N),
    CU = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.log2(i + 1) / GENS,
      v = (i + 1) / N;
    // thicken perpendicular to the curve; the steep end holds half the points, so it gets wider
    const slope = Math.atan2(-630 * v * Math.LN2 * GENS, 1240);
    const n = (R1[i] - 0.5) * (8 + 34 * v) + (R2[i] - 0.5) * 4;
    CU[i] = u;
    CX[i] = -620 + 1240 * u - Math.sin(slope) * n;
    CY[i] = 250 - 630 * v + Math.cos(slope) * n;
  }
  const curveEnd = { x: 620, y: -380 };

  // follow-cam flow: simulated once at load, then read back by time
  const FLOW_FPS = 30;
  let FLOW = null,
    FLOW_FRAMES = 0;
  function simulateFlow() {
    const dur = SHOTS[3].t1 - SHOTS[3].t0;
    FLOW_FRAMES = Math.ceil(dur * FLOW_FPS) + 1;
    FLOW = new Float32Array(FLOW_FRAMES * N * 2);
    const x = Float32Array.from(CX),
      y = Float32Array.from(CY);
    const W = [
      [0.011, 0.007, 0.6, 0.0, 9000],
      [-0.006, 0.013, -0.8, 1.7, 7000],
      [0.017, -0.012, 1.1, 3.1, 4200],
      [0.004, 0.019, 0.4, 4.4, 3600],
    ];
    const dt = 1 / FLOW_FPS;
    for (let f = 0; f < FLOW_FRAMES; f++) {
      const t = f * dt,
        ramp = smooth(t / 1.2);
      for (let i = 0; i < N; i++) {
        FLOW[(f * N + i) * 2] = x[i];
        FLOW[(f * N + i) * 2 + 1] = y[i];
        let vx = 0,
          vy = 0;
        for (const [kx, ky, w, p, a] of W) {
          const c = Math.cos(kx * x[i] + ky * y[i] + w * t + p) * a;
          vx += c * ky;
          vy -= c * kx;
        }
        // each particle has its own speed and heading, so neighbours on the curve fan out
        const drift = 150 * (0.65 + 0.7 * R3[i]);
        const spread = (R2[i] - 0.5) * 150 + (R1[i] - 0.5) * 60;
        x[i] +=
          (drift * smooth(t / 0.8) + vx * ramp * (0.6 + 0.8 * R1[i])) * dt;
        y[i] +=
          (vy * ramp * (0.6 + 0.8 * R2[i]) +
            spread * ramp -
            (y[i] + 60) * 0.12 * ramp) *
          dt;
      }
    }
  }
  function flowPos(i, lt) {
    const f = clamp(lt * FLOW_FPS, 0, FLOW_FRAMES - 1.001),
      a = Math.floor(f),
      u = f - a;
    const p = (a * N + i) * 2,
      q = p + N * 2;
    return [lerp(FLOW[p], FLOW[q], u), lerp(FLOW[p + 1], FLOW[q + 1], u)];
  }

  // city grid for the overhead
  const GRID = { cols: 10, rows: 6, px: 160, py: 120, gap: 26 };
  const NODES = [
    [2, 1],
    [7, 1],
    [4, 2],
    [8, 3],
    [1, 4],
    [6, 4],
    [3, 5],
  ].map(([c, r]) => [
    (c - GRID.cols / 2) * GRID.px,
    (r - GRID.rows / 2) * GRID.py,
  ]);
  function cityPos(i, lt) {
    const { cols, rows, px, py, gap } = GRID;
    if (R3[i] < 0.18) {
      // traffic along the streets
      const horiz = R1[i] < 0.5,
        span = horiz ? cols * px : rows * py;
      const line = Math.floor(hash(i, 40) * ((horiz ? rows : cols) + 1));
      const s =
        ((((R2[i] * span + (R1[i] < 0.25 ? 1 : -1) * 55 * lt) % span) + span) %
          span) -
        span / 2;
      return horiz ? [s, (line - rows / 2) * py] : [(line - cols / 2) * px, s];
    }
    const b = Math.floor(hash(i, 31) * cols * rows),
      c = b % cols,
      r = Math.floor(b / cols);
    const x0 = (c - cols / 2) * px + gap / 2,
      y0 = (r - rows / 2) * py + gap / 2;
    const w = px - gap,
      h = py - gap,
      p = hash(i, 32) * 2 * (w + h);
    let x, y;
    if (p < w) {
      x = x0 + p;
      y = y0;
    } else if (p < w + h) {
      x = x0 + w;
      y = y0 + p - w;
    } else if (p < 2 * w + h) {
      x = x0 + w - (p - w - h);
      y = y0 + h;
    } else {
      x = x0;
      y = y0 + h - (p - 2 * w - h);
    }
    return [x + (R1[i] - 0.5) * 3, y + (R2[i] - 0.5) * 3];
  }

  // log spiral, the O of the mark
  const SPI = { a: 22, b: 0.2, tmax: 4.6 * Math.PI };
  function spiralPos(i, lt) {
    const { a, b, tmax } = SPI;
    const th = Math.log(1 + R1[i] * (Math.exp(b * tmax) - 1)) / b;
    const r = a * Math.exp(b * th);
    const phi = -(0.35 * lt + 0.05 * lt * lt);
    const n = (R2[i] - 0.5) * r * 0.32 + (R3[i] - 0.5) * 3;
    const ang = th + phi;
    return [Math.cos(ang) * (r + n), Math.sin(ang) * (r + n), th / tmax];
  }

  // ── per-shot point fields: fill out.{x,y,g} in reference screen units ──
  // each returns { count, size, alpha } for the frame
  const FRAMES = {
    field(lt, out) {
      const cam = { x: 0, y: 0, z: 0.5 + 0.02 * lt, r: 0, ox: 1340, oy: 540 };
      const rot = lt * 0.05;
      for (let i = 0; i < N; i++) {
        const r = 11 * Math.sqrt(i + 1),
          a = i * 2.399963 + rot;
        const wave = Math.sin(r * 0.03 - lt * 2.2) * 5;
        project(
          cam,
          Math.cos(a) * (r + wave),
          Math.sin(a) * (r + wave),
          out,
          i,
        );
        out.g[i] = clamp(r / 720);
      }
      return { count: N, size: 3, alpha: 0.95 };
    },
    closeup(lt, out) {
      const t = SHOTS[1].t0 + lt;
      const cam = { x: 0, y: 0, z: dblZoom(t), r: 0, ox: 1200, oy: 470 };
      const n = doublings(t);
      for (let i = 0; i < N; i++) {
        const [x, y] = dblPos(i, t);
        project(cam, x, y, out, i);
        out.g[i] = (i === 0 ? 0 : Math.floor(Math.log2(i)) + 1) / GENS;
      }
      return {
        count: 1 << n,
        size: lerp(7, 2.6, n / GENS),
        alpha: lerp(1, 0.5, n / GENS),
      };
    },
    pullback(lt, out) {
      const t = SHOTS[2].t0 + lt;
      const k = smooth((lt - 2.2) / 2.2);
      const cam = {
        x: 0,
        y: lerp(0, -40, k),
        z: lerp(dblZoom(t), 1, k),
        r: lerp(-0.1, 0, k),
        ox: 960,
        oy: 470,
      };
      const n = doublings(t);
      for (let i = 0; i < N; i++) {
        let [x, y] = dblPos(i, t);
        const e = easeInOut((lt - 3.0 - CU[i] * 1.1) / 1.2);
        x = lerp(x, CX[i], e);
        y = lerp(y, CY[i], e);
        project(cam, x, y, out, i);
        out.g[i] = lerp(
          (i === 0 ? 0 : Math.floor(Math.log2(i)) + 1) / GENS,
          CU[i],
          e,
        );
      }
      return {
        count: 1 << n,
        size: 2.6,
        alpha: lerp(0.5, 0.2, smooth((lt - 3) / 2)),
      };
    },
    follow(lt, out) {
      const cam = {
        x: 150 * smooth(lt / 0.8) * Math.max(0, lt - 0.4),
        y: -40,
        z: 1,
        r: 0,
        ox: 960,
        oy: 470,
      };
      for (let i = 0; i < N; i++) {
        const [x, y] = flowPos(i, lt);
        project(cam, x, y, out, i);
        out.g[i] = CU[i];
      }
      // opens at the pull-back's exposure, then lifts as the curve dissolves
      return {
        count: N,
        size: 2.4,
        alpha: lerp(0.2, 0.36, smooth(lt / 1.5)),
        cam,
      };
    },
    overhead(lt, out) {
      const cam = {
        x: 0,
        y: 0,
        z: 0.86 + 0.035 * lt,
        r: -0.2 + 0.035 * lt,
        ox: 1120,
        oy: 470,
      };
      for (let i = 0; i < N; i++) {
        const [x, y] = cityPos(i, lt);
        project(cam, x, y, out, i);
        out.g[i] = 0.15 + 0.5 * MG[i];
      }
      return { count: N, size: 2.2, alpha: 0.42, cam };
    },
    spin(lt, out) {
      const cam = {
        x: 0,
        y: 0,
        z: 0.92 + 0.045 * lt,
        r: 0.04 * lt,
        ox: 1180,
        oy: 470,
      };
      for (let i = 0; i < N; i++) {
        const [x, y, g] = spiralPos(i, lt);
        project(cam, x, y, out, i);
        out.g[i] = 1 - g;
      }
      return { count: N, size: 2.4, alpha: 0.5 };
    },
    mark(lt, out) {
      // the hole: points hang where the spiral left them, then build the mark on the chord
      const s6 = SHOTS[5],
        chord = BAR / 2;
      FRAMES.spin(s6.t1 - s6.t0, out);
      const cx = 960,
        cy = 380,
        W = 280;
      const drift = 0.1 * easeOut(lt / chord);
      for (let i = 0; i < N; i++) {
        let x = lerp(out.x[i], cx, drift),
          y = lerp(out.y[i], cy, drift);
        const e = easeInOut(
          (lt - chord - (MX[i] + 1) * 0.16 - R1[i] * 0.1) / 0.7,
        );
        out.x[i] = lerp(x, cx + MX[i] * W, e);
        out.y[i] = lerp(y, cy + MY[i] * W, e);
        out.g[i] = lerp(out.g[i], MG[i], e);
      }
      return {
        count: N,
        size: 2.3,
        alpha: 0.55 * (1 - 0.8 * smooth((lt - chord - 1.1) / 0.9)),
      };
    },
  };
  // how long each shot blends in from where the previous one ended (0 = hard cut)
  const BLEND = {
    field: 0,
    closeup: 0.9,
    pullback: 0,
    follow: 0,
    overhead: 1.4,
    spin: 1.2,
    mark: 0,
  };

  // ── film instance ─────────────────────────────────────────────────────
  const NB = 16;
  const BUCKET_RGB = [];
  for (let b = 0; b < NB; b++) {
    const u = b / (NB - 1);
    BUCKET_RGB.push(
      CYAN.map((c, k) => Math.round(lerp(c, LIME[k], u))).join(","),
    );
  }

  function create(canvas, markImg) {
    const ctx = canvas.getContext("2d");
    const acc = document.createElement("canvas"),
      actx = acc.getContext("2d");
    const blm = document.createElement("canvas"),
      bctx = blm.getContext("2d");
    const P = buf(),
      Q = buf();
    const bucketOf = new Uint8Array(N),
      order = new Uint16Array(N),
      starts = new Uint32Array(NB + 1);
    let lastShot = -1,
      W = 0,
      H = 0,
      sc = 1;
    let GA = 1; // module-level group alpha every draw helper multiplies in

    function resize() {
      if (canvas.width !== W || canvas.height !== H || acc.width !== W) {
        W = canvas.width;
        H = canvas.height;
        sc = W / RW;
        acc.width = W;
        acc.height = H;
        blm.width = Math.max(1, Math.round(W / 6));
        blm.height = Math.max(1, Math.round(H / 6));
        clear();
      }
    }
    function clear() {
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.globalCompositeOperation = "source-over";
      actx.globalAlpha = 1;
      actx.fillStyle = COL.deep;
      actx.fillRect(0, 0, acc.width, acc.height);
    }

    function points(p, count, size, alpha, from = 0) {
      // bucket by colour, one path per bucket
      starts.fill(0);
      for (let i = from; i < count; i++) {
        const b = Math.min(NB - 1, Math.max(0, Math.round(p.g[i] * (NB - 1))));
        bucketOf[i] = b;
        starts[b + 1]++;
      }
      for (let b = 0; b < NB; b++) starts[b + 1] += starts[b];
      const fill = starts.slice();
      for (let i = from; i < count; i++) order[fill[bucketOf[i]]++] = i;
      const s0 = size * sc;
      actx.globalCompositeOperation = "lighter";
      for (let b = 0; b < NB; b++) {
        if (starts[b + 1] === starts[b]) continue;
        actx.beginPath();
        for (let k = starts[b]; k < starts[b + 1]; k++) {
          const i = order[k],
            s = s0 * (0.65 + 0.7 * R3[i]);
          actx.rect(p.x[i] * sc - s / 2, p.y[i] * sc - s / 2, s, s);
        }
        actx.fillStyle = `rgba(${BUCKET_RGB[b]},${clamp(alpha * GA)})`;
        actx.fill();
      }
      actx.globalCompositeOperation = "source-over";
    }

    function glow(x, y, r, rgb, a) {
      if (a * GA <= 0.002) return;
      const g = actx.createRadialGradient(
        x * sc,
        y * sc,
        0,
        x * sc,
        y * sc,
        r * sc,
      );
      g.addColorStop(0, `rgba(${rgb},${clamp(a * GA)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      actx.globalCompositeOperation = "lighter";
      actx.fillStyle = g;
      actx.fillRect((x - r) * sc, (y - r) * sc, 2 * r * sc, 2 * r * sc);
      actx.globalCompositeOperation = "source-over";
    }

    function text(str, x, y, font, color, a, align = "left", spacing = 0) {
      if (a * GA <= 0.002) return;
      ctx.globalAlpha = clamp(a * GA);
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "alphabetic";
      if ("letterSpacing" in ctx) ctx.letterSpacing = spacing + "px";
      ctx.fillText(str, x, y);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.globalAlpha = 1;
    }
    function wrap(str, font, maxW) {
      ctx.font = font;
      const words = str.split(" "),
        lines = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      if (line) lines.push(line);
      return lines;
    }
    // caption block, anchored to the lower-left: eyebrow, main line, optional sub
    function caption(lt, dur, c) {
      const a =
        smooth((lt - 0.3) / 0.7) * (1 - smooth((lt - (dur - 0.55)) / 0.45));
      const b =
        smooth((lt - 0.55) / 0.7) * (1 - smooth((lt - (dur - 0.55)) / 0.45));
      const mainFont = "700 54px Syne, 'DM Sans', sans-serif";
      const lines = wrap(c.line, mainFont, c.maxW || 1180);
      let y = 968 - (lines.length - 1) * 64 - (c.sub ? 50 : 0);
      if (c.eyebrow)
        text(
          c.eyebrow.toUpperCase(),
          120,
          y - 74,
          "600 22px 'DM Sans', sans-serif",
          COL.orange,
          a,
          "left",
          3.5,
        );
      const rise = (1 - easeOut((lt - 0.55) / 0.9)) * 14;
      lines.forEach((l, k) =>
        text(l, 120, y + k * 64 + rise, mainFont, "#ffffff", b),
      );
      if (c.sub)
        text(
          c.sub,
          120,
          y + (lines.length - 1) * 64 + 56 + rise,
          "400 27px 'DM Sans', sans-serif",
          "rgba(248,247,244,0.72)",
          b * smooth((lt - 1.1) / 0.7),
        );
    }

    // extras drawn into the accumulation layer (they get trails and bloom)
    function extrasAcc(k, lt, E, p, info) {
      const key = SHOTS[k].key;
      if (key === "field" || key === "closeup") {
        // the seed
        const t = SHOTS[k].t0 + lt;
        const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
        const n = key === "field" ? 0 : doublings(t);
        if (n <= 1)
          glow(
            key === "field" ? 1340 : p.x[0],
            key === "field" ? 540 : p.y[0],
            key === "field" ? 60 : 90,
            "196,247,138",
            (0.35 + 0.2 * pulse) * (key === "field" ? 1 : 1 - clamp(lt / BEAT)),
          );
      }
      if (key === "pullback") {
        // the arrowhead at the top of the growth curve: the mark's arrow
        const a = smooth((lt - 4.3) / 0.6);
        if (a > 0) {
          const cam = { x: 0, y: -40, z: 1, r: 0, ox: 960, oy: 470 };
          const o = { x: [0], y: [0] };
          project(cam, curveEnd.x, curveEnd.y, o, 0);
          const hx = o.x[0] * sc,
            hy = o.y[0] * sc,
            ang = Math.atan2(-1, 0.22),
            L = 46 * sc;
          actx.globalCompositeOperation = "lighter";
          actx.fillStyle = `rgba(196,247,138,${0.8 * a * GA})`;
          actx.beginPath();
          actx.moveTo(hx + Math.cos(ang) * L, hy + Math.sin(ang) * L);
          actx.lineTo(
            hx + Math.cos(ang + 2.5) * L * 0.75,
            hy + Math.sin(ang + 2.5) * L * 0.75,
          );
          actx.lineTo(
            hx + Math.cos(ang - 2.5) * L * 0.75,
            hy + Math.sin(ang - 2.5) * L * 0.75,
          );
          actx.closePath();
          actx.fill();
          actx.globalCompositeOperation = "source-over";
        }
      }
      if (key === "follow") {
        // network links between neighbours in the stream
        const a = smooth((lt - 0.6) / 1.2) * 0.16 * (0.6 + 0.8 * E.hi);
        actx.globalCompositeOperation = "lighter";
        actx.strokeStyle = `rgba(129,140,248,${a * GA})`;
        actx.lineWidth = Math.max(1, 1.1 * sc);
        actx.beginPath();
        for (let i = 1024; i < N - 1; i += 3) {
          const dx = p.x[i + 1] - p.x[i],
            dy = p.y[i + 1] - p.y[i],
            d = dx * dx + dy * dy;
          if (d < 110 * 110 && d > 16) {
            actx.moveTo(p.x[i] * sc, p.y[i] * sc);
            actx.lineTo(p.x[i + 1] * sc, p.y[i + 1] * sc);
          }
        }
        actx.stroke();
        actx.globalCompositeOperation = "source-over";
      }
      if (key === "overhead") {
        const cam = info.cam,
          o = { x: new Float32Array(1), y: new Float32Array(1) };
        const pts = NODES.map(([x, y]) => {
          project(cam, x, y, o, 0);
          return [o.x[0], o.y[0]];
        });
        // solutions: paths joining the problems, drawn along the streets
        const grow = clamp((lt - 2.6) / 3.0);
        if (grow > 0) {
          actx.globalCompositeOperation = "lighter";
          actx.strokeStyle = `rgba(196,247,138,${0.55 * GA})`;
          actx.lineWidth = 2.4 * sc;
          actx.lineCap = "round";
          actx.lineJoin = "round";
          actx.beginPath();
          const segs = NODES.length - 1,
            upto = grow * segs;
          for (let s = 0; s < segs && s < upto; s++) {
            const [ax, ay] = NODES[s],
              [bx, by] = NODES[s + 1],
              f = clamp(upto - s);
            // L-shaped route: along x, then y
            const lx = Math.abs(bx - ax),
              ly = Math.abs(by - ay),
              tot = lx + ly,
              d = f * tot;
            const w = [[ax, ay]];
            if (d <= lx) w.push([ax + Math.sign(bx - ax) * d, ay]);
            else {
              w.push([bx, ay]);
              w.push([bx, ay + Math.sign(by - ay) * (d - lx)]);
            }
            w.forEach(([x, y], j) => {
              project(cam, x, y, o, 0);
              j
                ? actx.lineTo(o.x[0] * sc, o.y[0] * sc)
                : actx.moveTo(o.x[0] * sc, o.y[0] * sc);
            });
          }
          actx.stroke();
          actx.globalCompositeOperation = "source-over";
        }
        // problems: orange nodes lighting up on the beat
        pts.forEach(([x, y], j) => {
          const on = lt - (0.3 + j * BEAT * 0.5);
          if (on < 0) return;
          const solved = clamp(grow * (NODES.length - 1) - (j - 1));
          const rgb = solved >= 1 && j > 0 ? "196,247,138" : "249,115,22";
          glow(x, y, 34 + 20 * Math.exp(-on * 3), rgb, 0.5 * smooth(on / 0.3));
          const ring = (on % (BEAT * 2)) / (BEAT * 2);
          actx.globalCompositeOperation = "lighter";
          actx.strokeStyle = `rgba(${rgb},${0.5 * (1 - ring) * GA})`;
          actx.lineWidth = 1.6 * sc;
          actx.beginPath();
          actx.arc(x * sc, y * sc, (8 + ring * 40) * sc, 0, Math.PI * 2);
          actx.stroke();
          actx.globalCompositeOperation = "source-over";
        });
      }
    }

    function counter(n, a) {
      if (a <= 0) return;
      text(
        n.toLocaleString("en-US"),
        1800,
        930,
        "800 84px Syne, sans-serif",
        "#ffffff",
        a,
        "right",
      );
      text(
        "×2 EVERY BEAT",
        1800,
        968,
        "600 20px 'DM Sans', sans-serif",
        COL.purpleL,
        a * 0.9,
        "right",
        3,
      );
    }

    // overlays on the main canvas, in reference units
    function overlay(k, lt, E) {
      const s = SHOTS[k],
        key = s.key,
        dur = s.t1 - s.t0,
        t = s.t0 + lt;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      if (key === "field") {
        const a = 1 - smooth((lt - (dur - 0.6)) / 0.5); // on screen from frame 0: this is the poster
        text(
          "FULL DAY WORKSHOP FOR AGES 13–17",
          120,
          250,
          "600 22px 'DM Sans', sans-serif",
          COL.purpleL,
          a,
          "left",
          3.5,
        );
        const f = "800 104px Syne, sans-serif";
        text("Unleash Young", 114, 372, f, "#ffffff", a);
        text("Extraordinary", 114, 484, f, COL.purpleL, a);
        text("Potential", 114, 596, f, COL.orange, a);
        const d = wrap(
          "A full-day workshop for young minds (ages 13–17) to explore exponential thinking, discover their purpose, and learn how to shape the future.",
          "400 28px 'DM Sans', sans-serif",
          660,
        );
        d.forEach((l, j) =>
          text(
            l,
            120,
            680 + j * 42,
            "400 28px 'DM Sans', sans-serif",
            "rgba(248,247,244,0.74)",
            a,
          ),
        );
      }
      if (key === "closeup") {
        caption(lt, dur, {
          eyebrow: "Exponential Thinking",
          line: "Understanding how to think 10x bigger",
        });
        counter(1 << doublings(t), smooth(lt / 0.3));
      }
      if (key === "pullback") {
        caption(lt, dur, {
          line: "…and leverage accelerating change instead of being disrupted by it",
        });
        counter(1 << doublings(t), 1 - smooth((lt - 2.6) / 0.6));
        // axes of the growth chart
        const a =
          smooth((lt - 3.2) / 0.8) *
          (1 - smooth((lt - (dur - 0.4)) / 0.4)) *
          0.3;
        if (a > 0) {
          ctx.globalAlpha = a * GA;
          ctx.strokeStyle = COL.cream;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          // curve spans world x -620..620, y 250..-380; camera puts (0,-40) at (960,470)
          ctx.moveTo(310, 130);
          ctx.lineTo(310, 775);
          ctx.lineTo(1610, 775);
          ctx.stroke();
          ctx.globalAlpha = 1;
          text(
            "1",
            292,
            766,
            "500 18px 'DM Sans', sans-serif",
            COL.cream,
            a * 2.2,
            "right",
          );
          text(
            "4,096",
            292,
            150,
            "500 18px 'DM Sans', sans-serif",
            COL.cream,
            a * 2.2,
            "right",
          );
          text(
            "12 DOUBLINGS",
            1610,
            805,
            "600 16px 'DM Sans', sans-serif",
            COL.cream,
            a * 2.2,
            "right",
            3,
          );
        }
      }
      if (key === "follow")
        caption(lt, dur, {
          eyebrow: "12:00 PM",
          line: "AI Is a Superpower You Can Master",
          sub: "Using technology as a tool for creation, not distraction.",
        });
      if (key === "overhead")
        caption(lt, dur, {
          eyebrow: "12:45 PM · Understanding World Problems",
          line: "Developing a problem-solving mindset in their own city and community.",
        });
      if (key === "spin")
        caption(lt, dur, {
          eyebrow: "3:30 PM · Extraordinary Life Workshop",
          line: "Explore personal strengths and discover a Massive Transformative Purpose.",
          maxW: 1320,
        });
      if (key === "mark") {
        const chord = BAR / 2;
        const ia = smooth((lt - chord - 1.0) / 0.9);
        if (markImg && ia > 0) {
          const w = 560,
            h = w * (markImg.height / markImg.width);
          ctx.globalAlpha = ia * GA;
          ctx.drawImage(markImg, 960 - w / 2, 380 - h / 2, w, h);
          ctx.globalAlpha = 1;
        }
        const r1 = smooth((lt - chord - 1.6) / 0.8),
          r2 = smooth((lt - chord - 2.2) / 0.8),
          r3 = smooth((lt - chord - 2.8) / 0.8);
        text(
          "Young Extraordinary Odyssey",
          960,
          668 + (1 - r1) * 12,
          "700 58px Syne, sans-serif",
          "#ffffff",
          r1,
          "center",
        );
        text(
          "yxo.world",
          960,
          740 + (1 - r2) * 10,
          "600 38px 'DM Sans', sans-serif",
          COL.orange,
          r2,
          "center",
          1,
        );
        text(
          "AUSTIN, TEXAS  ·  OCTOBER 24, 2026  ·  AGES 13–17",
          960,
          810,
          "600 20px 'DM Sans', sans-serif",
          "rgba(248,247,244,0.7)",
          r3,
          "center",
          3.5,
        );
        text(
          "Empowering the next generation of innovators",
          960,
          1000,
          "400 20px 'DM Sans', sans-serif",
          "rgba(248,247,244,0.45)",
          r3,
          "center",
        );
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // one frame. dt = seconds since the previous frame of a continuous run.
    function frame(t, dt) {
      resize();
      t = clamp(t, 0, DUR);
      const k = shotAt(t),
        s = SHOTS[k],
        lt = t - s.t0;
      if (k !== lastShot) {
        clear();
        lastShot = k;
      }
      const E = energy(t);
      GA = 1;

      // points: this shot, blended in from the previous shot's last frame
      const info = FRAMES[s.key](lt, P);
      let count = info.count,
        size = info.size,
        alpha = info.alpha;
      const bl = BLEND[s.key];
      let surplus = null;
      if (bl > 0 && lt < bl && k > 0) {
        const ps = SHOTS[k - 1],
          pinfo = FRAMES[ps.key](ps.t1 - ps.t0, Q);
        for (let i = 0; i < N; i++) {
          const e = easeInOut((lt - R1[i] * bl * 0.3) / (bl * 0.7));
          P.x[i] = lerp(Q.x[i], P.x[i], e);
          P.y[i] = lerp(Q.y[i], P.y[i], e);
          P.g[i] = lerp(Q.g[i], P.g[i], e);
        }
        const u = smooth(lt / bl);
        size = lerp(pinfo.size, size, u);
        alpha = lerp(pinfo.alpha, alpha, u);
        // points the new shot doesn't use yet fade out as they travel
        if (pinfo.count > count)
          surplus = [count, pinfo.count, Math.pow(1 - u, 1.5)];
      }

      // accumulation: dim instead of clear, frame-rate independent
      const keep = s.key === "closeup" || s.key === "pullback" ? 0.8 : 0.72;
      const fade = 1 - Math.pow(keep, clamp(dt, 0, 0.1) * 30);
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.globalAlpha = 1;
      actx.globalCompositeOperation = "source-over";
      actx.fillStyle = COL.deep;
      actx.globalAlpha = fade;
      actx.fillRect(0, 0, W, H);
      actx.globalAlpha = 1;

      const pulse = 1 + 0.35 * E.kick;
      const lum = 0.7 + 0.5 * E.lo;
      points(P, count, size * pulse, alpha * lum);
      if (surplus)
        points(
          P,
          surplus[1],
          size * pulse,
          info.alpha * 0.06 * lum * surplus[2],
          surplus[0],
        );
      extrasAcc(k, lt, E, P, info);

      // composite: accumulation + bloom + vignette
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(acc, 0, 0);
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.globalCompositeOperation = "source-over";
      bctx.drawImage(acc, 0, 0, blm.width, blm.height);
      ctx.globalCompositeOperation = "lighter";
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = clamp(0.22 + 0.55 * E.hi);
      ctx.drawImage(blm, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      const vg = ctx.createRadialGradient(
        W * 0.55,
        H * 0.45,
        H * 0.25,
        W * 0.5,
        H * 0.5,
        W * 0.75,
      );
      vg.addColorStop(0, "rgba(26,31,78,0)");
      vg.addColorStop(1, "rgba(6,8,28,0.72)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // cut flash on the downbeat, and a brighter one when the final chord lands
      let flash = k > 0 ? 0.08 * Math.exp(-lt * 6) : 0;
      if (s.key === "mark")
        flash =
          0.16 *
          Math.exp(-Math.max(0, lt - BAR / 2) * 4) *
          (lt >= BAR / 2 ? 1 : 0);
      if (flash > 0.002) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(160,220,255,${flash})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
      }

      overlay(k, lt, E);

      // final fade to navy
      const out = smooth((t - (DUR - 1.3)) / 1.2);
      if (out > 0) {
        ctx.fillStyle = `rgba(15,18,54,${out})`;
        ctx.fillRect(0, 0, W, H);
      }
      return k;
    }

    // paint any moment on its own: rebuild the trails with a short pre-roll
    function paint(t) {
      resize();
      const k = shotAt(clamp(t, 0, DUR));
      clear();
      lastShot = k;
      const start = Math.max(SHOTS[k].t0, t - 0.5);
      for (let u = start; u < t - 1e-4; u += 1 / 30) frame(u, 1 / 30);
      return frame(t, 1 / 30);
    }

    return {
      frame,
      paint,
      reset: () => {
        lastShot = -1;
      },
    };
  }

  simulateFlow();
  window.FILM = { DUR, BAR, BEAT, SHOTS, shotAt, create, energy };
})();
