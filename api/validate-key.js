const {
  json,
  onlyPost,
  readBody,
  envRequired,
  createFallbackHwid
} = require("./_lib/utils");

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

module.exports = async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  const required = envRequired(["KEYAUTH_API_URL", "KEYAUTH_OWNER_ID", "KEYAUTH_APP_NAME"]);
  if (!required.ok) {
    json(res, 500, {
      success: false,
      message: `Missing envs: ${required.missing.join(", ")}`
    });
    return;
  }

  const body = await readBody(req);
  const key = String(body.key || "").trim();
  if (!key) {
    json(res, 400, { success: false, message: "Key obrigatoria." });
    return;
  }

  const hwidInput = String(body.hwid || "").trim();
  const hwid = hwidInput || createFallbackHwid(req);

  try {
    const initFields = {
      type: "init",
      name: process.env.KEYAUTH_APP_NAME,
      ownerid: process.env.KEYAUTH_OWNER_ID,
      ver: String(process.env.KEYAUTH_VERSION || "1.0"),
      enckey: cryptoRandomKey(24)
    };

    if (process.env.KEYAUTH_HASH && String(process.env.KEYAUTH_HASH).trim()) {
      initFields.hash = String(process.env.KEYAUTH_HASH).trim();
    }

    const initResult = await postForm(process.env.KEYAUTH_API_URL, initFields);
    if (initResult.raw.trim() === "KeyAuth_Invalid") {
      json(res, 400, { success: false, message: "Aplicacao invalida no KeyAuth." });
      return;
    }

    let initJson;
    try {
      initJson = JSON.parse(initResult.raw);
    } catch {
      json(res, 502, { success: false, message: "Resposta invalida no init." });
      return;
    }

    if (!initJson.success || !initJson.sessionid) {
      json(res, 400, {
        success: false,
        message: initJson.message || "Init falhou."
      });
      return;
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
      return;
    }

    if (!validateJson.success) {
      json(res, 200, {
        success: false,
        message: validateJson.message || "Key invalida."
      });
      return;
    }

    json(res, 200, {
      success: true,
      message: validateJson.message || "Key valida.",
      info: validateJson.info || null
    });
  } catch {
    json(res, 502, { success: false, message: "Falha ao conectar na API KeyAuth." });
  }
};

function cryptoRandomKey(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
