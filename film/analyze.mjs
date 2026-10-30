// Find the best 46.4 s window in a track, cut it to score.mp3, bake score.js.
// usage: node analyze.mjs <track> [--start=SECONDS] [--bar=SECONDS] [--len=46.4]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(3).map((a) => a.replace(/^--/, "").split("=")),
);
const src = process.argv[2];
const LEN = +(args.len || 46.4);
const SR = 44100;

function decode(file) {
  const raw = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      file,
      "-ac",
      "1",
      "-ar",
      String(SR),
      "-f",
      "f32le",
      "-",
    ],
    { maxBuffer: 1 << 30 },
  );
  // copy into an aligned buffer; the child's Buffer may sit at an odd offset
  const ab = new ArrayBuffer(raw.length - (raw.length % 4));
  new Uint8Array(ab).set(raw.subarray(0, ab.byteLength));
  return new Float32Array(ab);
}

const rms = (x, a, b) => {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, b - a));
};

// ── 1 · per-second envelope of the whole track ──
const pcm = decode(src);
const secs = Math.floor(pcm.length / SR);
const perSec = [];
for (let s = 0; s < secs; s++) perSec.push(rms(pcm, s * SR, (s + 1) * SR));
const top = Math.max(...perSec);
console.log(`\n${src}  (${secs}s)\n`);
perSec.forEach((v, s) =>
  console.log(
    `${String(s).padStart(4)}s ${"█".repeat(Math.round((v / top) * 50))}`,
  ),
);

// ── 2 · score windows: quiet open, rising middle, hole near the end ──
function scoreWindow(t0) {
  const at = (a, b) => {
    const xs = perSec.slice(Math.floor(t0 + a), Math.ceil(t0 + b));
    return xs.reduce((p, c) => p + c, 0) / Math.max(1, xs.length);
  };
  const open = at(0, 5),
    mid = at(12, 30),
    peak = at(30, 38);
  let hole = Infinity;
  for (let s = Math.floor(t0 + 36); s < t0 + 42 && s < secs; s++)
    hole = Math.min(hole, perSec[s]);
  return mid - open + (peak - mid) * 0.5 + (peak - hole) * 1.5;
}
let start = args.start != null ? +args.start : 0;
if (args.start == null && secs > LEN) {
  const cands = [];
  for (let t = 0; t + LEN <= secs; t += 1) cands.push([t, scoreWindow(t)]);
  cands.sort((a, b) => b[1] - a[1]);
  console.log(
    "\nbest windows:",
    cands
      .slice(0, 3)
      .map(([t, s]) => `${t}s (${s.toFixed(3)})`)
      .join("  "),
  );
  start = cands[0][0];
}
console.log(`using window ${start}s – ${(start + LEN).toFixed(1)}s`);

// ── 3 · cut with fades ──
const out = join(here, "score.mp3");
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-ss",
  String(start),
  "-t",
  String(LEN),
  "-i",
  src,
  "-af",
  `afade=t=in:d=0.05,afade=t=out:st=${(LEN - 1.2).toFixed(2)}:d=1.2`,
  "-ac",
  "2",
  "-b:a",
  "160k",
  out,
]);

// ── 4 · two-band 20 Hz envelope of the cut ──
const cut = decode(out);
const HZ = 20;
const win = Math.floor(SR / HZ); // floor: SR/HZ can be fractional
const frames = Math.floor(cut.length / win);
const lowSig = new Float32Array(cut.length),
  highSig = new Float32Array(cut.length);
{
  const a = 1 - Math.exp((-2 * Math.PI * 180) / SR); // ~180 Hz split
  let lp = 0;
  for (let i = 0; i < cut.length; i++) {
    lp += a * (cut[i] - lp);
    lowSig[i] = lp;
    highSig[i] = cut[i] - lp;
  }
}
const low = [],
  high = [];
for (let f = 0; f < frames; f++) {
  low.push(rms(lowSig, f * win, (f + 1) * win));
  high.push(rms(highSig, f * win, (f + 1) * win));
}
const nrm = (xs) => {
  const m = Math.max(...xs) || 1;
  return xs.map((v) => Math.round((v / m) * 100) / 100);
};
const L = nrm(low),
  H = nrm(high);

// ── 5 · beat: autocorrelate the onset curve of the high band ──
const onset = H.map((v, i) => Math.max(0, v - (H[i - 1] ?? v)));
let best = [0, 0];
for (let lag = Math.round(0.4 * HZ); lag <= Math.round(1.2 * HZ); lag++) {
  let s = 0;
  for (let i = lag; i < onset.length; i++) s += onset[i] * onset[i - lag];
  if (s > best[1]) best = [lag, s];
}
const beat = best[0] / HZ;
const bar = args.bar ? +args.bar : Math.round(beat * 4 * 100) / 100;
let phase = [0, -1];
for (let p = 0; p < best[0]; p++) {
  let s = 0;
  for (let i = p; i < onset.length; i += best[0]) s += onset[i];
  if (s > phase[1]) phase = [p, s];
}
const offset = args.bar ? 0 : Math.round((phase[0] / HZ) * 100) / 100;
console.log(
  `beat ≈ ${beat.toFixed(2)}s → bar ${bar}s, first downbeat ≈ ${offset}s`,
);

// ASCII look at the cut, 2 frames per char
console.log("\ncut envelope (low ▄ / high ▀), one row per bar:");
const perBar = Math.round(bar * HZ);
for (let r = 0; r * perBar < frames; r++) {
  let line = "";
  for (let f = r * perBar; f < Math.min(frames, (r + 1) * perBar); f += 2) {
    const v = Math.max(L[f], H[f]);
    line += " ▁▂▃▄▅▆▇█"[Math.min(8, Math.round(v * 8))];
  }
  console.log(`${(r * bar).toFixed(1).padStart(5)}s ${line}`);
}

writeFileSync(
  join(here, "score.js"),
  `// generated by analyze.mjs from ${src.split(/[\\/]/).pop()} @ ${start}s\n` +
    `window.SCORE = ${JSON.stringify({ hz: HZ, dur: LEN, bar, offset, low: L, high: H })};\n`,
);
console.log(`\nwrote score.mp3 and score.js (${frames} frames)`);
