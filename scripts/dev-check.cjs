const puppeteer = require("puppeteer-core");

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) console.log("CONSOLE", m.type().toUpperCase(), ":", m.text().slice(0, 300));
  });
  page.on("requestfailed", (r) => console.log("REQFAIL:", r.url(), r.failure()?.errorText));

  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 8000));

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasSplash = bodyText.includes("TELEMETRY BUS STARTUP");
  const hasDash = bodyText.includes("AI POLLUTION EARLY WARNING ENGINE");
  console.log("SPLASH VISIBLE:", hasSplash);
  console.log("DASHBOARD VISIBLE:", hasDash);
  console.log("body preview:", bodyText.replace(/\n+/g, " | ").slice(0, 200));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});