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
| 2 | Sync vendored guide content + code with rhoai-maas-guide f090e3f (6 upstream commits, 2026-11-04) | done | content page openshift5 + 11 verbatim code files |

## Later

| # | Item | Status | Notes |
|---|------|--------|-------|
| | | | |

## Done

| # | Item | Completed | Notes |
|---|------|-----------|-------|
| 3 | Cleanup: `migrate-maas-guide` deployment-branch policy removed from `github-pages` environment (added 2026-11-02) | 2026-11-19 | workflow trigger already cleaned in `faa71c9` (`branches: [main]` only); removed stale env allowlist entry `65257099` — only `main` remains |
| 2 | Repo settings: enable Issues on the repo | 2026-11-02 | `gh api` confirms `has_issues: true`; README issues bullet and landing CTA already correct (restored to HEAD by the user); oink create-issue action now 404s nowhere; pinned `page-urls.html` override removed (issues-disable workaround obsolete) |
| | | | |
