Rendered site: https://rh-aiservices-bu.github.io/CAI-Field-Manual-MaaS/

# CAI Field Manual for MaaS

The CAI Field Manual for MaaS is a field manual for deploying Red Hat OpenShift
AI 3.4/3.5 Models-as-a-Service on OpenShift: phase-by-phase installation,
model deployment with governance, verification, upgrades, and reference
material. Every command is followed by a verify step with literal expected
output, and known issues are documented where the reader hits them. Version
tabs at the top of every page (RHAIE version selector) filter version-specific
steps.

This repo is the **rendered site + all content**. Look-and-feel, layout
overrides, and build rules come from the
[`CAI-Field-Manual-Shell`](https://github.com/rh-aiservices-bu/CAI-Field-Manual-Shell)
Hugo module (imported via `hugo.yaml` → `module.imports`).

Built with [Hugo](https://gohugo.io/) and the [OINK](https://oink.pgsty.com/)
theme (`github.com/pgsty/oink`, transitively via the Shell module).

## How to consume it

Start at [Guide](https://rh-aiservices-bu.github.io/CAI-Field-Manual-MaaS/guide/) —
the Overview page maps the phases and links every section.

**Humans** — read the rendered HTML:

- The selector at the top of every page (RHAIE version: 3.4 / 3.5 / 3.6 —
  with *Show all*) filters version-specific content; the selected pill is
  clearly highlighted, and a status line beneath the pills restates the
  current view as a sentence; the choice persists in `localStorage` across
  pages, visits, and tabs.
- Search with `/` or the navbar search box (`offline_search`).
- Each section also renders a print bundle for offline/print reading.
- **Command palette** (the navbar search box or `/`): type `agent` and
  choose **"Feed it to my AI Agent"** — it opens a copy-ready prompt for
  Claude Code or Codex: the agent clones the repo, reads the README and
  the code, reports what the manual can do, and asks what to do next.

**AI agents** — consume the markdown:

- Per-page markdown via the page action menu: *Copy markdown*, *View
  markdown*, *Open in Claude / ChatGPT*, *Open Gemini*.
- Whole site as [`llms.txt`](https://rh-aiservices-bu.github.io/CAI-Field-Manual-MaaS/llms.txt).
- The markdown, `llms.txt`, and print outputs carry every display option
  labeled (`Axis: Option`) — only the interactive HTML filters content,
  so agents always see all variants.

## Report issues, propose changes

- **Issues** — file a [GitHub Issue](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS/issues)
  with the page URL (or the `content/` path) and what you hit.
  *(Labels and triage conventions TBD for now.)*
- **Changes** — PRs to `main` are welcome. Guide content lives in
  `content/guide/`; landing copy in `data/home.yaml`. Run the publication gate
  (below) before opening a PR. Merges to `main` deploy automatically via
  GitHub Actions; repo Settings → Pages → Source must be **GitHub Actions**
  (one-time admin step).

Where things live:

- `hugo.yaml` — site config: title, baseURL, languages, markup, outputs, module imports, `ui.docs_section: guide` (drives the llms.txt Documentation index and the docs-sidebar fallback), the display-option (variant) axis (RHAIE version 3.4/3.5/3.6, default 3.6), `github_repo`/`github_branch`, GA4 placeholder. Chrome defaults (`logo`, `offline_search`, `copyright`, `footer_center_info`, `ui` incl. presets, sidebar/nav chrome) live in the Shell module's `hugo.yaml` and are deep-merged; site values win on conflict.
- `content/guide/` — the manual: Overview `_index.md`, five sub-sections, and the phase/reference pages
- `data/home.yaml` — landing page sections (hero, cards, cta)
- `content/_index.md` — home page front matter
- `Docs/` — backlog, content-review notes, upstream-sync questions
- Layouts, assets, and static (chrome): live in the Shell module (`CAI-Field-Manual-Shell`). See that repo's README for what it exports. This repo's only local chrome is `layouts/_partials/td-variant-selector.html` (single override — no `params.customize`; Shell's tail would dangle) and `layouts/_shortcodes/visualizer.html` (inline styles for the flow embed so the site does not shadow Shell's SCSS). Content-owned assets stay local: `assets/images/` and `static/visualizers/`. To pick up shell updates: edit the Shell import's `version:` hash in `hugo.yaml` to the new commit (e.g. `git ls-remote https://github.com/rh-aiservices-bu/CAI-Field-Manual-Shell main | cut -c1-12`), then re-run the publication gate — Hugo resolves the pinned commit directly, so the build passes even if `go.mod`/`go.sum` are stale. `version:` accepts semver, branch names, or commit hashes (Hugo ≥ 0.150); a commit hash is deliberate — commit-precise, no Shell tagging. To reconcile `go.mod`/`go.sum` after a bump, run `go get github.com/rh-aiservices-bu/CAI-Field-Manual-Shell@<hash>` (don't use `hugo mod get` — it rewrites to Shell main, dirtying the lockfiles).

Automation and manifests that the guide references, copied so clone commands
in the guide retarget to this repo:

- `scripts/` — `setup-maas.sh` (single entry point), `deploy-model.sh`,
  `verify-maas.sh`, `test-inference.sh`, `cleanup-maas.sh`
- `manifests/` — Kustomize manifests per phase (00-disconnected …
  99-model-swap)
- `demo/` — demo walkthroughs (rate limiting, OIDC, subscription priority,
  corporate scenario)
- `.claude/skills/` — `install-maas` and `verify-guide` AI coding skills
- `LICENSE` — Apache-2.0

The project root stays minimal: the Shell module supplies the layouts and
chrome, the theme module (oink) supplies the navbar chrome, and build outputs
(`public/`, `resources/`) are gitignored and regenerate.

## Disclaimers

- **Orientation, not a support statement.** Commands and versions reflect
  what worked during field work when the manual was written; verify against
  the current official product documentation before relying on them.
- **Not official product documentation.** These are field notes from
  prototypes, maintained by project contributors.
- **Under development.** Structure, pages, and URLs are under development and
  may change or move.

## Clone and render locally

Prerequisites:

- Hugo Extended ≥ 0.168 (`hugo version`)
- Go ≥ 1.27 — no Node.js needed (Hugo modules fetch the theme)
- Dart Sass on PATH (`sass --version` → Dart Sass 1.108.2+; `npm install -g sass-embedded` if missing — needed for the SCSS pipeline)

```sh
git clone https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS.git
cd CAI-Field-Manual-MaaS
hugo server
```

With a path in `baseURL`
(`https://rh-aiservices-bu.github.io/CAI-Field-Manual-MaaS/`), the dev
server serves at `http://localhost:1313/CAI-Field-Manual-MaaS/` — a 404
at the root is expected, not a broken build. Builds use the Shell commit pinned in
`hugo.yaml` `module.imports[].version`, not Shell `main` — deliberate, commit-precise;
the `hugo.work` workspace replacement below overrides it only for testing unpushed Shell work.

To verify a Shell working-tree change locally (before it is pushed), add a
workspace replacement — create `hugo.work` in this repo root containing:

```
go 1.27.3

use .

replace github.com/rh-aiservices-bu/CAI-Field-Manual-Shell => ../CAI-Field-Manual-Shell
```

Then run with the workspace:

```sh
HUGO_MODULE_WORKSPACE=hugo.work hugo server
```

Verify with `hugo config` / `hugo mod graph` that the replacement is active.
`hugo.work` is gitignored — never commit it.

### Publication gate

One implementation, used locally and by CI (both the deploy build and PR
checks run it). Locally the raw build is enough:

```sh
hugo --cleanDestinationDir --gc --minify --environment production \
  --printPathWarnings 2>&1 | grep -i warn | grep -v "css.Sass: libsass"
```

In CI the gate runs via the Shell checkout:

```sh
shell/scripts/publication-gate.sh --baseURL "https://example.invalid/docs/"
```

The build must succeed and the only WARN allowed is the known oink libsass
deprecation; anything else fails with exit 1.

Optional contract check (needs sibling Shell clone + `public/` from the
production build):

```sh
sh ../CAI-Field-Manual-Shell/scripts/check-contracts.sh
```

Note: `--panicOnWarning` is intentionally not used. The pinned theme version
(v1.4.0) still transpiles SCSS with Hugo's deprecated LibSass, which emits a
WARNING on Hugo ≥ 0.153 and would abort the build. The gate asserts the build
emits no WARN lines other than the known libsass one. Revisit when the theme
moves to the Dart Sass transpiler.

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

## One-time admin

- **GitHub Pages**: Settings → Pages → Source = **GitHub Actions**.
