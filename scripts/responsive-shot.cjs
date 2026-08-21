const puppeteer = require("puppeteer-core");

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1680, height: 950 },
];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1.5 });
    await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 6000));
    await page.screenshot({ path: `screenshots/responsive/${vp.name}-top.png` });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`${vp.name}: horizontal overflow = ${overflow}px`);

    // mid-page (digital twin area)
    await page.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find((d) => /DIGITAL TWIN/.test(d.innerText) && d.innerText.length < 1200);
      el?.scrollIntoView({ block: "start" });
    });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `screenshots/responsive/${vp.name}-twin.png` });
    await page.close();
  }
  await browser.close();
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
