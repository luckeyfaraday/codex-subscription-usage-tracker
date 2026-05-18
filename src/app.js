const state = {
  accounts: [],
  usage: [],
  selectedId: null,
  loading: false,
};

const els = {
  accountCount: document.querySelector("#accountCount"),
  bestAvailability: document.querySelector("#bestAvailability"),
  bestUsageDetail: document.querySelector("#bestUsageDetail"),
  nextReset: document.querySelector("#nextReset"),
  nextResetDetail: document.querySelector("#nextResetDetail"),
  refreshState: document.querySelector("#refreshState"),
  accountList: document.querySelector("#accountList"),
  sidebarSummary: document.querySelector("#sidebarSummary"),
  detailPanel: document.querySelector("#detailPanel"),
  refreshUsage: document.querySelector("#refreshUsage"),
  openAddDialog: document.querySelector("#openAddDialog"),
  dialog: document.querySelector("#accountDialog"),
  form: document.querySelector("#accountForm"),
  closeDialog: document.querySelector("#closeDialog"),
  cancelDialog: document.querySelector("#cancelDialog"),
  accountName: document.querySelector("#accountName"),
  codexHome: document.querySelector("#codexHome"),
  expectedEmail: document.querySelector("#expectedEmail"),
};

const icons = {
  "arrow-up-right": '<svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  code: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m9 9-3 3 3 3"/><path d="m15 9 3 3-3 3"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M10 2v6L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19L14 8V2"/><path d="M8 2h8"/><path d="M7 16h10"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  info: '<svg viewBox="0 0 24 24"><path d="M12 16v-4"/><path d="M12 8h.01"/><circle cx="12" cy="12" r="10"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M12 5h.01"/><path d="M12 12h.01"/><path d="M12 19h.01"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.2 6.5"/><path d="M3 12A9 9 0 0 1 18.2 5.5"/><path d="M18 2v4h-4"/><path d="M6 22v-4h4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

function hydrateStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.getAttribute("data-icon");
    if (icons[name]) node.innerHTML = icons[name];
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

async function loadAccounts() {
  const { accounts } = await api("/api/accounts");
  state.accounts = accounts;
  if (!state.selectedId && accounts.length) state.selectedId = accounts[0].id;
  render();
}

async function refreshUsage() {
  state.loading = true;
  render();
  try {
    const { usage } = await api("/api/usage");
    state.usage = usage;
    if (!state.selectedId && usage.length) state.selectedId = usage[0].id;
  } catch (error) {
    state.usage = state.accounts.map((account) => ({
      ...account,
      status: "error",
      error: error.message,
    }));
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const merged = getMergedAccounts();
  renderSummary(merged);
  renderList(merged);
  renderDetail(merged);
  els.refreshState.textContent = state.loading ? "Refreshing..." : "Idle";
}

function getMergedAccounts() {
  return state.accounts.map((account) => {
    const live = state.usage.find((item) => item.id === account.id);
    return live || account;
  });
}

function renderSummary(accounts) {
  const okAccounts = accounts.filter((account) => account.status === "ok");
  const best = okAccounts
    .map((account) => ({ account, used: getWindow(account, "primary").usedPercent }))
    .sort((a, b) => a.used - b.used)[0];
  const next = okAccounts
    .flatMap((account) =>
      ["primary", "secondary"].map((key) => ({
        account,
        key,
        resetsAt: getWindow(account, key).resetsAt,
      })),
    )
    .filter((item) => item.resetsAt)
    .sort((a, b) => a.resetsAt - b.resetsAt)[0];

  els.accountCount.textContent = String(accounts.length);
  els.bestAvailability.textContent = best ? best.account.name : "No data";
  els.bestUsageDetail.textContent = best ? `${best.used}% used` : "Waiting for refresh";
  els.nextReset.textContent = next ? next.account.name : "No data";
  els.nextResetDetail.textContent = next
    ? `${formatDuration(next.resetsAt * 1000 - Date.now())} remaining`
    : "No upcoming reset";
  renderSidebarSummary(accounts, next);
}

function renderList(accounts) {
  els.accountList.replaceChildren();
  if (!accounts.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No accounts configured.";
    els.accountList.append(empty);
    return;
  }

  accounts
    .slice()
    .sort((a, b) => usageScore(a) - usageScore(b))
    .forEach((account) => {
      const button = document.createElement("button");
      button.className = "account-item";
      button.type = "button";
      button.setAttribute("aria-selected", String(account.id === state.selectedId));
      button.innerHTML = `
        <div class="account-row">
          <strong>${escapeHtml(account.name)}</strong>
          <em class="pill-mini">${escapeHtml(account.planType || statusMeta(account).label)}</em>
        </div>
        <span><i class="dot ${account.status === "ok" ? "live" : ""}"></i>${escapeHtml(accountSubtitle(account))}</span>
      `;
      button.addEventListener("click", () => {
        state.selectedId = account.id;
        render();
      });
      els.accountList.append(button);
    });
}

function renderSidebarSummary(accounts, next) {
  const okAccounts = accounts.filter((account) => account.status === "ok");
  const average = okAccounts.length
    ? Math.round(
        okAccounts.reduce((sum, account) => sum + (getWindow(account, "primary").usedPercent || 0), 0) /
          okAccounts.length,
      )
    : 0;
  const totalUsed = okAccounts.length
    ? Math.round(
        okAccounts.reduce((sum, account) => {
          const primary = getWindow(account, "primary").usedPercent || 0;
          const secondary = getWindow(account, "secondary").usedPercent || 0;
          return sum + Math.round((primary + secondary) / 2);
        }, 0) / okAccounts.length,
      )
    : 0;

  els.sidebarSummary.innerHTML = `
    <h3>Usage summary</h3>
    <p>Across ${accounts.length} accounts</p>
    <div class="summary-content">
      <div class="donut" style="--value: ${average}%">
        <div class="donut-label">
          <strong>${average}%</strong>
          <span>Average used</span>
        </div>
      </div>
      <div class="summary-rows">
        <div><span>Total accounts</span><strong>${accounts.length}</strong></div>
        <div><span>Total window use</span><strong>${totalUsed}%</strong></div>
        <div><span>Next reset</span><strong>${next ? formatDuration(next.resetsAt * 1000 - Date.now()) : "-"}</strong></div>
      </div>
    </div>
  `;
}

function renderDetail(accounts) {
  const account = accounts.find((item) => item.id === state.selectedId) || accounts[0];
  els.detailPanel.replaceChildren();

  if (!account) {
    els.detailPanel.innerHTML = `
      <div class="empty-state">
        <h2>No account selected</h2>
        <p>Add an account with its CODEX_HOME path, then refresh live usage.</p>
      </div>
    `;
    return;
  }

  const primary = getWindow(account, "primary");
  const secondary = getWindow(account, "secondary");
  const status = statusMeta(account);
  const accountPath = providerPath(account);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <header class="detail-header">
      <div>
        <h2>${escapeHtml(account.name)}</h2>
        <div class="status-line">
          <span class="pill ${status.tone}">${escapeHtml(status.label)}</span>
          ${account.planType ? `<span class="pill">${escapeHtml(account.planType)}</span>` : ""}
          ${account.email ? `<span class="pill">${escapeHtml(account.email)}</span>` : ""}
          ${account.usageSource ? `<span class="pill">${escapeHtml(account.usageSource)}</span>` : ""}
        </div>
      </div>
      <div class="row-actions">
        <button class="secondary-button" data-action="test">${icons.flask} Test account</button>
        <button class="secondary-button danger" data-action="delete">${icons.trash} Delete</button>
      </div>
    </header>

    <div class="limit-grid">
      ${renderLimitCard("5-hour window", primary)}
      ${renderLimitCard("Weekly window", secondary)}
    </div>

    <section class="path-card">
      <div class="path-left">
        <div class="path-icon">${icons.code}</div>
        <div>
          <h3>${escapeHtml(accountPath.label)}</h3>
          <p>${escapeHtml(accountPath.value)}</p>
        </div>
      </div>
      <button class="copy-button" data-action="copy-path">${icons.copy} Copy path</button>
    </section>

    ${
      account.status === "ok"
        ? ""
        : `
          <h2>Login command</h2>
          <div class="command-box">
            <code>${escapeHtml(account.loginCommand || "")}</code>
            <button class="copy-button" data-action="copy-login">Copy</button>
          </div>
          ${account.error ? `<p class="muted">${escapeHtml(account.error)}</p>` : ""}
        `
    }
    ${
      account.manualOverride
        ? `
          <h2>Availability override</h2>
          <p class="muted">${escapeHtml(account.manualOverride.reason)} until ${formatDateTime(account.manualOverride.unavailableUntil)}.</p>
        `
        : ""
    }
    <section class="info-strip">
      <div class="info-left">
        <div class="info-icon">${icons.info}</div>
        <span>Limits are updated in real-time. Usage is calculated based on your activity.</span>
      </div>
      <span class="updated-status">${account.updatedAt ? "Last updated just now" : "Waiting for update"}</span>
    </section>
  `;

  wrapper.querySelector('[data-action="test"]').addEventListener("click", () => testAccount(account));
  wrapper.querySelector('[data-action="delete"]').addEventListener("click", () => deleteAccount(account));
  const copy = wrapper.querySelector('[data-action="copy-login"]');
  if (copy) {
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(account.loginCommand || "");
      copy.textContent = "Copied";
      setTimeout(() => {
        copy.textContent = "Copy";
      }, 1200);
    });
  }
  const copyPath = wrapper.querySelector('[data-action="copy-path"]');
  if (copyPath) {
    copyPath.addEventListener("click", async () => {
      await navigator.clipboard.writeText(accountPath.value || "");
      copyPath.innerHTML = `${icons.copy} Copied`;
      setTimeout(() => {
        copyPath.innerHTML = `${icons.copy} Copy path`;
      }, 1200);
    });
  }
  els.detailPanel.append(wrapper);
}

async function testAccount(account) {
  const button = els.detailPanel.querySelector('[data-action="test"]');
  button.disabled = true;
  button.textContent = "Testing...";
  try {
    const result = await api(`/api/accounts/${encodeURIComponent(account.id)}/test`, {
      method: "POST",
    });
    window.alert(`Account test passed.\n\n${result.stdout}`);
  } catch (error) {
    window.alert(`Account test failed.\n\n${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Test account";
    await refreshUsage();
  }
}

function renderLimitCard(title, window) {
  if (!window || typeof window.usedPercent !== "number") {
    return `
      <article class="limit-card">
        <h3>${title}</h3>
        <strong>No data</strong>
        <span>Refresh after login.</span>
      </article>
    `;
  }
  const remaining = Math.max(0, 100 - window.usedPercent);
  return `
    <article class="limit-card">
      <div class="limit-top">
        <div class="limit-title">${title.startsWith("5") ? icons.clock : icons.calendar}${title}</div>
        <div class="more-icon">${icons.more}</div>
      </div>
      <strong>${window.usedPercent}% used</strong>
      <span>${remaining}% left · resets ${formatReset(window.resetsAt)}</span>
      <div class="progress-shell" aria-label="${title} usage">
        <div class="progress-bar" style="width: ${window.usedPercent}%"></div>
      </div>
      <div class="reset-strip">${icons.calendar} ${formatAbsoluteReset(window.resetsAt, title.startsWith("5"))}</div>
    </article>
  `;
}

function getWindow(account, key) {
  return account.rateLimits?.[key] || {};
}

function usageScore(account) {
  if (account.status === "manual_lockout") return Number.POSITIVE_INFINITY;
  const primary = getWindow(account, "primary");
  if (typeof primary.usedPercent !== "number") return Number.POSITIVE_INFINITY;
  return primary.usedPercent;
}

function accountSubtitle(account) {
  if (account.status === "ok") {
    const primary = getWindow(account, "primary");
    return `${account.planType || account.provider || "plan"} · ${primary.usedPercent}% used · ${availabilityLabel(account)}`;
  }
  if (account.status === "metadata_only") return `${account.planType || "Claude"} · usage endpoint not verified`;
  if (account.status === "manual_lockout") {
    return `Unavailable until ${formatDateTime(account.manualOverride.unavailableUntil)}`;
  }
  if (account.status === "wrong_account") return `Wrong account: ${account.email || "unknown"}`;
  if (account.status === "not_logged_in") return "Not logged in";
  if (account.status === "missing_home") return "Home missing";
  if (account.status === "error") return "Query failed";
  return "Not refreshed yet";
}

function statusMeta(account) {
  if (account.status === "ok") {
    if (account.rateLimits?.limitReached === true || account.rateLimits?.allowed === false) {
      return { label: "Limit reached", tone: "danger" };
    }
    return { label: "Live", tone: "ok" };
  }
  if (account.status === "manual_lockout") return { label: "Manually unavailable", tone: "danger" };
  if (account.status === "metadata_only") return { label: "Profile only", tone: "warn" };
  if (account.status === "wrong_account") return { label: "Wrong account", tone: "danger" };
  if (account.status === "not_logged_in") return { label: "Needs login", tone: "warn" };
  if (account.status === "missing_home") return { label: "Missing home", tone: "warn" };
  if (account.status === "error") return { label: "Error", tone: "danger" };
  return { label: "Pending refresh", tone: "" };
}

function providerPath(account) {
  if (account.provider === "claude") {
    return {
      label: "CLAUDE_HOME",
      value: account.claudeHome || "~/.claude",
    };
  }
  return {
    label: "CODEX_HOME",
    value: account.codexHome || "",
  };
}

function availabilityLabel(account) {
  if (account.rateLimits?.limitReached === true || account.rateLimits?.allowed === false) {
    return "blocked by API";
  }
  const primary = getWindow(account, "primary");
  return `resets ${formatReset(primary.resetsAt)}`;
}

function formatReset(seconds) {
  if (!seconds) return "unknown";
  return formatDuration(seconds * 1000 - Date.now());
}

function formatAbsoluteReset(seconds, includeTimeOnly = false) {
  if (!seconds) return "Reset time unknown";
  const date = new Date(seconds * 1000);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (includeTimeOnly) return `Resets at ${time}`;
  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  return `Resets on ${day} at ${time}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

async function deleteAccount(account) {
  if (!window.confirm(`Remove ${account.name} from the tracker?`)) return;
  await api(`/api/accounts/${encodeURIComponent(account.id)}`, { method: "DELETE" });
  state.selectedId = null;
  state.usage = [];
  await loadAccounts();
  await refreshUsage();
}

els.refreshUsage.addEventListener("click", refreshUsage);
els.openAddDialog.addEventListener("click", () => {
  els.accountName.value = "";
  els.codexHome.value = "~/.codex-accounts/account2";
  els.expectedEmail.value = "";
  els.dialog.showModal();
});
els.closeDialog.addEventListener("click", () => els.dialog.close());
els.cancelDialog.addEventListener("click", () => els.dialog.close());
els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/accounts", {
    method: "POST",
    body: JSON.stringify({
      name: els.accountName.value,
      codexHome: els.codexHome.value,
      expectedEmail: els.expectedEmail.value,
    }),
  });
  els.dialog.close();
  await loadAccounts();
  await refreshUsage();
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

hydrateStaticIcons();
await loadAccounts();
await refreshUsage();
setInterval(refreshUsage, 60_000);
