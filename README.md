# CAI-Field-Guide-prototype

Field Manual example site built with [Hugo](https://gohugo.io/) and the
[OINK](https://oink.pgsty.com/) theme (`github.com/pgsty/oink`).

## Prerequisites

- Hugo Extended ≥ 0.168 (`hugo version`)
- Go ≥ 1.27 — no Node.js needed

## Local preview

```sh
hugo server
```

With a path in `baseURL` (`https://rh-aiservices-bu.github.io/CAI-Field-Guide-prototype/`),
the dev server serves at `http://localhost:1313/CAI-Field-Guide-prototype/` —
a 404 at the root is expected, not a broken build.

## Publication gate

```sh
hugo --cleanDestinationDir --gc --minify --environment production \
  --printPathWarnings
```

Note: `--panicOnWarning` is intentionally omitted — the pinned theme version
(v1.4.0) still transpiles SCSS with Hugo's deprecated LibSass, which emits a
WARNING on Hugo ≥ 0.153 and would abort the build. Revisit when the theme
moves to the Dart Sass transpiler.

## Structure

- `hugo.yaml` — site config (single-language profile from the oink-starter)
- `data/home/en.yaml` — landing page sections (hero, cards, cta)
- `content/_index.md` — home page front matter
- `content/docs/` — the manual; `content/docs/sample.md` is the exemplar page to duplicate
- `.github/workflows/github-pages.yaml` — deploy workflow (GitHub Pages via Actions)

## Deployment

Pushes to `main` build and deploy via GitHub Actions. Repo Settings → Pages →
Source must be **GitHub Actions** (one-time admin step).
