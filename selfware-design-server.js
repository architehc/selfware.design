const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { createSessionManager } = require("./sandbox/session-manager");

const PORT = 80;
const ROOT = path.join(__dirname);
const SUBSCRIBERS_FILE = path.join(__dirname, "subscribers.json");
const ANALYTICS_FILE = path.join(__dirname, "analytics.log");
const BLOCKED_FILES = new Set(["subscribers.json", "analytics.log", "selfware-design-server.js", "trial-users.json"]);
const ANALYTICS_TOKEN = process.env.ANALYTICS_TOKEN || "sf-analytics-change-me";
const TRIAL_USERS_FILE = path.join(__dirname, "trial-users.json");
const TRIAL_SECRET = process.env.TRIAL_SECRET || crypto.randomBytes(32).toString("hex");
const TRIAL_RATE_LIMIT_EMAIL = 3;  // per email per day
const TRIAL_RATE_LIMIT_IP = 5;     // per IP per hour

// ─── Analytics ───
function logHit(req, status) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    method: req.method,
    url: req.url,
    status,
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: (req.headers["user-agent"] || "").slice(0, 200),
    ref: req.headers["referer"] || "",
  }) + "\n";
  fs.appendFile(ANALYTICS_FILE, line, () => {});
}

// ─── Custom 404 ───
const PAGE_404 = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 — selfware.design</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0c0f08;color:#e8e0d0;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}a{color:#D4A373;text-decoration:none;border-bottom:1px solid rgba(212,163,115,0.3)}a:hover{color:#e8e0d0}.c{max-width:440px}.fox{font-size:48px;margin-bottom:16px}.code{font-family:'DM Mono',monospace;font-size:64px;color:#D4A373;margin-bottom:8px;letter-spacing:-0.03em}.msg{font-family:'DM Mono',monospace;font-size:12px;color:#908878;letter-spacing:0.1em;margin-bottom:24px}p{font-size:17px;color:#a09880;line-height:1.7;font-style:italic;margin-bottom:24px}.hint{font-family:'DM Mono',monospace;font-size:11px;color:#666}</style></head><body><div class="c"><div class="fox">🥀</div><div class="code">404</div><div class="msg">FROST — NOT FOUND</div><p>This path doesn't lead anywhere.<br>Perhaps the code was refactored.</p><a href="/">← Back to selfware.design</a><p class="hint" style="margin-top:32px">Even dead ends teach the loop something.</p></div></body></html>`;


const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webp": "image/webp",
};

const COMPRESSIBLE = new Set([
  "text/html",
  "text/css",
  "application/javascript",
  "application/json",
  "image/svg+xml",
]);

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.github.com wss: ws:",
};

// ─── Analytics Dashboard ───
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderDashboardHTML(data) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Analytics — selfware.design</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0c0f08;color:#e8e0d0;font-family:'DM Mono',monospace;padding:32px;max-width:900px;margin:0 auto}
h1{color:#D4A373;font-size:18px;margin-bottom:24px;letter-spacing:0.1em;font-weight:400}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:28px}
.stat{background:rgba(212,163,115,0.06);border:1px solid rgba(212,163,115,0.12);border-radius:8px;padding:16px 24px;text-align:center}
.stat .n{font-size:28px;color:#D4A373;display:block;margin-bottom:4px}
.stat .l{font-size:10px;color:#908878;letter-spacing:0.08em}
h2{color:#606C38;font-size:13px;margin:28px 0 12px;letter-spacing:0.1em}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
th{text-align:left;color:#908878;border-bottom:1px solid rgba(212,163,115,0.1);padding:8px 12px;font-size:10px;letter-spacing:0.06em}
td{padding:6px 12px;border-bottom:1px solid rgba(212,163,115,0.04);color:#a09880}
td:last-child{text-align:right;color:#D4A373}
.bar{height:4px;background:#606C38;border-radius:2px;margin-top:2px}
</style></head><body>
<h1>selfware.design analytics</h1>
<div class="stats">
<div class="stat"><span class="n">${data.total}</span><span class="l">TOTAL HITS</span></div>
<div class="stat"><span class="n">${data.unique_ips}</span><span class="l">UNIQUE IPs</span></div>
<div class="stat"><span class="n">${data.by_day.length}</span><span class="l">DAYS TRACKED</span></div>
</div>
<h2>TOP PAGES</h2>
<table><thead><tr><th>PATH</th><th>HITS</th></tr></thead><tbody>
${data.pages.map(p => `<tr><td>${esc(p.path)}</td><td>${p.hits}</td></tr>`).join("")}
</tbody></table>
<h2>TOP REFERRERS</h2>
<table><thead><tr><th>REFERRER</th><th>HITS</th></tr></thead><tbody>
${data.referrers.length ? data.referrers.map(r => `<tr><td>${esc(r.referrer)}</td><td>${r.hits}</td></tr>`).join("") : "<tr><td colspan='2'>No referrers yet</td></tr>"}
</tbody></table>
<h2>HITS BY DAY</h2>
<table><thead><tr><th>DATE</th><th>HITS</th></tr></thead><tbody>
${data.by_day.map(d => {
    const max = Math.max(...data.by_day.map(x => x.hits));
    const pct = max > 0 ? (d.hits / max * 100) : 0;
    return `<tr><td>${d.date}</td><td>${d.hits}<div class="bar" style="width:${pct}%"></div></td></tr>`;
  }).join("")}
</tbody></table>
<h2>STATUS CODES</h2>
<table><thead><tr><th>STATUS</th><th>COUNT</th></tr></thead><tbody>
${Object.entries(data.statuses).sort((a, b) => a[0] - b[0]).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
</tbody></table>
<p style="margin-top:32px;color:#6e6e6e;font-size:10px">Generated ${new Date().toISOString()}</p>
</body></html>`;
}

const server = http.createServer((req, res) => {
  // Email subscription endpoint
  if (req.method === "POST" && req.url === "/api/subscribe") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024) { res.writeHead(413); res.end(); req.destroy(); }
    });
    req.on("end", () => {
      try {
        const { email } = JSON.parse(body);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid email" }));
        }
        let subs = [];
        try { subs = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf8")); } catch {}
        if (subs.some((s) => s.email === email)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: true, msg: "Already subscribed" }));
        }
        subs.push({ email, ts: new Date().toISOString(), ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress });
        fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2));
        console.log(`📧 New subscriber: ${email} (total: ${subs.length})`);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, msg: "Subscribed" }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bad request" }));
      }
    });
    return;
  }

  // Analytics dashboard endpoint
  if (req.method === "GET" && req.url.startsWith("/api/analytics")) {
    const params = new URL(req.url, "http://localhost").searchParams;
    if (params.get("token") !== ANALYTICS_TOKEN) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }

    let lines = [];
    try {
      const raw = fs.readFileSync(ANALYTICS_FILE, "utf8");
      lines = raw.trim().split("\n").filter(Boolean).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ total: 0, unique_ips: 0, pages: [], referrers: [], by_day: [], statuses: {} }));
    }

    const ips = new Set();
    const pages = {};
    const refs = {};
    const days = {};
    const statuses = {};

    for (const hit of lines) {
      ips.add(hit.ip);
      if (hit.status === 200) pages[hit.url] = (pages[hit.url] || 0) + 1;
      if (hit.ref) refs[hit.ref] = (refs[hit.ref] || 0) + 1;
      const day = hit.ts.slice(0, 10);
      days[day] = (days[day] || 0) + 1;
      statuses[hit.status] = (statuses[hit.status] || 0) + 1;
    }

    const sortDesc = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ path: k, hits: v }));

    const result = {
      total: lines.length,
      unique_ips: ips.size,
      statuses,
      pages: sortDesc(pages).slice(0, 20),
      referrers: Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => ({ referrer: k, hits: v })),
      by_day: Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ date: k, hits: v })),
    };

    if (params.get("format") === "html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS });
      return res.end(renderDashboardHTML(result));
    }

    res.writeHead(200, { "Content-Type": "application/json", ...SECURITY_HEADERS });
    return res.end(JSON.stringify(result, null, 2));
  }

  // ─── Trial: Start session ───
  if (req.method === "POST" && req.url === "/api/trial/start") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024) { res.writeHead(413); res.end(); req.destroy(); }
    });
    req.on("end", () => {
      try {
        const { email } = JSON.parse(body);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid email" }));
        }

        // Rate limiting
        let users = [];
        try { users = JSON.parse(fs.readFileSync(TRIAL_USERS_FILE, "utf8")); } catch {}
        const now = Date.now();
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const dayAgo = now - 24 * 60 * 60 * 1000;
        const hourAgo = now - 60 * 60 * 1000;

        const emailCount = users.filter(u => u.email === email && u.ts > dayAgo).length;
        if (emailCount >= TRIAL_RATE_LIMIT_EMAIL) {
          res.writeHead(429, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Rate limit: max 3 sessions per email per day" }));
        }

        const ipCount = users.filter(u => u.ip === ip && u.ts > hourAgo).length;
        if (ipCount >= TRIAL_RATE_LIMIT_IP) {
          res.writeHead(429, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Rate limit: too many sessions from this IP" }));
        }

        // Start session
        const result = sessionManager.startSession(email);

        // Log trial user
        users.push({ email, ip, ts: now });
        // Keep only last 7 days
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        users = users.filter(u => u.ts > weekAgo);
        fs.writeFile(TRIAL_USERS_FILE, JSON.stringify(users, null, 2), () => {});

        console.log(`[trial] New session for ${email} (queued: ${result.queued})`);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bad request" }));
      }
    });
    return;
  }

  // ─── Trial: Stats ───
  if (req.method === "GET" && req.url === "/api/trial/stats") {
    const stats = sessionManager.getStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(stats));
  }

  // Only allow GET/HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    return res.end("Method Not Allowed");
  }

  // Parse URL, strip query/hash
  let urlPath = decodeURIComponent(req.url.split("?")[0].split("#")[0]);

  // Prevent directory traversal
  if (urlPath.includes("..") || urlPath.includes("\0")) {
    logHit(req, 400);
    res.writeHead(400, { "Content-Type": "text/plain" });
    return res.end("Bad Request");
  }

  // Block sensitive files
  const basename = path.basename(urlPath);
  if (BLOCKED_FILES.has(basename)) {
    logHit(req, 404);
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(PAGE_404);
  }

  // Serve /try as the trial page
  if (urlPath === "/try") {
    const tryPath = path.join(ROOT, "selfware-design-try.html");
    if (fs.existsSync(tryPath)) {
      const tryStat = fs.statSync(tryPath);
      const tryHeaders = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, must-revalidate",
        "Last-Modified": tryStat.mtime.toUTCString(),
        ...SECURITY_HEADERS,
        // Relax COOP for /try — required for cross-origin CDN scripts (xterm.js)
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      };
      logHit(req, 200);
      const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
      if (acceptsGzip && tryStat.size > 1024) {
        tryHeaders["Content-Encoding"] = "gzip";
        tryHeaders["Vary"] = "Accept-Encoding";
        res.writeHead(200, tryHeaders);
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(tryPath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
      } else {
        tryHeaders["Content-Length"] = tryStat.size;
        res.writeHead(200, tryHeaders);
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(tryPath).pipe(res);
      }
      return;
    }
  }

  // Default to index.html (SPA-friendly)
  let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);

  // If path doesn't have extension and isn't a file, serve index.html (SPA routing)
  if (!path.extname(filePath)) {
    const tryIndex = filePath + "/index.html";
    if (fs.existsSync(tryIndex)) {
      filePath = tryIndex;
    } else if (!fs.existsSync(filePath)) {
      filePath = path.join(ROOT, "index.html");
    }
  }

  // Check file exists
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // If it has an extension (real file request), serve 404
    if (path.extname(urlPath)) {
      logHit(req, 404);
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(PAGE_404);
    }
    // Fallback to index.html for SPA
    filePath = path.join(ROOT, "index.html");
    if (!fs.existsSync(filePath)) {
      logHit(req, 404);
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(PAGE_404);
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  // Build headers
  const headers = {
    "Content-Type": contentType,
    "Last-Modified": stat.mtime.toUTCString(),
    ...SECURITY_HEADERS,
  };

  // Cache: HTML = no-cache (always fresh), assets = long cache
  if (ext === ".html") {
    headers["Cache-Control"] = "no-cache, must-revalidate";
  } else {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }

  // ETag
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  headers["ETag"] = etag;

  // 304 Not Modified
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  // Gzip compression for text types
  const baseType = contentType.split(";")[0].trim();
  const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");

  logHit(req, 200);

  if (acceptsGzip && COMPRESSIBLE.has(baseType) && stat.size > 1024) {
    headers["Content-Encoding"] = "gzip";
    headers["Vary"] = "Accept-Encoding";
    res.writeHead(200, headers);

    if (req.method === "HEAD") return res.end();

    const raw = fs.createReadStream(filePath);
    const gz = zlib.createGzip({ level: 6 });
    raw.pipe(gz).pipe(res);
    raw.on("error", () => { res.writeHead(500); res.end(); });
  } else {
    headers["Content-Length"] = stat.size;
    res.writeHead(200, headers);

    if (req.method === "HEAD") return res.end();

    fs.createReadStream(filePath).pipe(res);
  }
});

// ─── Session Manager ───
const sessionManager = createSessionManager(server);

// ─── WebSocket Upgrade ───
server.on("upgrade", (req, socket, head) => {
  const url = req.url.split("?")[0];
  if (url === "/ws/terminal") {
    sessionManager.handleUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const now = new Date().toISOString();
  console.log(`
  🦊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     selfware.design server
     Listening on 0.0.0.0:${PORT}
     Started: ${now}

     Features:
     ✓ Gzip compression
     ✓ ETag / 304 caching
     ✓ Security headers
     ✓ SPA fallback routing
     ✓ Email subscription API
     ✓ Analytics logging
     ✓ Custom 404 page
     ✓ Analytics dashboard (/api/analytics)
     ✓ Trial sandbox (/try)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n🥀 FROST — shutting down gracefully (${signal})`);
  await sessionManager.shutdown();
  server.close();
  process.exit(0);
}
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
