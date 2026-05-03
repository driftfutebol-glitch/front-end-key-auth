const { json, onlyPost, readBody, toInt, envRequired } = require("./_lib/utils");

module.exports = async function handler(req, res) {
  if (!onlyPost(req, res)) return;

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
    return;
  }

  const body = await readBody(req);
  const buyer = String(body.buyer || "").trim();
  if (!buyer) {
    json(res, 400, { success: false, message: "Cliente obrigatorio." });
    return;
  }

  const durationDays = toInt(body.durationDays, 30, 1, 3650);
  const level = toInt(body.level, 1, 1, 1000);
  const charMode = toInt(body.charMode, 1, 1, 3);
  const mask = String(body.mask || "*****-*****-*****-*****-*****").trim().slice(0, 70);

  const form = new URLSearchParams({
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
  });

  try {
    const response = await fetch(process.env.KEYAUTH_BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });

    const raw = await response.text();
    let backend;
    try {
      backend = JSON.parse(raw);
    } catch {
      json(res, 502, { success: false, message: "Resposta invalida do backend bridge." });
      return;
    }

    if (!response.ok || !backend.success) {
      json(res, 400, {
        success: false,
        message: backend.message || "Falha na geracao."
      });
      return;
    }

    const keys = Array.isArray(backend.keys) ? backend.keys : [];
    json(res, 200, {
      success: true,
      message: backend.message || "Key gerada.",
      keys,
      key: keys[0] || ""
    });
  } catch {
    json(res, 502, { success: false, message: "Erro de conexao com backend bridge." });
  }
};
