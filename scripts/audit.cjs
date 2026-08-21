const puppeteer = require("puppeteer-core");

async function audit(browser, width, height, label) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 7000));

  const res = await page.evaluate(() => {
    const out = {};
    out.viewportW = window.innerWidth;
    out.scrollW = document.documentElement.scrollWidth;
    out.hOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    out.bodyBg = getComputedStyle(document.body).backgroundColor;
    out.bodyColor = getComputedStyle(document.body).color;
    const panels = document.querySelectorAll("section");
    out.panels = panels.length;
    let zeroSize = 0;
    for (const p of panels) {
      const r = p.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) zeroSize++;
    }
    out.zeroSizePanels = zeroSize;
    const btns = document.querySelectorAll("button");
    out.buttons = btns.length;
    out.favicon = !!document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    const canvases = document.querySelectorAll("canvas");
    out.canvases = canvases.length;
    if (canvases.length) {
      const c = canvases[0];
      out.canvasDims = `${c.width}x${c.height}`;
      const ctx = c.getContext("2d");
      const d = ctx.getImageData(0, 0, 10, 10).data;
      out.canvasPixelsNonBlack = Array.from(d).some((v) => v > 0);
    }
    const charts = document.querySelectorAll(".recharts-wrapper");
    out.rechartsWrappers = charts.length;
    out.textOverflow = [...document.querySelectorAll("*")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 30;
    }).slice(0, 8).map((el) => el.tagName + "." + (el.className || "").toString().slice(0, 40));
    return out;
  });
  console.log(`[${label}] ${JSON.stringify(res)}`);
  await page.close();
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  await audit(browser, 1680, 950, "DESKTOP-1680");
  await audit(browser, 1280, 800, "LAPTOP-1280");
  await audit(browser, 768, 1024, "TABLET-768");
  await audit(browser, 390, 844, "MOBILE-390");
  await browser.close();
  console.log("AUDIT DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});