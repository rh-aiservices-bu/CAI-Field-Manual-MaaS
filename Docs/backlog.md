# Backlog

Working list of pending work for this repo. New items go at the bottom of their priority table.

## Now

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Commit rename + RH CAI lockup changes; push to renamed repo | pending | baseURL/github_repo → CAI-Field-Manual-prototype; field-guides → field-manual rename everywhere (dir, docs_section, LLMSFULL path, copy); assets/icons/logo-rh-cai.svg; gate clean |

## Next

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Pages: live — site created via admin API and deploys verified from `migrate-maas-guide` (2026-11-02); workflow triggers on branch pushes and `workflow_dispatch` | done | one-time admin acts: site creation + `github-pages` deployment-branch policy grant (cleanup in Later) |

## Later

| # | Item | Status | Notes |
|---|------|--------|-------|
| After the migration merges to `main`: revert 60c1a1f (remove `migrate-maas-guide` from the Pages workflow trigger) and remove the `migrate-maas-guide` entry from the `github-pages` environment's deployment-branch policy (added 2026-11-02) — otherwise the old branch keeps deploy rights to the production environment | |

## Done

| # | Item | Completed | Notes |
|---|------|-----------|-------|
| 2 | Repo settings: enable Issues on the repo | 2026-11-02 | `gh api` confirms `has_issues: true`; README issues bullet and landing CTA already correct (restored to HEAD by the user); oink create-issue action now 404s nowhere; pinned `page-urls.html` override removed (issues-disable workaround obsolete) |
| | | | |
