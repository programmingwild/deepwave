const puppeteer = require("puppeteer-core");

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 950, deviceScaleFactor: 1.5 });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 7000));

  await page.screenshot({ path: "screenshots/01-hero.png", fullPage: false });
  console.log("shot 01");

  // digital twin + fleet row
  const twin = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => /DIGITAL TWIN/.test(d.innerText) && d.innerText.length < 1200);
    el?.scrollIntoView({ block: "start" });
    return el ? el.getBoundingClientRect().top : -1;
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "screenshots/04-digital-twin.png", fullPage: false });
  console.log("shot 04 (digital twin + fleet)");

  // trigger pollution
  await page.evaluate(() => {
    const t = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("ACTIVATE POLLUTION"));
    if (t) t.click();
  });
  await new Promise((r) => setTimeout(r, 30000));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "screenshots/02-pollution.png", fullPage: false });
  console.log("shot 02 (during pollution)");

  // forecast panel during event
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => /WATER QUALITY TREND ANALYSIS \+ AI FORECAST/.test(d.innerText) && d.innerText.length < 1200);
    el?.scrollIntoView({ block: "start" });
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "screenshots/05-forecast-watch.png", fullPage: false });
  console.log("shot 05 (forecast watch)");

  await new Promise((r) => setTimeout(r, 120000));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "screenshots/03-recovery.png", fullPage: false });
  console.log("shot 03 (recovered)");

  await browser.close();
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});