const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "out");
const BASE = "/deepwave";
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain", ".webmanifest": "application/manifest+json",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === BASE) p += "/";
    if (p.startsWith(BASE + "/")) p = p.slice(BASE.length);
    else if (p !== "/") { res.writeHead(404); return res.end(); }
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(OUT, p.replace(/^\/+/, ""));
    if (!file.startsWith(OUT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(3200, () => console.log("serving out/ at http://127.0.0.1:3200/deepwave/"));
