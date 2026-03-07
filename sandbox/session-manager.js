const { spawn } = require("child_process");
const pty = require("node-pty");
const WebSocket = require("ws");
const crypto = require("crypto");

const DEFAULTS = {
  maxConcurrent: 10,
  inactivityTimeout: 3 * 60 * 1000,    // 3 min
  warningBefore: 60 * 1000,             // warn 60s before kill
  absoluteTimeout: 15 * 60 * 1000,      // 15 min max
  cleanupInterval: 30 * 1000,           // sweep every 30s
  containerImage: "localhost/selfware-trial:latest",
  memoryLimit: "20g",
  cpuLimit: "8",
  pidsLimit: "256",
  tmpfsWorkspace: "10737418240",        // 10GB
  tmpfsTmp: "134217728",               // 128MB
};

class Session {
  constructor(id, token, email) {
    this.id = id;
    this.token = token;
    this.email = email;
    this.containerId = null;
    this.ptyProcess = null;
    this.ws = null;
    this.state = "pending"; // pending | queued | starting | active | destroying | dead
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.warned = false;
  }
}

function createSessionManager(httpServer, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const sessions = new Map();   // token -> Session
  const queue = [];             // tokens waiting for a slot
  let shuttingDown = false;

  const wss = new WebSocket.Server({ noServer: true });

  // ─── WebSocket handling ──────────────────────────────────────
  wss.on("connection", (ws) => {
    let authenticated = false;
    let session = null;

    const killTimer = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, "Auth timeout");
      }
    }, 10000);

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (!authenticated) {
        if (msg.type === "auth" && msg.token) {
          clearTimeout(killTimer);
          session = sessions.get(msg.token);
          if (!session || session.state === "dead" || session.state === "destroying") {
            ws.send(JSON.stringify({ type: "terminated", reason: "Invalid or expired session" }));
            ws.close(4002, "Invalid session");
            return;
          }
          authenticated = true;
          session.ws = ws;

          if (session.state === "queued") {
            const pos = queue.indexOf(session.token) + 1;
            ws.send(JSON.stringify({ type: "queue", position: pos }));
          } else if (session.state === "active") {
            ws.send(JSON.stringify({ type: "ready" }));
          } else if (session.state === "pending") {
            provisionSession(session);
          }
        }
        return;
      }

      // Authenticated messages
      session.lastActivity = Date.now();

      if (msg.type === "input" && session.ptyProcess) {
        session.ptyProcess.write(msg.data);
      } else if (msg.type === "resize" && session.ptyProcess && msg.cols && msg.rows) {
        try { session.ptyProcess.resize(msg.cols, msg.rows); } catch {}
      }
    });

    ws.on("close", () => {
      clearTimeout(killTimer);
      if (session) {
        destroySession(session, "WebSocket closed");
      }
    });

    ws.on("error", () => {
      if (session) {
        destroySession(session, "WebSocket error");
      }
    });
  });

  // ─── Handle HTTP upgrade ─────────────────────────────────────
  function handleUpgrade(req, socket, head) {
    if (shuttingDown) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }

  // ─── Session provisioning ────────────────────────────────────
  function startSession(email) {
    const token = crypto.randomBytes(32).toString("hex");
    const id = crypto.randomBytes(8).toString("hex");
    const session = new Session(id, token, email);
    sessions.set(token, session);

    const activeCount = countActive();
    if (activeCount >= opts.maxConcurrent) {
      session.state = "queued";
      queue.push(token);
      return { token, queued: true, position: queue.length };
    }

    return { token, queued: false };
  }

  function countActive() {
    let n = 0;
    for (const s of sessions.values()) {
      if (s.state === "active" || s.state === "starting") n++;
    }
    return n;
  }

  async function provisionSession(session) {
    if (session.state === "dead" || session.state === "destroying") return;
    session.state = "starting";

    try {
      // Create container
      const containerId = await podmanRun(opts);
      session.containerId = containerId;

      // Copy sample project into workspace
      await podmanExec(containerId, "cp", "-r", "/home/trial/sample-project", "/workspace/sample-project");
      await podmanExec(containerId, "chown", "-R", "trial:trial", "/workspace");

      // Spawn PTY
      const ptyProc = pty.spawn("podman", ["exec", "-it", "-u", "trial", "-w", "/workspace", containerId, "/bin/bash", "--login"], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        env: { TERM: "xterm-256color" },
      });

      session.ptyProcess = ptyProc;
      session.state = "active";
      session.lastActivity = Date.now();

      ptyProc.onData((data) => {
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: "output", data }));
        }
      });

      ptyProc.onExit(() => {
        destroySession(session, "Process exited");
      });

      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ type: "ready" }));
      }

      console.log(`[trial] Session ${session.id} started (container: ${containerId.slice(0, 12)})`);
    } catch (err) {
      console.error(`[trial] Failed to provision session ${session.id}:`, err.message);
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ type: "terminated", reason: "Failed to start container" }));
        session.ws.close();
      }
      session.state = "dead";
      sessions.delete(session.token);
    }
  }

  // ─── Container lifecycle (podman) ────────────────────────────
  function podmanRun(opts) {
    return new Promise((resolve, reject) => {
      const args = [
        "run", "-d",
        "--memory", opts.memoryLimit,
        "--memory-swap", opts.memoryLimit,
        "--cpus", opts.cpuLimit,
        "--pids-limit", opts.pidsLimit,
        "--tmpfs", `/workspace:rw,size=${opts.tmpfsWorkspace}`,
        "--tmpfs", `/tmp:rw,size=${opts.tmpfsTmp}`,
        "--security-opt", "no-new-privileges",
        "--cap-drop", "ALL",
        "--cap-add", "CHOWN",
        "--cap-add", "DAC_OVERRIDE",
        "--cap-add", "FOWNER",
        "--cap-add", "SETGID",
        "--cap-add", "SETUID",
        "--label", "selfware-trial=true",
        "--name", `trial-${crypto.randomBytes(4).toString("hex")}`,
        opts.containerImage,
      ];

      const proc = spawn("podman", args);
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => stdout += d);
      proc.stderr.on("data", (d) => stderr += d);
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`podman run failed (${code}): ${stderr.trim()}`));
        }
      });
    });
  }

  function podmanExec(containerId, ...cmd) {
    return new Promise((resolve, reject) => {
      const proc = spawn("podman", ["exec", containerId, ...cmd]);
      let stderr = "";
      proc.stderr.on("data", (d) => stderr += d);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`podman exec failed (${code}): ${stderr.trim()}`));
      });
    });
  }

  function podmanRm(containerId) {
    return new Promise((resolve) => {
      const proc = spawn("podman", ["rm", "-f", "-t", "3", containerId]);
      proc.on("close", () => resolve());
    });
  }

  // ─── Session destruction ─────────────────────────────────────
  async function destroySession(session, reason) {
    if (session.state === "dead" || session.state === "destroying") return;
    session.state = "destroying";

    console.log(`[trial] Destroying session ${session.id}: ${reason}`);

    // Remove from queue if queued
    const qi = queue.indexOf(session.token);
    if (qi !== -1) queue.splice(qi, 1);

    // Kill PTY
    if (session.ptyProcess) {
      try { session.ptyProcess.kill(); } catch {}
      session.ptyProcess = null;
    }

    // Notify client
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      try {
        session.ws.send(JSON.stringify({ type: "terminated", reason }));
        session.ws.close();
      } catch {}
    }

    // Remove container
    if (session.containerId) {
      await podmanRm(session.containerId);
    }

    session.state = "dead";
    sessions.delete(session.token);

    // Promote next in queue
    drainQueue();
  }

  function drainQueue() {
    while (queue.length > 0 && countActive() < opts.maxConcurrent) {
      const token = queue.shift();
      const session = sessions.get(token);
      if (!session || session.state === "dead") continue;

      // Notify remaining queue members of updated positions
      for (let i = 0; i < queue.length; i++) {
        const qs = sessions.get(queue[i]);
        if (qs && qs.ws && qs.ws.readyState === WebSocket.OPEN) {
          qs.ws.send(JSON.stringify({ type: "queue", position: i + 1 }));
        }
      }

      provisionSession(session);
    }
  }

  // ─── Cleanup sweep ──────────────────────────────────────────
  const cleanupTimer = setInterval(() => {
    if (shuttingDown) return;
    const now = Date.now();

    for (const session of sessions.values()) {
      if (session.state !== "active") continue;

      const idle = now - session.lastActivity;
      const alive = now - session.createdAt;

      // Absolute timeout
      if (alive >= opts.absoluteTimeout) {
        destroySession(session, "Session time limit reached (15 min)");
        continue;
      }

      // Inactivity warning
      if (!session.warned && idle >= opts.inactivityTimeout - opts.warningBefore) {
        session.warned = true;
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({
            type: "warning",
            message: "Session will expire in 60 seconds due to inactivity",
          }));
        }
      }

      // Inactivity timeout
      if (idle >= opts.inactivityTimeout) {
        destroySession(session, "Inactivity timeout");
      }
    }

    // Orphaned container cleanup
    cleanOrphans();
  }, opts.cleanupInterval);

  function cleanOrphans() {
    const proc = spawn("podman", ["ps", "-q", "--no-trunc", "--filter", "label=selfware-trial=true"]);
    let stdout = "";
    proc.stdout.on("data", (d) => stdout += d);
    proc.on("close", () => {
      if (!stdout.trim()) return;
      const running = stdout.trim().split("\n");
      const tracked = new Set();
      for (const s of sessions.values()) {
        if (s.containerId) tracked.add(s.containerId);
      }
      for (const cid of running) {
        if (!tracked.has(cid)) {
          console.log(`[trial] Removing orphaned container: ${cid.slice(0, 12)}`);
          spawn("podman", ["rm", "-f", "-t", "3", cid]);
        }
      }
    });
  }

  // ─── Stats ──────────────────────────────────────────────────
  function getStats() {
    let active = 0, starting = 0;
    for (const s of sessions.values()) {
      if (s.state === "active") active++;
      if (s.state === "starting") starting++;
    }
    return {
      active: active + starting,
      queued: queue.length,
      maxConcurrent: opts.maxConcurrent,
    };
  }

  // ─── Graceful shutdown ──────────────────────────────────────
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(cleanupTimer);

    console.log("[trial] Shutting down — destroying all sessions...");

    const promises = [];
    for (const session of sessions.values()) {
      promises.push(destroySession(session, "Server shutting down"));
    }
    await Promise.all(promises);

    // Belt & suspenders: kill any remaining trial containers
    return new Promise((resolve) => {
      const proc = spawn("podman", ["ps", "-q", "--filter", "label=selfware-trial=true"]);
      let stdout = "";
      proc.stdout.on("data", (d) => stdout += d);
      proc.on("close", () => {
        const ids = stdout.trim().split("\n").filter(Boolean);
        if (ids.length === 0) return resolve();
        const rm = spawn("podman", ["rm", "-f", ...ids]);
        rm.on("close", () => resolve());
      });
    });
  }

  return {
    handleUpgrade,
    startSession,
    getStats,
    shutdown,
  };
}

module.exports = { createSessionManager };
