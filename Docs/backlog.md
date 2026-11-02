# Backlog

Working list of pending work for this repo. New items go at the bottom of their priority table.

## Now

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Commit rename + RH CAI lockup changes; push to renamed repo | pending | baseURL/github_repo → CAI-Field-Manual-prototype; field-guides → field-manual rename everywhere (dir, docs_section, LLMSFULL path, copy); assets/icons/logo-rh-cai.svg; gate clean |

## Next

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Pages enablement: self-served by the workflow (`configure-pages` with `enablement: true`, committed 2026-11-02) — runs on first `migrate-maas-guide` push | pending first run | replaces the manual Settings → Pages → Source = GitHub Actions admin step |

## Later

| # | Item | Status | Notes |
|---|------|--------|-------|
| Remove `migrate-maas-guide` from the Pages workflow trigger after the migration merges to `main` (revert 60c1a1f) | |

## Done

| # | Item | Completed | Notes |
|---|------|-----------|-------|
| 2 | Repo settings: enable Issues on the repo | 2026-11-02 | `gh api` confirms `has_issues: true`; README issues bullet and landing CTA already correct (restored to HEAD by the user); oink create-issue action now 404s nowhere; pinned `page-urls.html` override removed (issues-disable workaround obsolete) |
| | | | |
