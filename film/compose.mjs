// Placeholder score for the YXO film. 75 BPM, 4/4, D major, 46.4 s.
// Arc: quiet pad intro → arpeggios that double in density → kick/bass build →
// peak → hard stop at 38.4 s (the hole) → final D chord at 40.0 s rings out.
// usage: node compose.mjs out.wav
import { writeFileSync } from "node:fs";

const SR = 44100;
const BEAT = 0.8,
  BAR = 3.2;
const DUR = 46.4;
const N = Math.floor(DUR * SR);
const dryL = new Float32Array(N),
  dryR = new Float32Array(N); // straight to master
const wetL = new Float32Array(N),
  wetR = new Float32Array(N); // through reverb

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const CHORDS = [
  [50, 54, 57, 62], // D
  [47, 50, 54, 59], // Bm
  [43, 47, 50, 55], // G
  [45, 49, 52, 57], // A
];
const ARPS = [
  [62, 66, 69, 74],
  [59, 62, 66, 71],
  [55, 59, 62, 67],
  [57, 61, 64, 69],
];
const HOLE = 38.4,
  FINAL = 40.0;

function add(bufL, bufR, i, v, pan) {
  if (i < 0 || i >= N) return;
  bufL[i] += v * (1 - pan);
  bufR[i] += v * (1 + pan);
}

// ── pad: additive saw, 6 partials, two detuned voices ──
function pad(t0, t1, notes, gain, att = 0.8, rel = 1.2) {
  const i0 = Math.floor(t0 * SR),
    i1 = Math.floor((t1 + rel) * SR);
  for (const [k, m] of notes.entries()) {
    const f = mtof(m),
      pan = (k / (notes.length - 1) - 0.5) * 0.6;
    for (const det of [-0.004, 0.004]) {
      const ph0 = rnd() * 6.28;
      for (let i = i0; i < i1 && i < N; i++) {
        const t = i / SR - t0;
        let env = Math.min(1, t / att);
        if (i / SR > t1) env *= Math.max(0, 1 - (i / SR - t1) / rel);
        if (env <= 0) continue;
        const w = 2 * Math.PI * f * (1 + det) * t + ph0;
        let s = 0;
        for (let h = 1; h <= 6; h++) s += Math.sin(w * h) / (h * h * 0.7 + 0.3);
        const v = s * env * gain * 0.12;
        add(wetL, wetR, i, v * 0.55, pan);
        add(dryL, dryR, i, v * 0.45, pan);
      }
    }
  }
}

// ── Karplus-Strong pluck ──
function pluck(t0, m, gain, pan = 0, decay = 0.994) {
  const f = mtof(m),
    L = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(L);
  for (let j = 0; j < L; j++) buf[j] = rnd() * 2 - 1;
  const i0 = Math.floor(t0 * SR),
    len = Math.floor(1.6 * SR);
  let p = 0,
    prev = 0;
  for (let k = 0; k < len; k++) {
    const cur = buf[p];
    const nxt = decay * 0.5 * (cur + buf[(p + 1) % L]);
    buf[p] = nxt;
    p = (p + 1) % L;
    const v = (cur * 0.7 + prev * 0.3) * gain;
    prev = cur;
    add(wetL, wetR, i0 + k, v * 0.5, pan);
    add(dryL, dryR, i0 + k, v * 0.5, pan);
  }
}

// ── FM bell ──
function bell(t0, m, gain, pan = 0, len = 3.2) {
  const f = mtof(m),
    i0 = Math.floor(t0 * SR),
    n = Math.floor(len * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const idx = 2.2 * Math.exp(-t * 3);
    const v =
      Math.sin(
        2 * Math.PI * f * t + idx * Math.sin(2 * Math.PI * f * 3.5 * t),
      ) *
      Math.exp(-t * 1.6) *
      Math.min(1, t * 400) *
      gain;
    add(wetL, wetR, i0 + k, v * 0.7, pan);
    add(dryL, dryR, i0 + k, v * 0.3, pan);
  }
}

function kick(t0, gain) {
  const i0 = Math.floor(t0 * SR),
    n = Math.floor(0.45 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 45 + 80 * Math.exp(-t * 30);
    ph += (2 * Math.PI * f) / SR;
    add(dryL, dryR, i0 + k, Math.sin(ph) * Math.exp(-t * 7) * gain, 0);
  }
}

function hat(t0, gain, pan = 0.25) {
  const i0 = Math.floor(t0 * SR),
    n = Math.floor(0.08 * SR);
  let prev = 0;
  for (let k = 0; k < n; k++) {
    const x = rnd() * 2 - 1,
      hp = x - prev;
    prev = x;
    add(wetL, wetR, i0 + k, hp * Math.exp((-k / SR) * 60) * gain * 0.3, pan);
    add(dryL, dryR, i0 + k, hp * Math.exp((-k / SR) * 60) * gain * 0.7, pan);
  }
}

function bass(t0, t1, m, gain) {
  const f = mtof(m),
    i0 = Math.floor(t0 * SR),
    i1 = Math.floor(t1 * SR);
  for (let i = i0; i < i1 && i < N; i++) {
    const t = i / SR - t0,
      left = t1 - i / SR;
    const env =
      Math.min(1, t / 0.01) *
      Math.min(1, left / 0.04) *
      (0.7 + 0.3 * Math.exp(-t * 4));
    const w = 2 * Math.PI * f * t;
    add(dryL, dryR, i, (Math.sin(w) + 0.25 * Math.sin(2 * w)) * env * gain, 0);
  }
}

function riser(t0, t1, gain) {
  const i0 = Math.floor(t0 * SR),
    i1 = Math.floor(t1 * SR);
  let lp = 0;
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / (i1 - i0);
    const a = 0.01 + 0.25 * u * u;
    lp += a * (rnd() * 2 - 1 - lp);
    const v = lp * u * u * gain;
    add(wetL, wetR, i, v * 0.5, Math.sin(u * 20) * 0.5);
    add(dryL, dryR, i, v * 0.5, 0);
  }
}

// ── arrangement ──
const bars = Math.round(HOLE / BAR); // 12 bars before the hole
for (let b = 0; b < bars; b++) {
  const t = b * BAR,
    c = b % 4;
  const lift = b < 2 ? 0.7 : b < 6 ? 0.85 : b < 10 ? 1 : 1.25;
  const end = Math.min(t + BAR, HOLE);
  pad(
    t,
    end - (b === bars - 1 ? 0 : 0),
    CHORDS[c],
    lift,
    0.9,
    b === bars - 1 ? 0.05 : 1.2,
  );

  // arpeggio density doubles: bar 2 quarters, 3 eighths, 4+ sixteenths
  if (b >= 2) {
    const per = b === 2 ? 4 : b === 3 ? 8 : 16;
    const step = BAR / per;
    const pat = [0, 1, 2, 3, 2, 1];
    for (let k = 0; k < per; k++) {
      const m =
        ARPS[c][pat[k % pat.length]] + (b >= 10 && k % 4 === 3 ? 12 : 0);
      const g = (b < 6 ? 0.22 : 0.26) * (k % 4 === 0 ? 1 : 0.7);
      pluck(t + k * step, m, g, k % 2 ? 0.35 : -0.35);
    }
  }
  if (b >= 4) {
    // sub bass: half notes, eighths from bar 8
    const root = CHORDS[c][0] - 12;
    const div = b >= 8 ? 8 : 2;
    for (let k = 0; k < div; k++) {
      const s = t + (k * BAR) / div;
      bass(s, Math.min(s + BAR / div - 0.02, HOLE), root, b >= 8 ? 0.24 : 0.2);
    }
  }
  if (b >= 6) {
    const kg = b < 8 ? 0.45 : 0.75;
    for (let k = 0; k < 4; k++) kick(t + k * BEAT, kg);
    for (let k = 0; k < 4; k++)
      hat(t + k * BEAT + BEAT / 2, b < 8 ? 0.18 : 0.28);
    if (b >= 10)
      for (let k = 0; k < 4; k++) hat(t + k * BEAT + BEAT / 4, 0.12, -0.3);
  }
  // bell melody
  const MEL = [
    [78, 74],
    [74, 71],
    [79, 74],
    [76, 73],
  ];
  const PEAK = { 10: [79, 83], 11: [81, 76] };
  if (b < 2) {
    if (b === 0) bell(t, 74, 0.16, -0.2, 4);
    else bell(t + BEAT * 2, 69, 0.13, 0.2, 4);
  } else if (b >= 6) {
    const mel = PEAK[b] || MEL[c];
    bell(t, mel[0], 0.17, -0.25);
    bell(t + BEAT * 2, mel[1], 0.15, 0.25);
  }
}
kick(0, 0.0); // keep length stable
riser(8 * BAR, HOLE, 0.5);

// ── reverb (Schroeder) on the wet bus ──
function reverb(inp, off) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => d + off);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let p = 0,
      lp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[p];
      lp = y * 0.6 + lp * 0.4;
      buf[p] = inp[i] + lp * 0.86;
      p = (p + 1) % d;
      out[i] += y / combs.length;
    }
  }
  for (const d of [225 + off, 556 + off, 341 + off]) {
    const buf = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[p],
        x = out[i];
      const y = -x * 0.5 + b;
      buf[p] = x + b * 0.5;
      out[i] = y;
      p = (p + 1) % d;
    }
  }
  return out;
}
const rvL = reverb(wetL, 0),
  rvR = reverb(wetR, 23);

// the hole: choke the reverb tail too, so it really drops out
function holeGate(t) {
  if (t < HOLE) return 1;
  if (t < FINAL) return Math.exp(-(t - HOLE) * 9);
  return 1;
}

// final chord at 40.0 s, written after the reverb so we can give it its own tail
const endL = new Float32Array(N),
  endR = new Float32Array(N);
{
  const saveDL = dryL.slice(),
    saveDR = dryR.slice();
  const saveWL = wetL.slice(),
    saveWR = wetR.slice();
  dryL.fill(0);
  dryR.fill(0);
  wetL.fill(0);
  wetR.fill(0);
  pad(FINAL, DUR, [50, 57, 62, 66, 69], 1.0, 1.4, 0.1);
  bell(FINAL, 74, 0.2, -0.2, 6.4);
  bell(FINAL + 0.4, 81, 0.13, 0.25, 6);
  bell(FINAL + 1.6, 78, 0.1, 0.1, 4.8);
  bass(FINAL, DUR, 38, 0.18);
  const tl = reverb(wetL, 0),
    tr = reverb(wetR, 23);
  for (let i = 0; i < N; i++) {
    endL[i] = dryL[i] + tl[i] * 0.9;
    endR[i] = dryR[i] + tr[i] * 0.9;
  }
  dryL.set(saveDL);
  dryR.set(saveDR);
  wetL.set(saveWL);
  wetR.set(saveWR);
}

// ── master ──
const outL = new Float32Array(N),
  outR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR,
    g = holeGate(t);
  let l = (dryL[i] + rvL[i] * 0.9) * g + endL[i];
  let r = (dryR[i] + rvR[i] * 0.9) * g + endR[i];
  const fade = Math.min(1, (DUR - t) / 2.6); // tail fades over the last 2.6 s
  l = Math.tanh(l * 1.2) * fade;
  r = Math.tanh(r * 1.2) * fade;
  outL[i] = l;
  outR[i] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const norm = 0.89 / peak;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(
    Math.round(Math.max(-1, Math.min(1, outL[i] * norm)) * 32767),
    i * 4,
  );
  data.writeInt16LE(
    Math.round(Math.max(-1, Math.min(1, outR[i] * norm)) * 32767),
    i * 4 + 2,
  );
}
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0);
hdr.writeUInt32LE(36 + data.length, 4);
hdr.write("WAVE", 8);
hdr.write("fmt ", 12);
hdr.writeUInt32LE(16, 16);
hdr.writeUInt16LE(1, 20);
hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28);
hdr.writeUInt16LE(4, 32);
hdr.writeUInt16LE(16, 34);
hdr.write("data", 36);
hdr.writeUInt32LE(data.length, 40);
writeFileSync(process.argv[2] || "score.wav", Buffer.concat([hdr, data]));
console.log(`wrote ${DUR}s, peak ${peak.toFixed(3)} → normalised`);
