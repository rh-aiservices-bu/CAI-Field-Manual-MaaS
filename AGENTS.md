# Repository Guidance

Hugo Extended >= 0.168 + Dart Sass + Go >= 1.27 documentation site (theme via Hugo modules,
no Node.js — but `sass` must be on PATH for the SCSS pipeline). README.md is the source of truth
for setup and architecture.

This repo is the **CAI Field Manual for MaaS site** — it owns all content
(landing, guide, automation manifests) and imports
[`CAI-Field-Manual-Shell`](https://github.com/rh-aiservices-bu/CAI-Field-Manual-Shell)
as a Hugo module for look-and-feel and rules. Layouts, assets, static, and
scripts live in the Shell repo — propose shell/chrome changes there, not here.
(The pinned oink-file re-diff rule applies to the Shell repo's `layouts/` and
`assets/js/` files.)

Only two layout files are local overrides in this repo:
`layouts/_partials/td-variant-selector.html` (Shell 1f1471c74947; kept because
this site has no `params.customize` and Shell's `renderStatus()` tail would
dangle — see its provenance header) and `layouts/_shortcodes/visualizer.html`
(inline `.td-viz-embed` styles so this site does not shadow Shell's SCSS).
`assets/images/` and `static/visualizers/` are content-owned and stay local;
all other chrome is served from the Shell module mount.

## Before you push: the publication gate (mandatory)

There is no test suite. The only correctness check is the production build
(Dart Sass required on PATH):

```sh
hugo --cleanDestinationDir --gc --minify --environment production \
  --printPathWarnings 2>&1 | grep -i warn | grep -v "css.Sass: libsass"
```

No output = clean. Build failure or any other WARN = not done. Fix and re-run.
Note the root 404 is expected: with a path in baseURL the dev server serves at
`http://localhost:1313/CAI-Field-Manual-MaaS/`.

In CI the gate runs via `shell/scripts/publication-gate.sh` (see `.github/workflows/github-pages.yaml`);
locally the raw pipeline above works without the sibling checkout.

## Contract check (optional, needs sibling clone)

After a production build, validate dual-consumption contracts against the sibling
Shell checkout:

```sh
sh ../CAI-Field-Manual-Shell/scripts/check-contracts.sh
```

Requires `public/` from the production build and checks that every variant axis/option
and customize token used in `content/` is declared in this repo's `hugo.yaml`.
Expected: `contracts OK — 35 pages, 36 variant labels, 0 customize tokens`
(contract-4 is a pre-existing content finding if it fails — not a migration regression;
contracts 1–3 must pass).

## Content rules

- Manual lives in `content/maas/` — five sub-sections plus the Overview `_index.md` and the phase/reference pages. Landing copy in `data/home.yaml`.
- Display options: variant blocks `{{< variant version "3.5" >}}` and `{{< variant version "3.5 3.6" >}}` (also `"3.4"`). The single declared axis is `version` (options `3.4`/`3.5`/`3.6`/`all`, default `3.6` — validated by `check-contracts.sh`). 36 invocations today. Never delete a variant block to fix a rendering complaint — markdown/llms.txt outputs show ALL variants.
- **No customize tokens by design** — this site has no `params.customize`. Content uses plain placeholders; `grep -rn customize content` must stay empty. That's why the `td-variant-selector.html` override exists (Shell's `renderStatus()` tail would render ` — reading as  on api`).
- Author doctrine: the six conventions are chronological information architecture, status-gate verification (every command + verify + literal expected output), inline known issues, variant selector axes, customize tokens, dual consumption. Follow them from `CAI-Field-Manual-Hello-World/_archive/conventions.md` until doctrine is restored.
- Do not touch without re-diffing — applies to the Shell repo's pinned oink copies (see its `AGENTS.md` / `README.md` for the full list).

## Do not touch without re-diffing

Chrome files live in the Shell repo. If you propose shell changes there, these
files are pinned oink v1.4.0 copies — each carries a provenance comment naming
its one deliberate change. Any edit beyond that change requires re-diffing
against `~/go/pkg/mod/github.com/pgsty/oink@v1.4.0/`:
`layouts/docs/baseof.html`, `layouts/_partials/shell/sidebar-tree.html`,
`layouts/_partials/pager-state.html`, `assets/js/action-registry.js`,
`assets/js/page-actions.js`, `layouts/_partials/actions/context.html`,
`layouts/_partials/actions/title-menu.html`. The Shell also ships a fixup
`layouts/_partials/favicons.html` (hardcoded favicon list — no re-diff needed).

Sanctioned extension points in Shell (free to edit there):
`td-variant-selector.html`, `hooks/head-end.html`, `hooks/body-end.html`,
the customize shortcodes, `static/js/`, `static/css/`, `assets/scss/_styles_project.scss`.

Local to this repo (free to edit here): `hugo.yaml` (site config: title, baseURL, variants, menus, `ui.docs_section: maas`), `data/home.yaml`, `content/maas/` (the manual), `Docs/` (backlog, upstream-sync notes), `assets/images/` (content-referenced), `static/visualizers/` (4 shortcode invocations). The two local layout overrides above are free to edit here; remove the `td-variant-selector.html` override on the first Shell bump that guards the `reading as` tail.

## Verification for JS changes

Interactive behavior lives in `static/js/` and `assets/js/` (in the Shell
module). If you change it, verify the rendered page actually works (dev server
+ browser), not just that the build passes.

## Updating the shell

Edit the Shell import's `version:` hash in `hugo.yaml` to the new commit
(e.g. `git ls-remote https://github.com/rh-aiservices-bu/CAI-Field-Manual-Shell main | cut -c1-12`).
`version:` accepts semver, branch names, or commit hashes (Hugo ≥ 0.150) — a commit hash is
deliberate, commit-precise, no Shell tagging. Hugo resolves the pinned commit directly, so the
build passes even with stale `go.mod`/`go.sum`; to keep them in sync after a bump run
`go get github.com/rh-aiservices-bu/CAI-Field-Manual-Shell@<hash>` (don't use `hugo mod get` —
it rewrites `go.mod`/`go.sum` to Shell `main`, dirtying the lockfiles; don't use `hugo mod tidy`
either — it can prune the Shell entry). Verify `hugo mod graph` shows the pinned pseudo-version
and still shows `github.com/pgsty/oink v1.4.0` (the pinned theme). Re-run the publication gate.

Before bumping, re-check the override rationale: `grep -n "reading as" ../CAI-Field-Manual-Shell/layouts/_partials/td-variant-selector.html` still shows an unconditional append → keep the override; a guarded tail → delete the override and take Shell's file verbatim.
