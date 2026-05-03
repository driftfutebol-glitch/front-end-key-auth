const { json, envRequired } = require("./_lib/utils");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    json(res, 405, { success: false, message: "Use GET." });
    return;
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
    return;
  }

  json(res, 200, { success: true, message: "Configuracao completa." });
};
