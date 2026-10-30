# MaaS Guide Review — approach, questions, divergence slots

**Source:** [rhoai-maas-guide](https://rh-aiservices-bu.github.io/rhoai-maas-guide/modules/main/index.html) — scouted 2026-10-30 (14 pages, sitemap.xml, 404.html, changelog, raw HTML head/nav).
**Local site:** CAI-Field-Manual-prototype — Hugo + oink, one exemplar section, one sample page.
**Purpose of this doc:** what the MaaS guide does, which traits are worth emulating here, open questions, and blank slots for deliberate divergences. Answer inline in §4/§5 or in chat.

---

## 1. What the MaaS guide is

- **Antora 3.1.15 + AsciiDoc**, custom Red Hat-flavored UI, deployed to GitHub Pages; content and build live in one repo (`rh-aiservices-bu/rhoai-maas-guide`). Not docsify, not Hugo.
- **Single component, single version** — component `modules`, version `main`, page URLs `modules/main/<page>.html` — 26 flat HTML pages, 10 collapsible nav groups, max depth 2 (group → page).
- **Audience:** cluster admins deploying RHOAI 3.4/3.5 MaaS on OpenShift (everything assumes cluster-admin), plus demo presenters.
- **Search:** antora-lunr extension — client-side index built at build time, results grouped by page with section deep links.
- **Changelog culture:** monthly changelog page where every entry links the PR that made the doc change.

## 2. The approach, trait by trait

| # | Trait | What the MaaS guide does |
|---|---|---|
| 1 | **Phase-first IA** | Content organized as numbered deployment phases (00–12), one flat page per phase; letter-suffixed insert pages (`08b-request-deepdive`, `08c-api-key-security`, …) bolt reference deep-dives next to the parent phase without renumbering anything. |
| 2 | **Status-gate discipline as doctrine** | Every `oc apply -k manifests/<NN-…>/` is followed by `oc wait --for=condition=… --timeout=…` plus an explicit "the ordering matters because later resources depend on earlier ones" rationale. The landing page leads with this: "Kustomize manifests with status gates between every phase". |
| 3 | **Dual manual + automated path** | Every phase documents manual `oc` steps *and* a script (`setup-maas.sh --from-phase N`, `verify.sh`, per-phase convenience scripts). Script flags documented in tables; idempotency/state-detection described ("Phase 0 inspects the cluster and skips completed phases"). |
| 4 | **Known issues where you hit them** | Field failures documented inline as titled admonition blocks — bolded title (`**Gateway Pod OOMKill**`, `**HuggingFace Xet Download Hang**`), symptoms, diagnosis commands, workaround, Jira/KCS id (RHOAIENG-71638, KCS 7144055…). Plus the monthly PR-linked changelog and a contributors table. |
| 5 | **Version honesty framing** | "Orientation only, this is not a support statement" notes table pointing at the authoritative supported-configs matrix. RHOAI 3.4 vs 3.5 divergence handled in-page with tabs blocks and script auto-detection — one version of the site, no forks. |
| 6 | **Boilerplate repetition over DRY** | The repo-root notice ("all paths and `oc apply` commands are relative to the repo root") and the official-docs disclaimer are duplicated verbatim on every page. Expected outputs are literal current terminal values with "as of" caveats, not abstracted. |
| 7 | **Overview landing, not hero** | `index.html` is a working overview: one-line purpose, 3 bullets (kustomize+status gates / single automation script / CPU-only simulator), prerequisite line, then **Phases as grouped tables** by category with per-phase time estimates ("30-60 min"), an Available Models matrix (GPU/VRAM/use-case), and a documentation link list. |
| 8 | **AI-agent surface as product** | Skills (`/install-maas`, `/verify-guide`) documented as a Tools guide page with its own phases table; `/verify-guide` validates that documented AsciiDoc commands produce the documented output against a live cluster — docs and verification tooling co-evolve in one repo. |

**Don't copy:** the `siteUrl` misconfiguration — canonical links and sitemap `<loc>`s point at `github.com/…` and the bare site root serves a noindex redirect page instead of a landing. Our `hugo.yaml` `baseURL` is already correct; keep it.

## 3. How our site differs today (facts)

| Dimension | MaaS guide | Field Manual today |
|---|---|---|
| Tooling | Antora 3.1.15, AsciiDoc, custom UI | Hugo + oink theme (`github.com/pgsty/oink` v1.4.0), Markdown, Go module, no Node |
| IA | Numbered phases, flat file-per-page, depth 2 | `type: docs` sidebar (`sidebar_root_for: self`), framed by how work arrives (new setups / day-two / broke), one sample page |
| Landing | Overview + phase tables + time estimates | Hero + cards + CTA (`data/home.yaml`) |
| Verification doctrine | Status gate + literal expected output after every command; dedicated verify script | `## Verification` section stub in `sample.md` |
| Known-issue tracking | Inline titled blocks + Jira ids + PR-linked changelog page | None |
| Search | antora-lunr, section deep links | oink `offline_search: true` |
| Machine-readable outputs | HTML only | HTML + markdown + LLMS outputs (`hugo.yaml` outputs: `home: [HTML, RSS, markdown, LLMS]`) |

**Porting notes (Antora-ism → Hugo equivalent):**
- Admonition tables → oink already renders `> [!TIP]`-style callouts (`sample.md` uses them); important/note/warning map the same way.
- Titled troubleshooting blocks → callout with a bolded first line; no theme change needed.
- AsciiDoc tabs blocks (version divergence in-page) → needs an oink-side equivalent (shortcode or `<details>`); unverified — flagging, not asserting.
- Letter-suffix insert pages → just more `content/docs/` pages with explicit `weight:`; nothing to install.
- Time estimates + phase tables on the landing → more entries in `data/home.yaml` cards or a new section.

## 4. Questions (answer inline or in chat)

**Information architecture**
- **Q1** — Adopt phase-first numbered IA (`00-prerequisites.md`, `01-setup.md`, …) for the manual, keep the current task-type framing (setups / day-two / broke), or hybrid (numbered sections inside task groups)?
- **Q2** — Max depth: MaaS guide is flat (group → page, depth 2). Keep our foldable sidebar at depth 2 too, or do you want deeper nesting anywhere?

**Content doctrine**
- **Q3** — Make status-gate discipline a hard rule here (every command followed by a verify command + literal expected output), or only in `## Procedure`/`## Verification` sections?
- **Q4** — Dual path: do we have (or plan) automation scripts to document alongside manual steps, or is this manual-only for now?
- **Q5** — Per-phase time estimates on the landing/index — worth adding?

**Tracking & honesty**
- **Q6** — Inline known-issue blocks with Jira/KCS ids, and a PR-linked changelog page — adopt both, one, or neither?
- **Q7** — "Orientation only, not a support statement" framing pointing at the official supported-configs matrix — adopt? (Our analog: RHOAI 3.5 tutorials context.)

**Landing & tooling**
- **Q8** — Landing: keep hero + cards, or move toward the MaaS overview style (purpose line → grouped tables)? Or hero up top + phase tables below?
- **Q9** — Tooling fork: I assume we stay Hugo + oink (the repo is built for it, and all 8 traits above are tooling-independent). Confirm, or is Antora actually on the table?
- **Q10** — Document an AI-agent surface as a Tools page (skills like `/verify-guide` analogs)? We already have verification tooling conventions in this repo.

## 5. Divergence slots (fill in)

For each trait: **copy** (as-is), **change** (copy but differ — say how), or **skip**.

| Trait | Stance | Your divergence (2026-10-30) |
|---|---|---|
| 1 Phase-first IA | change | Chronological page order inside each guide (setup → day-two ops → broke), not numbered deployment phases; each guide is its own section with its own left nav. |
| 2 Status-gate discipline | copy | Every command in a field guide is followed by a verify command and literal expected output. |
| 3 Dual manual + automated path | change | Dual consumption = human HTML **and** AI-consumable markdown (`have Claude read this` deep link, copy-as-markdown, per-page `.md`, `llms.txt`) — not manual vs scripted installs. |
| 4 Known issues inline + changelog | copy | Inline titled known-issue blocks; PR-linked changelog adopted. |
| 5 Version honesty framing | change | Version divergence handled by a persistent selector at the top of every guide page (version + ops mode), remembered across pages via localStorage — not tabs, not site forks. |
| 6 Boilerplate repetition | change | Markdown over AsciiDoc; no verbatim per-page boilerplate — shared chrome (variant selector) lives at the top of the page. |
| 7 Overview landing | change | Hero + cards landing listing all field guides as cards; phase tables with time estimates adopted when guides exist. |
| 8 AI-agent surface | copy | AI-agent affordances documented as a Tools page. |

**Free-form divergences** — anything the MaaS guide doesn't do that you want here (decided 2026-10-30):
- **Google Analytics 4** on the rendered pages (wired with placeholder measurement ID until a real one exists).
- **Hello-world blank field guide** — the prototype ships a copyable blank guide skeleton in `content/field-guides/hello-world/`, demonstrating every convention (variant selector, customize page, chronological nav, verification, AI links) without real field content.
- **Customize this! page** — one page sets every remembered choice (ops mode, guide version, reader name, cluster); the name and cluster substitute into `customize` tokens in every guide's commands.
---

*Scout evidence: 14 pages fetched across all nav groups, plus sitemap, 404, raw HTML head/nav, and changelog. Tooling verdict from `<meta name="generator" content="Antora 3.1.15">` and AsciiDoc markup signatures (`admonitionblock`, `sect1`, `#_` auto-ids).*

