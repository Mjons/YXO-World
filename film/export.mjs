// Render the film to an MP4, frame by frame, with the score muxed in.
//   node export.mjs [--fps=30] [--w=1920] [--out=yxo-film.mp4]
// Needs: ffmpeg on PATH, Chrome (or set CHROME=path), and `npm i` in this folder.
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const FPS = +(args.fps || 30);
const W = +(args.w || 1920),
  H = Math.round((W * 9) / 16);
const OUT = join(here, args.out || "yxo-film.mp4");
const BATCH = 20;

const chrome = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!chrome) throw new Error("Chrome not found. Set CHROME=/path/to/chrome.");

// the artifact adds the doctype at publish time; do the same locally
const page = readFileSync(join(here, "index.html"), "utf8");
const preview = join(tmpdir(), "yxo-film-export.html");
writeFileSync(
  preview,
  `<!doctype html><html><head><meta charset="utf-8"><base href="${pathToFileURL(here + "/").href}"></head><body>${page}</body></html>`,
);

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--allow-file-access-from-files"],
});
const tab = await browser.newPage();
tab.on("pageerror", (e) => console.error("[page]", e.message));
await tab.goto(pathToFileURL(preview).href, { waitUntil: "load" });
await tab.waitForFunction("window.ready === true", { timeout: 30000 });

// a private film instance on its own full-size canvas
const dur = await tab.evaluate(
  async (w, h) => {
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.onerror = r;
      img.src = "mark.png";
    });
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    window.__exp = {
      c,
      film: window.FILM.create(c, img.naturalWidth ? img : null),
    };
    return window.FILM.DUR;
  },
  W,
  H,
);
const frames = Math.round(dur * FPS);
console.log(`rendering ${frames} frames at ${W}×${H}, ${FPS} fps → ${OUT}`);

const ff = spawn(
  "ffmpeg",
  [
    "-v",
    "error",
    "-y",
    "-f",
    "image2pipe",
    "-c:v",
    "mjpeg",
    "-framerate",
    String(FPS),
    "-i",
    "-",
    "-i",
    join(here, "score.mp3"),
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "17",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-shortest",
    OUT,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const ffDone = new Promise((res, rej) =>
  ff.on("close", (c) =>
    c === 0 ? res() : rej(new Error("ffmpeg exited " + c)),
  ),
);

const started = Date.now();
for (let f0 = 0; f0 < frames; f0 += BATCH) {
  const batch = await tab.evaluate(
    (f0, n, fps) => {
      const { c, film } = window.__exp,
        out = [];
      for (let f = f0; f < f0 + n; f++) {
        const t = f / fps;
        // frame 0 is painted with its pre-roll; after that, run continuously so trails are real
        if (f === 0) film.paint(t);
        else film.frame(t, 1 / fps);
        out.push(c.toDataURL("image/jpeg", 0.95).split(",")[1]);
      }
      return out;
    },
    f0,
    Math.min(BATCH, frames - f0),
    FPS,
  );
  for (const b64 of batch) {
    if (!ff.stdin.write(Buffer.from(b64, "base64")))
      await new Promise((r) => ff.stdin.once("drain", r));
  }
  const done = Math.min(frames, f0 + BATCH);
  process.stdout.write(
    `\r  ${done}/${frames} frames  (${((Date.now() - started) / 1000).toFixed(0)}s)`,
  );
}
ff.stdin.end();
await ffDone;
await browser.close();
console.log(`\nwrote ${OUT}`);
