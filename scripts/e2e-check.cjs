const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const path = require("path");

const PORT = process.env.E2E_PORT || "3100";
const BASE = `http://127.0.0.1:${PORT}`;

function startServer() {
  const proc = spawn(
    process.execPath,
    [path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next"), "start", "-p", PORT],
    { cwd: path.join(__dirname, ".."), stdio: "ignore" },
  );
  return proc;
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

async function main() {
  const server = startServer();
  await waitForServer(BASE);
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("CONSOLE: " + msg.text());
  });

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 6000));

  const checks = [
    "AI POLLUTION EARLY WARNING ENGINE",
    "EDGE AI",
    "LIVE UNDERWATER SURVEILLANCE",
    "ROVER TELEMETRY",
    "SENSOR DIAGNOSTICS",
    "MISSION ENERGY",
    "SIMULATION MODE",
    "PROTOTYPE ENVIRONMENTAL HEALTH SCORE",
    "ENVIRONMENTAL HEALTH",
    "DEEPWAVE",
    "SIMULATION / CAMERA FEED",
    "AUTONOMOUS RESPONSE",
    "MISSION MAP",
    "WATER QUALITY TREND ANALYSIS",
    "ALERT CENTER",
    "SYSTEM ARCHITECTURE",
    "MANUAL CONTROL — JOYSTICK",
    "DIGITAL TWIN",
    "FLEET — MULTI-ROV FORMATION",
    "WATER QUALITY TREND ANALYSIS + AI FORECAST",
  ];
  for (const c of checks) {
    const found = await page.evaluate((txt) => document.body.innerText.includes(txt), c);
    console.log((found ? "FOUND   " : "MISSING ") + c);
  }

  const health = await page.evaluate(() => {
    const b = document.body.innerText;
    return {
      hasRec: b.includes("REC"),
      hasBar: b.includes("BATTERY") || b.includes("ENERGY"),
      scoreLine: b.split("\n").find((l) => l.includes("/ 100")) || null,
    };
  });
  console.log("health score line:", health.scoreLine);

  // click the simulation trigger and watch the dashboard react
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((b) => b.innerText.includes("ACTIVATE POLLUTION"));
    if (t) {
      t.click();
      return true;
    }
    return false;
  });
  console.log("simulation button clicked:", clicked);
  await new Promise((r) => setTimeout(r, 18000));
  const post = await page.evaluate(() => {
    const b = document.body.innerText;
    return {
      alert: b.includes("POTENTIAL POLLUTION EVENT"),
      prob: (b.match(/\d+%/) || [])[0],
      state: b.split("\n").find((l) => /^ALERT$|^ANOMALY$|^NORMAL$/.test(l.trim())) || null,
    };
  });
  console.log("after simulation:", JSON.stringify(post));

  // joystick: engage manual, drag pad, verify throttle readout reacts
  const joy = await (async () => {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const m = btns.find((b) => b.innerText.trim() === "MANUAL");
      if (m) m.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const pad = await page.$('[style*="cursor: crosshair"]');
    if (!pad) return { pad: false };
    await pad.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await new Promise((r) => setTimeout(r, 600));
    const box = await pad.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + box.width * 0.3, cy - box.height * 0.4, { steps: 6 });
    await new Promise((r) => setTimeout(r, 900));
    const during = await page.evaluate(() => {
      const b = document.body.innerText;
      const read = (label) => {
        const d = [...document.querySelectorAll("div")].find((x) => x.textContent.trim() === label);
        return d?.parentElement?.lastElementChild?.textContent?.trim() || null;
      };
      return {
        throttle: read("THROTTLE"),
        steer: read("STEERING"),
        manual: /manual piloting/i.test(b),
      };
    });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 900));
    const after = await page.evaluate(() => {
      const b = document.body.innerText;
      return { stop: /STOP 0%/.test(b), center: /CENTER 0%/.test(b) };
    });
    return { pad: true, during, after };
  })();
  console.log("joystick:", JSON.stringify(joy));

  // fleet: switch ROV, change formation, verify focus follows
  const fleet = await (async () => {
    const res = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const dw02 = btns.find((b) => b.innerText.includes("DW-02"));
      if (dw02) dw02.click();
      return true;
    });
    await new Promise((r) => setTimeout(r, 900));
    const body = await page.evaluate(() => document.body.innerText);
    return {
      clicked: res,
      focusDW02: body.includes("CONTROL VESSEL") && /DW-02[\s\S]{0,200}CONTROL VESSEL/.test(body),
      fleetInBar: body.includes("3 UNITS"),
    };
  })();
  console.log("fleet:", JSON.stringify(fleet));

  // vision: toggle AI vision and confirm detector text appears
  const vision = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const v = btns.find((b) => b.innerText.includes("AI VISION"));
    if (v) v.click();
    return !!v;
  });
  await new Promise((r) => setTimeout(r, 1200));
  const visionBody = await page.evaluate(() => document.body.innerText);
  console.log("vision:", JSON.stringify({ toggled: vision, on: visionBody.includes("AI VISION ON"), count: /AI DETECTOR: \d+/.test(visionBody) }));

  console.log("JS ERRORS:", errors.length ? errors.join("\n") : "NONE");
  await browser.close();
  server.kill();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});