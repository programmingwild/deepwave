const puppeteer = require("puppeteer-core");

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000));

  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.innerText.includes("ACTIVATE POLLUTION"))?.click();
  });
  console.log("pollution triggered, watching for AI systems...");

  for (let i = 0; i < 14; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const t = await page.evaluate(() => {
      const b = document.body.innerText;
      const panel = [...document.querySelectorAll("div")]
        .find((d) => /WATER QUALITY TREND ANALYSIS \+ AI FORECAST/.test(d.innerText));
      return {
        watch: /PRE-EMPTIVE WATCH/.test(b),
        replan: b.includes("REPLANNED") || b.includes("replanned"),
        panel: panel ? panel.innerText.replace(/\n+/g, " § ").slice(0, 1200) : "NO PANEL",
      };
    });
    console.log(`t+${(i + 1) * 5}s`, JSON.stringify(t));
    if (t.watch && t.replan && t.plume) break;
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });