const crypto = require("node:crypto");

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

function onlyPost(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { success: false, message: "Use POST." });
    return false;
  }
  return true;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

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

function toInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function envRequired(keys) {
  const missing = keys.filter((key) => !process.env[key] || !String(process.env[key]).trim());
  return {
    ok: missing.length === 0,
    missing
  };
}

function createFallbackHwid(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "0.0.0.0")
    .split(",")[0]
    .trim();
  const ua = String(req.headers["user-agent"] || "unknown-agent");
  const base = `${ip}|${ua}`;
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 32);
}

module.exports = {
  json,
  onlyPost,
  readBody,
  toInt,
  envRequired,
  createFallbackHwid
};
