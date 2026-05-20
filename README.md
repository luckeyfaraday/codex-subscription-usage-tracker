# Codex Limit Tracker

[![JavaScript](https://img.shields.io/badge/JavaScript-ESM-f7df1e?logo=javascript&logoColor=111)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub last commit](https://img.shields.io/github/last-commit/luckeyfaraday/codex-subscription-usage-tracker)](https://github.com/luckeyfaraday/codex-subscription-usage-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/luckeyfaraday/codex-subscription-usage-tracker)](https://github.com/luckeyfaraday/codex-subscription-usage-tracker/issues)
[![Local-first](https://img.shields.io/badge/privacy-local--first-2ea44f)](#data-and-privacy)

Local dashboard for monitoring Codex subscription usage, ChatGPT Codex rate limits, and Claude Code usage windows across multiple local accounts.

Codex Limit Tracker is built for developers who rotate between several Codex or ChatGPT subscriptions and need a fast way to see which account has available capacity before starting a coding session.

## Overview

| Area | Details |
| --- | --- |
| Runtime | Local Node.js server with a browser dashboard |
| Providers | Codex / ChatGPT and Claude Code |
| Storage | Local `data/accounts.json` configuration |
| Network | Calls provider usage/auth endpoints from your machine |
| Tokens | Reads existing local auth files at runtime; does not copy OAuth tokens into project data |

## Table of Contents

- [What It Does](#what-it-does)
- [Why This Exists](#why-this-exists)
- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Desktop Widget](#desktop-widget)
- [Codex Account Setup](#codex-account-setup)
- [Claude Code Setup](#claude-code-setup)
- [Account Configuration](#account-configuration)
- [Local API](#local-api)
- [Data and Privacy](#data-and-privacy)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [LLM Summary](#llm-summary)

## What It Does

- Tracks multiple Codex accounts by assigning each subscription its own `CODEX_HOME`.
- Shows live 5-hour and weekly usage windows when the provider exposes them.
- Reads Codex usage from ChatGPT's Codex usage API, then falls back to `codex app-server` when needed.
- Detects account identity mismatches with an optional expected email check.
- Supports Claude Code profile checks and Claude status-line usage capture.
- Sorts accounts by lowest usage so the freshest subscription is easy to choose.
- Runs a small account test to confirm a Codex account can actually execute a request.
- Stores account aliases, expected emails, providers, and config paths locally in `data/accounts.json`.

## Why This Exists

Codex and Claude Code usage limits are account-specific, time-windowed, and easy to confuse when several subscriptions are used on the same machine. The normal `~/.codex` directory follows whichever account is active, so it is not reliable for comparing multiple subscriptions.

This project treats each Codex subscription as a separate local identity:

```bash
~/.codex-accounts/account1
~/.codex-accounts/account2
~/.codex-accounts/account3
```

The dashboard polls those homes independently and presents the result as a local usage ledger.

## Features

### Codex and ChatGPT Usage Monitoring

For Codex accounts, the backend reads the account's `auth.json`, refreshes the access token if needed, and calls the ChatGPT Codex usage endpoint. It displays primary and secondary rate-limit windows, reset times, plan type, allowed status, and limit-reached state.

If the direct usage request fails, the server falls back to:

```bash
CODEX_HOME=<account-home> codex app-server --listen stdio://
```

It then calls:

```text
account/read
account/rateLimits/read
```

### Claude Code Usage Monitoring

Claude Code support uses `claude auth status --json` for account metadata. The dashboard's `Sync usage` action starts a tiny Claude Code turn with a temporary status-line command and captures the reported five-hour and seven-day usage windows.

The app reads local Claude metadata from:

```bash
~/.claude/.credentials.json
```

### Identity Checks

Each tracked account can include an `expectedEmail`. If a `CODEX_HOME` or Claude config directory is logged into a different identity, the UI marks it as `Wrong account` instead of silently showing misleading usage data.

### Execution Test

Rate-limit metadata proves that the tracker can read quota information. It does not prove that a model request can run.

The `Run test` button sends a tiny Codex request through the selected `CODEX_HOME`:

```bash
codex exec --sandbox read-only --skip-git-repo-check --ignore-rules --ephemeral "Reply with only: tracker-account-ok"
```

This consumes a small amount of quota but validates that the selected account can execute Codex.

## Requirements

- Node.js with native `fetch` support.
- npm.
- Codex CLI for Codex account tracking.
- Claude Code CLI for Claude account tracking.
- Local login credentials for every account you want to monitor.

## Quick Start

Install dependencies:

```bash
npm install
```

Start the local dashboard:

```bash
npm start
```

Open:

```text
http://127.0.0.1:8080
```

Use a custom port if needed:

```bash
PORT=8090 npm start
```

The server binds to `127.0.0.1` and serves the static dashboard plus local API routes from `server.js`.

## Desktop Widget

The compact widget view is available at:

```text
http://127.0.0.1:8080/widget.html
```

Launch it as a standalone Chrome app window:

```bash
google-chrome --app=http://127.0.0.1:8080/widget.html --class=CodexLimitTrackerWidget
```

The widget shows the best available account, five-hour usage, weekly usage, reset countdown, account status, and a copyable Codex launch command.

## Codex Account Setup

Each Codex subscription needs a dedicated `CODEX_HOME`. Do not reuse `~/.codex` for multi-account tracking because that path follows the currently active Codex login.

Create and log into the first account:

```bash
mkdir -p ~/.codex-accounts/account1
chmod 700 ~/.codex-accounts/account1
CODEX_HOME=~/.codex-accounts/account1 codex login --device-auth
```

Create and log into a second account:

```bash
mkdir -p ~/.codex-accounts/account2
chmod 700 ~/.codex-accounts/account2
CODEX_HOME=~/.codex-accounts/account2 codex login --device-auth
```

During each login flow, sign into the ChatGPT subscription that should match that local account directory.

## Claude Code Setup

Log into Claude Code normally:

```bash
claude auth login
```

Then add a Claude account in the dashboard. Leave the Claude config path blank to use:

```bash
~/.claude
```

Click `Sync usage` when you want the tracker to run the status-line capture and update Claude usage windows.

## Account Configuration

The tracker creates `data/accounts.json` on first run. A shareable example is available in `data/accounts.example.json`.

Example:

```json
{
  "accounts": [
    {
      "id": "default",
      "name": "Default Codex",
      "provider": "codex",
      "codexHome": "/home/you/.codex-accounts/account1",
      "expectedEmail": "first-account@example.com",
      "enabled": true
    },
    {
      "id": "claude",
      "name": "Claude Code",
      "provider": "claude",
      "claudeHome": "/home/you/.claude",
      "expectedEmail": "claude-account@example.com",
      "enabled": true
    }
  ]
}
```

## Local API

The browser UI talks to the local Node server through these routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/accounts` | Read configured accounts. |
| `GET` | `/api/usage` | Poll enabled accounts and return usage telemetry. |
| `POST` | `/api/accounts` | Register a Codex or Claude account. |
| `DELETE` | `/api/accounts/:id` | Remove an account from the tracker. |
| `POST` | `/api/accounts/:id/test` | Run a small account execution test. |
| `POST` | `/api/accounts/:id/claude/sync` | Capture Claude Code status-line usage. |

## Data and Privacy

Codex Limit Tracker is local-first. It stores account display names, providers, expected emails, and local config paths in `data/accounts.json`.

It does not copy ChatGPT or Claude OAuth tokens into the project data file. Codex tokens remain inside each configured `CODEX_HOME`, and Claude credentials remain in the configured Claude home.

The server reads local auth files at runtime so it can request usage telemetry. Keep `data/accounts.json`, `~/.codex-accounts/*`, and `~/.claude` private.

## Project Structure

```text
.
├── index.html                         # Dashboard markup
├── styles.css                         # Dashboard styling
├── server.js                          # Local HTTP server and provider integrations
├── src/app.js                         # Browser UI state, rendering, and actions
├── scripts/claude-statusline-capture.js
├── data/accounts.example.json         # Example account configuration
├── package.json
└── README.md
```

## Troubleshooting

### `CODEX_HOME does not exist`

Create the account directory and log in with that exact path:

```bash
mkdir -p ~/.codex-accounts/account1
chmod 700 ~/.codex-accounts/account1
CODEX_HOME=~/.codex-accounts/account1 codex login --device-auth
```

### `No auth.json found`

The directory exists, but Codex has not logged in there yet. Run `codex login --device-auth` with the matching `CODEX_HOME`.

### `Wrong account`

The actual email returned by the provider does not match `expectedEmail`. Log into the correct account for that local home or update the expected email in the dashboard configuration.

### Claude Shows `Profile only`

Claude account metadata is available, but usage windows have not been captured yet. Click `Sync usage` for that Claude account.

### Rate Limits Load but Codex Execution Fails

Use `Run test`. The usage endpoint and execution path can fail independently, so a successful usage read does not guarantee that the account can run a Codex request.

## Contributing

This project is small and local-first. Useful contributions should keep setup simple, avoid storing secrets, and document any provider behavior that depends on local CLI state.

Before opening a pull request:

```bash
node --check server.js
node --check src/app.js
node --check scripts/claude-statusline-capture.js
```

## License

No license file is currently included. Until one is added, assume all rights are reserved by the repository owner.

## LLM Summary

Codex Limit Tracker is a private, localhost-only dashboard that monitors OpenAI Codex and Claude Code subscription usage across multiple local accounts. It uses separate `CODEX_HOME` directories for each Codex subscription, reads ChatGPT Codex rate-limit telemetry, falls back to `codex app-server`, checks expected account emails, and captures Claude Code usage through a temporary status-line command. It is useful for developers managing multiple AI coding subscriptions on one workstation.
