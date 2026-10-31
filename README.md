Rendered site: https://rh-aiservices-bu.github.io/CAI-Field-Manual-MaaS/

# CAI Field Manual for MaaS

The CAI Field Manual for MaaS is a field manual for deploying Red Hat OpenShift
AI 3.4/3.5 Models-as-a-Service on OpenShift: phase-by-phase installation,
model deployment with governance, verification, upgrades, and reference
material. Every command is followed by a verify step with literal expected
output, and known issues are documented where the reader hits them. Version
tabs at the top of every page (RHAIE version selector) filter version-specific
steps.

Built with [Hugo](https://gohugo.io/) and the [OINK](https://oink.pgsty.com/)
theme (`github.com/pgsty/oink`).

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

**AI agents** — consume the markdown:

- Per-page markdown via the page action menu: *Copy markdown*, *View
  markdown*, *Open in Claude / ChatGPT*.
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

- `hugo.yaml` — site config: display-option (variant) axis (RHAIE version
  3.4/3.5/3.6, default 3.6), `docs_section: guide` (drives the llms.txt
  Documentation index and the docs-sidebar fallback),
  `github_repo: https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS`,
  GA4 placeholder
- `data/home.yaml` — landing page sections (hero, cards, cta)
- `content/_index.md` — home page front matter
- `content/guide/` — the guide (Overview `_index.md`, five sub-sections, and
  the phase/reference pages)
- `layouts/_partials/google_analytics.html` — GA4 partial (the theme's
  head.html calls it in production)
- `layouts/docs/baseof.html`, `layouts/_partials/shell/sidebar-tree.html`,
  `layouts/_partials/pager-state.html` — pinned copies of the oink v1.4.0
  files, each headed by a provenance comment naming its one deliberate change
  (page-top selector call; Home promoted to the tree's top level with a
  small-screen Home row; pager rooted at the page's own section instead of
  the site root). Re-diff all three against
  `~/go/pkg/mod/github.com/pgsty/oink@v<ver>/` on a theme bump.
- `layouts/_partials/td-variant-selector.html` +
  `layouts/_partials/hooks/head-end.html` — the page-top selector and the
  pre-paint persistence runtime (config blob, filter CSS). The theme ships
  both hooks empty, so these are sanctioned extension points, not copies.
- `layouts/_shortcodes/variant.html` — the variant shortcode used by the
  converted version tabs
- `layouts/_shortcodes/visualizer.html` — links the flowstory attachments
  under static/visualizers/ with the baseURL subpath applied
- `.github/workflows/github-pages.yaml` — deploy workflow

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

The project root stays minimal: the theme module supplies the navbar logo and
favicon, and build outputs (`public/`, `resources/`) are gitignored and
regenerate.

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

```sh
git clone https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS.git
cd CAI-Field-Manual-MaaS
hugo server
```

With a path in `baseURL`
(`https://rh-aiservices-bu.github.io/CAI-Field-Manual-MaaS/`), the dev
server serves at `http://localhost:1313/CAI-Field-Manual-MaaS/` — a 404
at the root is expected, not a broken build.

### Publication gate

```sh
hugo --cleanDestinationDir --gc --minify --environment production \
  --printPathWarnings
```

Note: `--panicOnWarning` is intentionally omitted — the pinned theme version
(v1.4.0) still transpiles SCSS with Hugo's deprecated LibSass, which emits a
WARNING on Hugo ≥ 0.153 and would abort the build. Gate on the remaining
warning surface instead: assert the build emits no WARN lines other than the
known libsass one.

```sh
hugo --cleanDestinationDir --gc --minify --environment production \
  --printPathWarnings 2>&1 | grep -i warn | grep -v "css.Sass: libsass"
```

No output = clean. Revisit when the theme moves to the Dart Sass transpiler.
