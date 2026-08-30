const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="16" fill="none" stroke="#22d3ee" stroke-width="2"/>
  <circle cx="20" cy="20" r="11" fill="none" stroke="#22d3ee" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>
  <circle cx="20" cy="20" r="4" fill="#22d3ee" opacity="0.95"/>
  <path d="M20 2 L22.5 8 L20 6 L17.5 8 Z" fill="#22d3ee"/>
</svg>`;

async function shoot(browser, size, scale, out) {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const s = 40 * scale;
  const off = (size - s) / 2;
  await page.setContent(
    `<!doctype html><body style="margin:0;background:#030812;overflow:hidden">
       <div style="position:absolute;left:${off}px;top:${off}px;width:${s}px;height:${s}px">${LOGO.replace("<svg ", `<svg width="${s}" height="${s}" `)}</div>
     </body>`
  );
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
  console.log("wrote", out);
  await page.close();
}

async function main() {
  const outDir = path.join(__dirname, "..", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  await shoot(browser, 192, 1.0, path.join(outDir, "icon-192.png"));
  await shoot(browser, 512, 1.0, path.join(outDir, "icon-512.png"));
  await shoot(browser, 512, 0.62, path.join(outDir, "icon-maskable-512.png"));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
