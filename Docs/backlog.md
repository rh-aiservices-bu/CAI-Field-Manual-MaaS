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
| 1 | Cleanup page `oc delete` has zero verify steps — breaks status-gate doctrine | pending | `content/maas/cleanup.md:70-149` ~20 `oc delete` commands with 0 `Expected:` verifications; contradicts `data/home.yaml:9` hero claim; fix: add `oc get namespace redhat-ods-applications` → `NotFound` block after namespace deletes |
| 2 | Version-support prose says 3.4/3.5 but variant axis covers 3.6 | pending | `content/maas/_index.md:3,13`, `disconnected.md:19`, `installation-guide/prerequisites.md:3,7` say "3.4/3.5" while 18× `variant version "3.5 3.6"` blocks treat 3.6 as supported; fix: restate as "3.4/3.5/3.6" or note 3.6 pending validation |
| 3 | Gateway-setup README breaks copy-paste: wrong dir number + missing var | pending | `manifests/03-maas-platform/openshift-gateway-setup/README.md:38,49,55,75` + `cleanup.yaml:1` cite `04-maas-platform` (should be `03-`); table says `${CLUSTER_DOMAIN}` but templates use `${MAAS_HOSTNAME}` and Apply steps never export it — `envsubst` renders empty hostnames; fix: `s/04-/03-/`, add `export MAAS_HOSTNAME=maas.${CLUSTER_DOMAIN}` |
| 4 | Manifest READMEs link old Antora site + stale `content/modules/…` paths | pending | 7 manifest READMEs e.g. `03-maas-platform/README.md:5` link `rhoai-maas-guide/modules/main/*.html`; `99-cors/envoyfilter-cors.yaml:2` cites `content/modules/ROOT/pages/08e-browser-cors.adoc`; fix: update to Hugo guide URLs |
| 5 | Orphan visualizer `architecture-flow.html` ships dead payload | pending | `static/visualizers/architecture-flow.html:1` (442 lines, 36 KB) has zero references in `content/`, `data/`, `hugo.yaml`, `layouts/`, `Docs/`; still emitted to `public/visualizers/` on every build; fix: delete or wire into `content/maas/reference/architecture.md` |
| 6 | Visualizers load unpinned CDN deps — not self-contained | pending | `static/visualizers/flow.html:7,44`, `install-flow.html:7,40`, `architecture-flow.html:7,40` hard-load `noyitz.github.io/flowstory` latest with no SRI; `architecture.md:173` embed blanks if origin down; fix: vendor pinned copy under `static/visualizers/vendor/` |
| 7 | Shortcode `fm-flow.html` gate dead — flow-bleed CSS never applies | pending | `layouts/_shortcodes/visualizer.html:7` compares against `visualizers/fm-flow.html` which does not exist (files are `flow.html`/`install-flow.html`); `architecture.md:173` `embed="true"` never gets `td-viz-embed--flow` bleed; fix: gate on `visualizers/flow.html` |
| 8 | AGENTS.md stale contract expectation: "35 pages" vs 33 | pending | `AGENTS.md:51` says `contracts OK — 35 pages, 36 variant labels, 0 customize tokens` but `check-contracts.sh` reports `33 pages` (also `find content -name *.md` = 34 inc. `_index`); contracts pass, doc string wrong; fix: change `35` → `33` in AGENTS.md:51 |
| 9 | AGENTS.md stale visualizer count: "4 invocations" vs 6 | pending | `AGENTS.md:79` claims `static/visualizers/ (4 shortcode invocations)` but `grep -r "visualizer" content/` = 6 invocations in 4 files; fix: update `AGENTS.md:79` to `static/visualizers/ (6 invocations in 4 files)` |
| 10 | `aitenant-oidc-patch.yaml` orphan — not in kustomization, not cited | pending | `manifests/09-external-oidc/maas-oidc/aitenant-oidc-patch.yaml` not in `maas-oidc/kustomization.yaml:4-6`, cited nowhere in `content/`/`scripts/`; `setup-keycloak.sh:69,202` patches live instead; fix: delete or wire into kustomization |
| 11 | `azure-openai` manifest leaks real endpoint hostname | pending | `manifests/08-external-models/azure-openai/model/external-provider.yaml:8` hardcodes `maas-aoai-7c8wm-eb594.openai.azure.com` but guide `external-models.md:663` uses `<your-resource>.openai.azure.com`; fix: replace with placeholder |
| 12 | Quick-start provider list omits Anthropic + Azure OpenAI | pending | `content/maas/quick-start.md:43` says "OpenAI, Gemini, or Bedrock" but `setup-maas.sh:111` and `external-models.md:262,559` include all 5 providers; fix: list all five |
| 13 | `imageset-config-maas.yaml` channel pin `stable-3.4` mismatches `stable-3.x` subscription | pending | `manifests/00-disconnected/imageset-config-maas.yaml:34-36` mirrors `stable-3.4` only, while `01-prerequisites/operators/rhoai-operator/subscription.yaml:7` subscribes `stable-3.x`; disconnected 3.5/3.6 install mirrors wrong channel; fix: add `stable-3.x` or note "edit for your version" |
| 14 | Docs path `content/guide/` stale after rename to `content/maas/` | pending | `Docs/content-review-backlog.md:19-20` cites `guide/upgrade/platform-upgrade.md` and `guide/demos/corporate-scenario.md` but `content/guide/` does not exist (renamed to `content/maas/`); fix: rewrite paths to `content/maas/` |
| 15 | Now row 1 stale — describes rename to `CAI-Field-Manual-prototype` | pending | `Docs/backlog.md:9` pending item says `baseURL → CAI-Field-Manual-prototype; field-guides → field-manual` but repo is `CAI-Field-Manual-MaaS`; fix: rewrite or close as `wontfix` |
| 16 | Prereq OpenShift floor inconsistent: 4.19+ vs 4.20+ | pending | `content/maas/_index.md:19,46` says `4.19+`, `content/maas/disconnected.md:18` says `4.20+` — 4.20.32 istiod change explained inline but _index prereq should note it; fix: add "(4.20+ for disconnected)" to _index:19 |
| 17 | GA placeholder ships to production | pending | `hugo.yaml:46` `ID: G-XXXXXXXXXX` renders as `googletagmanager.com/gtag/js?id=G-XXXXXXXXXX` in `public/`; known, already in Now:1; fix: gate GA partial on real ID |
| 18 | Placeholder `...` in troubleshooting error message | pending | `content/maas/upgrade/post-upgrade-troubleshooting.md:749` shows `oc apply -f manifests/05-maas-models/.../maas-model.yaml` as the failing example (quoted error output, not copy-paste); cosmetic — fix: use `simulator/maas/maas-model.yaml` or `⟨model⟩` |
| 19 | Plaintext demo secrets committed | pending | `manifests/07-observability/redis/redis-secret.yaml`, `minio-secret.yaml`, `09-external-oidc/keycloak/instance/keycloak-db-secret.yaml` (`keycloak/keycloak`) are `kind: Secret` with plaintext `stringData`; by design for demos; fix: add "demo-only" header comment |

## Done

| # | Item | Completed | Notes |
|---|------|-----------|-------|
| 4 | Sub-agent repo review (2026-11-19) — 19 findings logged under Later | 2026-11-19 | 8 review tasks (3 completed, 5 deep scans harvested via history); spawn smoke test passed (SPAWN-OK); build gate clean (0 WARN); contract check OK — 33 pages, 36 variant labels, 0 customize tokens |
| 3 | Cleanup: `migrate-maas-guide` deployment-branch policy removed from `github-pages` environment (added 2026-11-02) | 2026-11-19 | workflow trigger already cleaned in `faa71c9` (`branches: [main]` only); removed stale env allowlist entry `65257099` — only `main` remains |
| 2 | Repo settings: enable Issues on the repo | 2026-11-02 | `gh api` confirms `has_issues: true`; README issues bullet and landing CTA already correct (restored to HEAD by the user); oink create-issue action now 404s nowhere; pinned `page-urls.html` override removed (issues-disable workaround obsolete) |
| | | | |
