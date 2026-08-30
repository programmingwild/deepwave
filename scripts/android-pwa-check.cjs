/* Simulates running the installed Android PWA: Pixel-class viewport, touch,
 * standalone display-mode check, joystick drag over CDP touch events,
 * service-worker registration + offline navigation. */
const puppeteer = require("puppeteer-core");

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--enable-features=TouchEvents"],
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto("http://127.0.0.1:3200/deepwave/", { waitUntil: "load", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 8000));

  // manifest + SW status
  const pwa = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    let manifestOk = false;
    try {
      const res = await fetch(link.getAttribute("href"));
      const json = await res.json();
      manifestOk = json.name.includes("DEEPWAVE") && json.display === "standalone";
    } catch {}
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      manifestOk,
      swControlled: !!navigator.serviceWorker.controller || !!(reg && reg.active),
      swScope: reg ? reg.scope : null,
    };
  });
  console.log("PWA:", JSON.stringify(pwa));

  // engage MANUAL then drag the joystick with real touch input
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "MANUAL");
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const pad = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.className?.toString().includes("touch-none"));
    el.scrollIntoView({ block: "center" });
    return true;
  });
  await new Promise((r) => setTimeout(r, 800));
  const padPos = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.className?.toString().includes("touch-none"));
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, size: r.width };
  });
  console.log("pad:", JSON.stringify(padPos));

  await page.touchscreen.touchStart(padPos.x - padPos.size * 0.35, padPos.y);
  await new Promise((r) => setTimeout(r, 120));
  await page.touchscreen.touchMove(padPos.x - padPos.size * 0.38, padPos.y);
  await new Promise((r) => setTimeout(r, 400));
  const during = await page.evaluate(() => document.body.innerText.match(/PORT \d+%|STBD \d+%|AHEAD \d+%|ASTERN \d+%/g)?.slice(0, 2).join(" / "));
  await page.touchscreen.touchEnd();
  await new Promise((r) => setTimeout(r, 400));
  const after = await page.evaluate(() => document.body.innerText.includes("STOP 0%") && document.body.innerText.includes("CENTER 0%"));
  console.log("joystick during:", during, "| released to stop/center:", after);

  // offline: go dark, reload navigation should still render from SW cache
  const client = await page.createCDPSession();
  await client.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await page.reload({ waitUntil: "load" }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));
  const offlineOk = await page.evaluate(() => document.body.innerText.includes("DEEPWAVE"));
  console.log("offline load renders:", offlineOk);

  console.log("JS ERRORS:", errors.length ? errors.join(" | ") : "NONE");
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
