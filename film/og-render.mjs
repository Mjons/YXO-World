import puppeteer from "puppeteer-core";
const [, , input, output] = process.argv;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto("file:///" + input.replace(/\\/g, "/"), {
  waitUntil: "networkidle0",
});
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: output, type: "jpeg", quality: 88 });
await browser.close();
