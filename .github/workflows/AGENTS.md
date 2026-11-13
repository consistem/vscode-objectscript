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
- Any sync PR (bot or manual) must be merged on GitHub with "Create a merge commit". Squash drops the upstream
  ancestry, and the next sync then reopens conflicts that were already resolved.
- Fork and upstream share version numbers (`v3.8.5` exists in both). Locally, keep upstream tags out of
  `refs/tags`: `git config remote.upstream.tagOpt --no-tags` and
  `git config --add remote.upstream.fetch '+refs/tags/*:refs/upstream-tags/*'`.

## Release Workflow (Consistem)

- The fork is not published to the VS Code Marketplace or Open VSX. The upstream `publish` jobs in `main.yml` and
  `prerelease.yml` stay disabled by the `github.repository == 'intersystems-community/vscode-objectscript'` guard
  on their `if:` line. On every upstream sync, keep that guard, and keep out any new Marketplace/Open VSX
  publishing the upstream adds.
- `release-vsix.yml` builds the official VSIX when a release is published on GitHub (`release: released`) and
  attaches it to that release (`gh release upload --clobber`, safe to re-run). Like the beta, it keeps the
  proposed APIs enabled. The version comes from the tag; a mismatch with `package.json` only raises a warning.
- A release left without a VSIX: run `release-vsix.yml` manually (`workflow_dispatch`) with its tag.
- Version bumps are manual, in the PR. The upstream "auto bump version with release" push to `master` does not
  run in the fork.

## Repository Setup Requirements

- GitHub Actions enabled.
- Repository workflow permissions must allow:
  - `Contents: Read and write`
  - `Pull requests: Read and write`
- Authentication should use `GITHUB_TOKEN` (`github.token`) for checkout and PR automation.
- Repository allows merge commits.
- Optional secret `GOOGLE_CHAT_WEBHOOK_URL` for Chat notifications.
