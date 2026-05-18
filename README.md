# Codex Limit Tracker

Local dashboard for live Codex subscription limits across multiple ChatGPT accounts, plus Claude Code account identity.

## Run

```bash
npm start
```

Then open `http://127.0.0.1:8080`.

The app starts a local Node server because the browser cannot spawn `codex app-server` directly.

## Account Setup

Each Codex subscription must use a dedicated `CODEX_HOME`. Do not point an account at `~/.codex`; that path follows whichever Codex account is currently active and will make accounts look duplicated.

The first/default subscription is configured for:

```bash
~/.codex-accounts/account1
```

Log into it with:

```bash
mkdir -p ~/.codex-accounts/account1
chmod 700 ~/.codex-accounts/account1
CODEX_HOME=~/.codex-accounts/account1 codex login --device-auth
```

The second subscription is configured for:

```bash
mkdir -p ~/.codex-accounts/account2
chmod 700 ~/.codex-accounts/account2
CODEX_HOME=~/.codex-accounts/account2 codex login --device-auth
```

Sign into the matching ChatGPT subscription during each login flow. The tracker also stores an expected email for each account and reports `Wrong account` if a home is logged into the wrong identity.

## How It Works

For Codex accounts, the backend first reads the account's `auth.json` and calls ChatGPT's Codex usage endpoint directly. It falls back to:

```bash
CODEX_HOME=<account-home> codex app-server --listen stdio://
```

It then calls Codex's local `account/read` and `account/rateLimits/read` methods. Codex handles OAuth token storage and refresh inside each `CODEX_HOME`.

For Claude Code, the tracker reads `claude auth status --json` and local non-token metadata from `~/.claude/.credentials.json`. Claude live usage percentages are not shown until a verified non-interactive usage endpoint is added.

The tracker stores only account aliases, expected emails, providers, and paths in `data/accounts.json`. It does not store ChatGPT or Claude OAuth tokens.

## Verifying An Account Works

Rate-limit data proves that Codex can read account quota metadata. It does not prove every model or workflow will run on that account.

Use the dashboard's `Test account` button to run a tiny Codex request through the selected `CODEX_HOME`. This consumes a small amount of quota but confirms the account can actually execute Codex.
