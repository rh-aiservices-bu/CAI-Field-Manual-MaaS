# MaaS guide migration — content review backlog

Review of all 25 converted pages on branch `migrate-maas-guide`, run against the live dev server and the built HTML. Each page audited at two levels: **rendering** (tables, fences, alerts, variant blocks, images, anchors, headings) and **sense** (prose parity, admonition-type match, variant-body content, link targets).

**Method note.** Sub-agent review was attempted three times (reviewer + task agents, default and per-call model) and failed to spawn — "No model selected" from the agent runtime. The review below ran as scripted parity checks (deterministic, reproducible) plus targeted manual deep-dives on every flagged item. Every check is grounded in fetched HTML or on-disk state, not inferred.

## Verdict

**25/25 pages clean** (finding #1 applied 2026-11-02; finding #2 was a false positive). Zero literal-construct leaks, zero broken image srcs, all 68 cross-page fragments resolve, all 25 pages' table rows match source exactly, all 25 pages' admonition type counts match source, all fence counts ≥ source, prose density ≥0.85 on 23/25 pages.

One cosmetic finding applied 2026-11-02 (platform-upgrade Path A/B demoted to bold lead lines); the other (corporate-scenario heading count) is a false positive, correct as-is. No render breaks, no content loss.

**2026-11-02 link audit** (scripted over `public/`): 44 HTML pages, 0 broken internal page/image links, 1188/1188 fragment links resolve. The audit ran while finding #3's interim override was active (0 `issues/new` refs at that time); after Issues were re-enabled the same day the override was removed and the per-page create-issue action is back, with its `issues/new` targets live (`has_issues: true`). External surface: 403s are bot-blocked hosts (docs.redhat.com, developers.redhat.com, chatgpt.com, claude.ai, linkedin.com — docs.redhat.com verified in a real browser, renders normally), 404s on `rh-aiservices-bu.github.io` self-URLs and `github.com/…/tree|blob|commit` links are the unpushed state (5 local commits, live Pages site predates the push) and resolve at merge/deploy. **Nothing here blocks merge.**

## Findings

| # | Severity | Page | Finding | Evidence | Fix | Cost |
|---|---|---|---|---|---|---|
| 1 | cosmetic | `guide/upgrade/platform-upgrade.md` | Two AsciiDoc block titles (`.Path A: …`, `.Path B: …`) promoted to `###` headings. In AsciiDoc a `.Title` above a block renders as bold lead text, not a heading; here they render as h3 in the TOC. | Source `12-platform-upgrade.adoc:228,241` are `.Path …` lines directly above code blocks; rendered HTML has `<h3 id="path-a-delete-and-let-the-operator-re-reconcile">`. Headings work but deviate slightly from source intent. | Applied 2026-11-02 — demoted to `**Path A/B: …**` bold lead lines; h3 parity now 25/25. | 2 lines |
| 2 | cosmetic | `guide/demos/corporate-scenario.md` | Heading-count mismatch is a false positive: 3 of the source's 20 `===` lines are `=== sales-1 (corp-sales) ===` markers **inside** the expected-output fence, correctly rendered as literal text in the ```text block. Rendered h3 = 17 = real source h3. | Source lines 204/215/228 are inside `----` fences; built HTML shows them inside `<pre><code class="language-text">`. | None — conversion is correct. | 0 |
| 3 | major | site-wide (theme) | Oink v1.4.0 derives a per-page "Create Issue" action from `github_repo` alone (`layouts/_partials/actions/page-urls.html`), but the target repo had issues disabled (`has_issues: false`), so every page rendered an action that 404s for readers. | `gh api repos/rh-aiservices-bu/CAI-Field-Manual-MaaS` → `has_issues: false`; built pages carried `data-td-action=create_issue` href `issues/new?title=…`. | **Resolved 2026-11-02 — issues re-enabled in the repo.** Interim workaround (pinned `layouts/_partials/actions/page-urls.html` override dropping the `$issueURL` derivation, README reworded to PR-only, landing CTA repointed) was applied and then removed the same day once issues were re-enabled: override deleted, README/home.yaml back at HEAD, create-issue action restored on rebuild. | ~15 lines |

## Checks that passed (evidence)

- **Literal leaks**: 0 across all 25 pages (`xref:`, `image::`, `{attr}`, `[[…]]`, `<<…>>`, `link:{`, `[tabs]`, `{attachmentsdir}` in rendered text, fences excluded).
- **Tables**: row parity source↔rendered exact on 25/25 pages (careful row counting; maaspal's initial "mismatch" was a counter bug — 16 source rows = 16 rendered `<tr>`).
- **Images**: every `images/*` src on every page → HTTP 200 (14 assets).
- **Fragments**: 68/68 cross-page `page#anchor` links resolve (first audit run flagged 68 "MISSING TARGET" — that was an audit-script path bug building `public/CAI-Field-Manual-MaaS/…`; corrected mapping `public/<path>` resolves all).
- **Headings**: h2/h3/h4 parity on 25/25 (finding #1 applied 2026-11-02: platform-upgrade Path A/B demoted to bold lead lines; finding #2 was a false positive).
- **Fences**: rendered `<pre>` count ≥ source fence count on all pages; no stray ``` markers in visible text.
- **Admonitions**: NOTE/TIP/IMPORTANT/WARNING label counts match source keyword counts on 25/25 pages.
- **Variants**: open/close pairs matched everywhere; 36 attr tokens; bold qualifiers (**MaasTenantConfig**, **Tenant**) present; 3.4-vs-3.5 CRD names distinct (`ModelsAsServiceReady` ×1 / `ModelsAsAServiceReady` ×2 on verification).
- **History links**: changelog's 74 old-repo pull refs (68 unique PRs, incl. pull/170's label quirk) all point at `rhoai-maas-guide` and spot-checked pull/2/3/4/186/189/194 → HTTP 200; GH #107 in platform-upgrade → old repo. Zero new-repo pull/issue links.
- **Assets/runtime**: `.claude/skills/` present and referenced by claude-code.md; visualizer links (`flow.html`, `install-flow.html`) wired with subpath; mermaid blocks render as `td-diagram--mermaid` on architecture (2) and api-key-security (2); landing has 8 cards all pointing at live guide URLs.
- **Prose density**: 23/25 pages ≥0.85 (2 low pages traced: request-deepdive's flagged "MISS" sentence survives inside a callout body; maaspal's ratio is image-driven, no text loss).
