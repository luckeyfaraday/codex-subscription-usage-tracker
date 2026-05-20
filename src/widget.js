const state = {
  usage: [],
  selected: null,
  loading: false,
  updatedAt: null,
};

const els = {
  bestName: document.querySelector("#bestName"),
  refreshUsage: document.querySelector("#refreshUsage"),
  statusCard: document.querySelector("#statusCard"),
  statusDot: document.querySelector("#statusDot"),
  statusLabel: document.querySelector("#statusLabel"),
  primaryUsage: document.querySelector("#primaryUsage"),
  primaryMeter: document.querySelector("#primaryMeter"),
  weeklyUsage: document.querySelector("#weeklyUsage"),
  resetTime: document.querySelector("#resetTime"),
  planType: document.querySelector("#planType"),
  updatedAt: document.querySelector("#updatedAt"),
  accountCount: document.querySelector("#accountCount"),
  accountList: document.querySelector("#accountList"),
  copyLaunch: document.querySelector("#copyLaunch"),
  toast: document.querySelector("#toast"),
};

async function api(path) {
  const response = await fetch(path, { headers: { "content-type": "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

async function refreshUsage() {
  state.loading = true;
  els.refreshUsage.classList.add("is-loading");
  render();
  try {
    const { usage } = await api("/api/usage");
    state.usage = usage;
    state.selected = selectBestAccount(usage);
    state.updatedAt = new Date();
  } catch (error) {
    toast(error.message);
  } finally {
    state.loading = false;
    els.refreshUsage.classList.remove("is-loading");
    render();
  }
}

function selectBestAccount(accounts) {
  const live = accounts
    .filter((account) => account.status === "ok" && typeof getWindow(account, "primary").usedPercent === "number")
    .sort((a, b) => getWindow(a, "primary").usedPercent - getWindow(b, "primary").usedPercent);
  return live[0] || accounts[0] || null;
}

function render() {
  renderSelected();
  renderAccounts();
}

function renderSelected() {
  const account = state.selected;
  if (!account) {
    els.bestName.textContent = state.loading ? "Loading" : "No accounts";
    setStatus("warn", state.loading ? "Polling accounts" : "Add an account");
    els.primaryUsage.textContent = "--";
    els.primaryMeter.style.setProperty("--pct", "0%");
    els.primaryMeter.className = "";
    els.weeklyUsage.textContent = "--";
    els.resetTime.textContent = "--";
    els.planType.textContent = "--";
    els.updatedAt.textContent = "--";
    els.copyLaunch.disabled = true;
    return;
  }

  const primary = getWindow(account, "primary");
  const secondary = getWindow(account, "secondary");
  const pct = typeof primary.usedPercent === "number" ? primary.usedPercent : null;
  const tone = statusTone(account, pct);

  els.bestName.textContent = account.name || "Account";
  setStatus(tone, statusLabel(account));
  els.primaryUsage.textContent = pct === null ? "--" : `${Math.floor(pct)}%`;
  els.primaryMeter.style.setProperty("--pct", `${pct === null ? 0 : clampPct(pct)}%`);
  els.primaryMeter.className = tone === "danger" ? "is-danger" : tone === "warn" ? "is-warn" : "";
  els.weeklyUsage.textContent =
    typeof secondary.usedPercent === "number" ? `${Math.floor(secondary.usedPercent)}%` : "--";
  els.resetTime.textContent = primary.resetsAt ? formatDuration(primary.resetsAt * 1000 - Date.now()) : "--";
  els.planType.textContent = account.planType || (account.provider === "claude" ? "Claude" : "Codex");
  els.updatedAt.textContent = state.updatedAt ? formatRelative(state.updatedAt) : "--";
  els.copyLaunch.disabled = account.provider !== "codex" || !account.codexHome;
}

function renderAccounts() {
  els.accountCount.textContent = String(state.usage.length);
  els.accountList.replaceChildren();
  const sorted = state.usage.slice().sort((a, b) => usageScore(a) - usageScore(b));
  for (const account of sorted) {
    const primary = getWindow(account, "primary");
    const pct = typeof primary.usedPercent === "number" ? `${Math.floor(primary.usedPercent)}%` : "--";
    const row = document.createElement("button");
    row.type = "button";
    row.className = "account-row";
    row.innerHTML = `
      <strong>${escapeHtml(account.name || "Account")}</strong>
      <span>${escapeHtml(pct)}</span>
    `;
    row.addEventListener("click", () => {
      state.selected = account;
      render();
    });
    els.accountList.append(row);
  }
}

function setStatus(tone, label) {
  els.statusCard.className = `status-card is-${tone}`;
  els.statusDot.className = `dot is-${tone}`;
  els.statusLabel.textContent = label;
}

function getWindow(account, key) {
  return account.rateLimits?.[key] || {};
}

function usageScore(account) {
  if (account.status !== "ok") return Number.POSITIVE_INFINITY;
  const primary = getWindow(account, "primary");
  return typeof primary.usedPercent === "number" ? primary.usedPercent : Number.POSITIVE_INFINITY;
}

function statusTone(account, pct) {
  if (account.status !== "ok") return account.status === "metadata_only" ? "warn" : "danger";
  if (account.rateLimits?.limitReached === true || account.rateLimits?.allowed === false) return "danger";
  if (pct >= 85) return "danger";
  if (pct >= 60) return "warn";
  return "ok";
}

function statusLabel(account) {
  if (account.status === "ok") {
    if (account.rateLimits?.limitReached === true || account.rateLimits?.allowed === false) return "Limit reached";
    return account.email || "Live";
  }
  if (account.status === "metadata_only") return "Profile only";
  if (account.status === "wrong_account") return "Wrong account";
  if (account.status === "not_logged_in") return "Needs login";
  if (account.status === "missing_home") return "Home missing";
  if (account.status === "error") return "Error";
  return account.status || "Pending";
}

function clampPct(value) {
  return Math.max(0, Math.min(100, value));
}

function formatDuration(ms) {
  if (ms <= 0) return "now";
  const minutes = Math.ceil(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatRelative(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.className = "toast is-on";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    els.toast.className = "toast";
  }, 2400);
}

els.refreshUsage.addEventListener("click", refreshUsage);
els.copyLaunch.addEventListener("click", () => {
  if (!state.selected?.codexHome) return;
  const command = `CODEX_HOME=${shellQuote(state.selected.codexHome)} codex`;
  navigator.clipboard.writeText(command).then(
    () => toast("Launch command copied"),
    () => toast(command),
  );
});

await refreshUsage();
setInterval(refreshUsage, 60_000);
setInterval(render, 1_000);
