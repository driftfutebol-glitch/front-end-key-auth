const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function envRequired(keys) {
  const missing = keys.filter((key) => !process.env[key] || !String(process.env[key]).trim());
  return { ok: missing.length === 0, missing };
}

function toInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

function fallbackHwid(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const ip = (forwarded.split(",")[0] || req.socket.remoteAddress || "0.0.0.0").trim();
  const ua = String(req.headers["user-agent"] || "unknown-agent");
  return crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
}

async function postForm(url, fields) {
  const payload = new URLSearchParams(fields);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload
  });
  const raw = await response.text();
  return { response, raw };
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/config-status") {
    if (req.method !== "GET") {
      json(res, 405, { success: false, message: "Use GET." });
      return true;
    }

    const required = envRequired([
      "KEYAUTH_BRIDGE_URL",
      "KEYAUTH_API_URL",
      "KEYAUTH_OWNER_ID",
      "KEYAUTH_APP_NAME",
      "KEYAUTH_SELLER_KEY"
    ]);

    if (!required.ok) {
      json(res, 200, {
        success: false,
        message: `Faltam variaveis: ${required.missing.join(", ")}`
      });
      return true;
    }

    json(res, 200, { success: true, message: "Configuracao completa." });
    return true;
  }

  if (pathname === "/api/generate-key") {
    if (req.method !== "POST") {
      json(res, 405, { success: false, message: "Use POST." });
      return true;
    }

    const required = envRequired([
      "KEYAUTH_BRIDGE_URL",
      "KEYAUTH_OWNER_ID",
      "KEYAUTH_APP_NAME",
      "KEYAUTH_SELLER_KEY"
    ]);
    if (!required.ok) {
      json(res, 500, {
        success: false,
        message: `Missing envs: ${required.missing.join(", ")}`
      });
      return true;
    }

    const body = await readBody(req);
    const buyer = String(body.buyer || "").trim();
    if (!buyer) {
      json(res, 400, { success: false, message: "Cliente obrigatorio." });
      return true;
    }

    const durationDays = toInt(body.durationDays, 30, 1, 3650);
    const level = toInt(body.level, 1, 1, 1000);
    const charMode = toInt(body.charMode, 1, 1, 3);
    const mask = String(body.mask || "*****-*****-*****-*****-*****").trim().slice(0, 70);

    const form = {
      action: "generate",
      ownerid: process.env.KEYAUTH_OWNER_ID,
      name: process.env.KEYAUTH_APP_NAME,
      sellerkey: process.env.KEYAUTH_SELLER_KEY,
      amount: "1",
      mask,
      duration: String(durationDays),
      expiry: "86400",
      level: String(level),
      note: `cliente:${buyer}`,
      character: String(charMode)
    };

    try {
      const { response, raw } = await postForm(process.env.KEYAUTH_BRIDGE_URL, form);
      let backend;
      try {
        backend = JSON.parse(raw);
      } catch {
        json(res, 502, { success: false, message: "Resposta invalida do backend bridge." });
        return true;
      }

      if (!response.ok || !backend.success) {
        json(res, 400, {
          success: false,
          message: backend.message || "Falha na geracao."
        });
        return true;
      }

      const keys = Array.isArray(backend.keys) ? backend.keys : [];
      json(res, 200, {
        success: true,
        message: backend.message || "Key gerada.",
        keys,
        key: keys[0] || ""
      });
      return true;
    } catch {
      json(res, 502, { success: false, message: "Erro de conexao com backend bridge." });
      return true;
    }
  }

  if (pathname === "/api/validate-key") {
    if (req.method !== "POST") {
      json(res, 405, { success: false, message: "Use POST." });
      return true;
    }

    const required = envRequired(["KEYAUTH_API_URL", "KEYAUTH_OWNER_ID", "KEYAUTH_APP_NAME"]);
    if (!required.ok) {
      json(res, 500, {
        success: false,
        message: `Missing envs: ${required.missing.join(", ")}`
      });
      return true;
    }

    const body = await readBody(req);
    const key = String(body.key || "").trim();
    if (!key) {
      json(res, 400, { success: false, message: "Key obrigatoria." });
      return true;
    }

    const hwid = String(body.hwid || "").trim() || fallbackHwid(req);

    try {
      const initFields = {
        type: "init",
        name: process.env.KEYAUTH_APP_NAME,
        ownerid: process.env.KEYAUTH_OWNER_ID,
        ver: String(process.env.KEYAUTH_VERSION || "1.0"),
        enckey: randomToken(24)
      };

      if (process.env.KEYAUTH_HASH && String(process.env.KEYAUTH_HASH).trim()) {
        initFields.hash = String(process.env.KEYAUTH_HASH).trim();
      }

      const initResult = await postForm(process.env.KEYAUTH_API_URL, initFields);
      if (initResult.raw.trim() === "KeyAuth_Invalid") {
        json(res, 400, { success: false, message: "Aplicacao invalida no KeyAuth." });
        return true;
      }

      let initJson;
      try {
        initJson = JSON.parse(initResult.raw);
      } catch {
        json(res, 502, { success: false, message: "Resposta invalida no init." });
        return true;
      }

      if (!initJson.success || !initJson.sessionid) {
        json(res, 400, {
          success: false,
          message: initJson.message || "Init falhou."
        });
        return true;
      }

      const licenseFields = {
        type: "license",
        name: process.env.KEYAUTH_APP_NAME,
        ownerid: process.env.KEYAUTH_OWNER_ID,
        sessionid: initJson.sessionid,
        key,
        hwid
      };

      const validateResult = await postForm(process.env.KEYAUTH_API_URL, licenseFields);
      let validateJson;
      try {
        validateJson = JSON.parse(validateResult.raw);
      } catch {
        json(res, 502, { success: false, message: "Resposta invalida no license." });
        return true;
      }

      if (!validateJson.success) {
        json(res, 200, {
          success: false,
          message: validateJson.message || "Key invalida."
        });
        return true;
      }

      json(res, 200, {
        success: true,
        message: validateJson.message || "Key valida.",
        info: validateJson.info || null
      });
      return true;
    } catch {
      json(res, 502, { success: false, message: "Falha ao conectar na API KeyAuth." });
      return true;
    }
  }

  return false;
}

function randomToken(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function sanitizePathname(pathname) {
  const decoded = decodeURIComponent(pathname);
  const cleaned = decoded.replace(/\\/g, "/");
  if (cleaned.includes("..")) {
    return null;
  }
  return cleaned;
}

function resolveStaticFile(pathname) {
  if (pathname === "/") {
    return path.join(ROOT, "index.html");
  }
  if (pathname === "/panel" || pathname === "/panel/") {
    return path.join(ROOT, "panel", "index.html");
  }

  const safe = sanitizePathname(pathname);
  if (!safe) return null;
  const fullPath = path.join(ROOT, safe);
  return fullPath;
}

function sendStatic(res, filePath) {
  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Invalid path.");
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found.");
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const indexFile = path.join(filePath, "index.html");
    if (fs.existsSync(indexFile)) {
      sendStatic(res, indexFile);
      return;
    }
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Directory listing forbidden.");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { "Content-Type": mime });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, pathname);
      if (!handled) {
        json(res, 404, { success: false, message: "API route not found." });
      }
      return;
    }

    const filePath = resolveStaticFile(pathname);
    sendStatic(res, filePath);
  } catch {
    json(res, 500, { success: false, message: "Internal server error." });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://${HOST}:${PORT}`);
});
