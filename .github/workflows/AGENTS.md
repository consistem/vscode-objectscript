# Workflow Guidelines

## Scope

These instructions apply to files under `.github/workflows/`.

## General CI Rules

- Keep workflows idempotent and safe for scheduled re-runs.
- Prefer explicit shell safety in script blocks: `set -euo pipefail`.
- Use clear step names and stable step outputs for control flow.
- Avoid destructive git operations unless strictly required and justified by workflow logic.

## Branch Governance

- Never push directly to `master` from workflows.
- Use a dedicated sync/automation branch for upstream flows.
- Changes to protected branches must enter via Pull Request.
- Prefer merge commit strategy when repository governance requires audit-friendly history.

## Upstream Sync Workflow (`sync-upstream.yml`)

- Purpose: synchronize fork changes from `consistem/vscode-objectscript` into this repository branch via PR.
- Schedule: daily at `03:00 UTC` (equivalent to `00:00 America/Sao_Paulo`).
- Invariants:
  - Sync branch is `bot/sync-upstream-master`.
  - No direct writes to `master`.
  - PR only flow (`bot/sync-upstream-master` -> `master`).
  - Merge mode must be merge commit (`git merge --no-ff`), not squash/rebase.
  - PR creation/update must be done via `peter-evans/create-pull-request`.
- Safety behavior:
  - Exit with no action if upstream tip is already contained in base.
  - Only create/update PR when there is real upstream update.
  - After PR creation/update, auto-merge should be enabled as best-effort using merge commit strategy.
- Conflict behavior:
  - Log merge conflict and require manual resolution on the sync branch.
  - Optional Google Chat alert can notify maintainers about conflicts and include manual resolution commands.

## Repository Setup Requirements

- GitHub Actions enabled.
- Repository workflow permissions must allow:
  - `Contents: Read and write`
  - `Pull requests: Read and write`
- Authentication should use `GITHUB_TOKEN` (`github.token`) for checkout and PR automation.
- Repository allows merge commits.
- Optional secret `GOOGLE_CHAT_WEBHOOK_URL` for Chat notifications.
