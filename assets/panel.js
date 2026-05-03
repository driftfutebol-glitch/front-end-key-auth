(() => {
  const STORAGE_KEY = "license_panel_history_v1";

  const el = {
    generateForm: document.getElementById("generateForm"),
    validateForm: document.getElementById("validateForm"),
    generateStatus: document.getElementById("generateStatus"),
    validateStatus: document.getElementById("validateStatus"),
    configStatus: document.getElementById("configStatus"),
    historyBody: document.getElementById("historyBody"),
    buyer: document.getElementById("buyer"),
    durationDays: document.getElementById("durationDays"),
    level: document.getElementById("level"),
    mask: document.getElementById("mask"),
    charMode: document.getElementById("charMode"),
    licenseKey: document.getElementById("licenseKey"),
    hwid: document.getElementById("hwid"),
    copyLastKey: document.getElementById("copyLastKey"),
    clearHistory: document.getElementById("clearHistory")
  };

  function init() {
    wireForms();
    wireActions();
    renderHistory();
    loadConfigStatus();
  }

  function wireForms() {
    el.generateForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const buyer = String(el.buyer?.value || "").trim();
      const durationValue = String(el.durationDays?.value || "7").trim();
      const durationDays = parseDurationInput(durationValue);
      const level = Number(el.level?.value || 1);
      const mask = String(el.mask?.value || "").trim();
      const charMode = Number(el.charMode?.value || 1);

      if (!buyer) {
        setStatus(el.generateStatus, "Informe o nome do cliente.", "warn");
        return;
      }

      if (!Number.isFinite(durationDays) || durationDays <= 0) {
        setStatus(el.generateStatus, "Use 7, 10, 20, 30, 90, 365 ou lifetime.", "warn");
        return;
      }

      setStatus(el.generateStatus, "Gerando key...", "");

      try {
        const response = await fetch("/api/generate-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyer, durationDays, level, mask, charMode })
        });
        const json = await response.json();

        if (!response.ok || !json.success) {
          setStatus(el.generateStatus, json.message || "Falha ao gerar key.", "bad");
          return;
        }

        const key = json.key || (Array.isArray(json.keys) ? json.keys[0] : "");
        if (key) {
          const list = readHistory();
          list.unshift({
            createdAt: Date.now(),
            buyer,
            durationLabel: durationValue,
            durationDays,
            level,
            key
          });
          writeHistory(list);
          renderHistory();
          el.licenseKey.value = key;
        }

        setStatus(el.generateStatus, json.message || "Key gerada com sucesso.", "ok");
      } catch {
        setStatus(el.generateStatus, "Erro de rede na geracao.", "bad");
      }
    });

    el.validateForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const key = String(el.licenseKey?.value || "").trim();
      const hwid = String(el.hwid?.value || "").trim();

      if (!key) {
        setStatus(el.validateStatus, "Informe a key.", "warn");
        return;
      }

      setStatus(el.validateStatus, "Validando online...", "");
      try {
        const response = await fetch("/api/validate-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, hwid })
        });
        const json = await response.json();

        if (!response.ok || !json.success) {
          setStatus(el.validateStatus, json.message || "Key invalida.", "bad");
          return;
        }

        setStatus(el.validateStatus, json.message || "Key valida.", "ok");
      } catch {
        setStatus(el.validateStatus, "Erro de rede na validacao.", "bad");
      }
    });
  }

  function wireActions() {
    el.copyLastKey?.addEventListener("click", async () => {
      const list = readHistory();
      if (!list.length) {
        setStatus(el.generateStatus, "Nao ha key no historico.", "warn");
        return;
      }
      const latest = list[0].key;
      try {
        await navigator.clipboard.writeText(latest);
        setStatus(el.generateStatus, "Ultima key copiada.", "ok");
      } catch {
        setStatus(el.generateStatus, "Nao foi possivel copiar.", "bad");
      }
    });

    el.clearHistory?.addEventListener("click", () => {
      if (!window.confirm("Deseja limpar todo historico local?")) return;
      writeHistory([]);
      renderHistory();
      setStatus(el.generateStatus, "Historico limpo.", "warn");
    });
  }

  async function loadConfigStatus() {
    try {
      const response = await fetch("/api/config-status");
      const json = await response.json();
      if (!json.success) {
        setStatus(el.configStatus, json.message || "Deploy sem configuracao completa.", "bad");
        return;
      }
      setStatus(el.configStatus, "Configuracao de ambiente ok.", "ok");
    } catch {
      setStatus(el.configStatus, "Falha ao ler status de configuracao.", "bad");
    }
  }

  function renderHistory() {
    const list = readHistory();
    if (!list.length) {
      el.historyBody.innerHTML = "<tr><td colspan=\"5\">Nenhuma key gerada ainda.</td></tr>";
      return;
    }

    el.historyBody.innerHTML = list
      .slice(0, 100)
      .map((item) => {
        const date = new Date(item.createdAt).toLocaleString("pt-BR");
        return `
          <tr>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(item.buyer)}</td>
            <td>${escapeHtml(formatDurationLabel(item))}</td>
            <td>${escapeHtml(String(item.level))}</td>
            <td>${escapeHtml(item.key)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function parseDurationInput(value) {
    if (!value) return NaN;
    if (value.toLowerCase() === "lifetime" || value.toLowerCase() === "life") {
      return 36500;
    }

    return Number(value);
  }

  function formatDurationLabel(item) {
    if (item.durationLabel) {
      return item.durationLabel.toLowerCase() === "lifetime" ? "lifetime" : item.durationLabel + " dias";
    }

    return String(item.durationDays || "") + " dias";
  }

  function readHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHistory(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  function setStatus(target, text, tone) {
    if (!target) return;
    target.textContent = text;
    target.classList.remove("ok", "warn", "bad");
    if (tone) target.classList.add(tone);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
})();
