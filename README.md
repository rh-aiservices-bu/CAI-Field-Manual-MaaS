Rendered site: https://rh-aiservices-bu.github.io/CAI-Field-Manual-prototype/

# CAI-Field-Manual-prototype

Field Manual example site built with [Hugo](https://gohugo.io/) and the
[OINK](https://oink.pgsty.com/) theme (`github.com/pgsty/oink`).

## Prerequisites

- Hugo Extended ≥ 0.168 (`hugo version`)
- Go ≥ 1.27 — no Node.js needed

## Local preview

```sh
hugo server
```

With a path in `baseURL` (`https://rh-aiservices-bu.github.io/CAI-Field-Manual-prototype/`),
the dev server serves at `http://localhost:1313/CAI-Field-Manual-prototype/` —
a 404 at the root is expected, not a broken build.

## Publication gate

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

## Structure

- `hugo.yaml` — site config: GA4 placeholder, AI share targets, display-option (variant) axes, `docs_section: field-guides` (drives the llms.txt Documentation index and the docs-sidebar fallback)
- `data/home.yaml` — landing page sections (hero, cards, cta)
- `content/_index.md` — home page front matter
- `content/field-guides/` — the field guides; `content/field-guides/hello-world/` is the blank guide skeleton to duplicate
- `content/why-this-approach.md` — design rationale page (what the prototype copies from the MaaS guide, changes, and why)
- `layouts/_partials/google_analytics.html` — GA4 partial (the theme's head.html calls it in production)
- `layouts/_shortcodes/variant.html` + `layouts/_partials/hooks/{head-end,body-end}.html` — display-option blocks, header selector, and persistence runtime
- `.github/workflows/github-pages.yaml` — deploy workflow (GitHub Pages via Actions)

The project root stays minimal: the theme module supplies the navbar logo and
favicon, and build outputs (`public/`, `resources/`) are gitignored and regenerate.

## Display options (variants)

The header selector (ops mode: Show both/GitOps/ClicOps; guide version: 3.6/3.4)
filters `{{</* variant axis id */>}}` blocks. The choice persists in
`localStorage` across pages and visits and syncs across tabs. Only the
interactive HTML output filters: the per-page markdown, `llms.txt`, and the
print bundle render every variant with an `Axis: Option` label, so AI agents
and print readers see all variants.

To add an axis or option, edit `params.variants` in `hugo.yaml` — the filter
CSS and selector control are generated from that config.

## Deployment

Pushes to `main` build and deploy via GitHub Actions. Repo Settings → Pages →
Source must be **GitHub Actions** (one-time admin step).
