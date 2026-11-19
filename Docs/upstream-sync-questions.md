# Upstream sync f090e3f → fa34c69 — questions & choices

Recorded during the Nov 18 2026 sync that brought this repo in line with `rhoai-maas-guide` `fa34c69` (PRs #204–#208). The sync itself is commits `196607b` → (this sync). This file is not the repo's work backlog — see `Docs/backlog.md` for that.

## 1. Upstream README callout not ported to our README

- **What changed upstream:** In #205 the upstream `README.md` gained a `> **RHCL 1.5:** …` callout linking to the new `14-rhcl-15.adoc` page.
- **Decision:** Did not add it to this repo's `README.md`. Our `README.md` intentionally diverges from upstream — it points at this repo's rendered Hugo site (`CAI-Field-Manual-MaaS`) and has no OpenShift 5 callout either. Instead, the RHCL 1.5 callout was converted to a `> [!NOTE]` block on `content/maas/_index.md`, mirroring commit `196607b`'s treatment of the OpenShift 5 callout.
- **Reversible:** Add the same callout to `README.md` if README parity is wanted:
  `> **RHCL 1.5:** MaaS on RHOAI 3.5.2 was validated with RHCL 1.5.0 and the GA MCP Gateway on the same cluster. See [Running MaaS with RHCL 1.5](https://rh-aiservices-bu.github.io/CAI-Field-Manual-MaaS/guide/rhcl-15/) for the fixes it needs.`

## 2. 3.6 EA2 upgrade page skipped (net zero at upstream HEAD)

- **What happened upstream:** #204 added a 1081-line `15-36-ea2.adoc` (Platform Upgrade 3.5 → 3.6 EA2), #206 hid it, #208 deleted it. Net content at `fa34c69` is zero for that page.
- **Decision:** Did not port it. The page was retracted within 5 days and does not appear at upstream HEAD.
- **Recoverable:** Last full text lives at upstream commit `9cee080` (after #206's JIRA-link pass): `content/modules/ROOT/pages/15-36-ea2.adoc` at `9cee080`. To resurrect it, convert that file to Hugo Markdown following the same conventions as `content/maas/rhcl-15.md` (front matter weight between 95 and 100, GitHub-style admonitions, `relref` rewrites, macro expansions).

## 3. Page filename and weight

- **Decision:** `content/maas/rhcl-15.md`, `weight: 96`. The numeric prefix (`14-`) was dropped, matching `13-openshift5` → `openshift5.md`. Weight 96 places it after `openshift5.md` (95) and before `maas/reference/_index.md` (100), mirroring upstream nav order: OpenShift 5 → RHCL 1.5 → Reference. No collision — verified no other page used 96.
- **Reversible:** If a future upstream page claims this position, adjust weights to maintain nav order (next free slot between 95 and 100).

## 4. JIRA links stay absolute

- **What exists:** The RHCL 1.5 page contains absolute JIRA links: `CONNLINK-1913`, `RHOAIENG-103137`, `RHOAIENG-103136`, `CONNLINK-1976`, `CONNLINK-1878`, `CONNLINK-1713`, `CONNLINK-1886`, `CONNLINK-1973`, `RHOAIENG-98735` (all `redhat.atlassian.net/browse/...`). The upstream source also has `CONNLINK-1973` and `CONNLINK-1976` added/tweaked by #207.
- **Decision:** Kept absolute, no rewrites needed. These hosts were excluded from the 2026-11-02 link audit (bot-blocked) but were verified reachable from upstream.
- **Reversible:** If the JIRA host changes or links need proxying, rewrite them centrally (e.g. via a Hugo render hook for `redhat.atlassian.net`).

## 5. Conversion fidelity

- **Source:** `/tmp/rhoai-maas-guide-src/content/modules/ROOT/pages/14-rhcl-15.adoc` at `fa34c69` (281 lines, includes #207's JIRA links). Template: `content/maas/openshift5.md` converted by commit `196607b`.
- **Known divergence:** The diagnosis sentence for Issue 1 was truncated in the read window (`"No annotation means no Secret, an…"`). It was completed from `git show 001f127:content/modules/ROOT/pages/14-rhcl-15.adoc:138` as `"No annotation means no Secret, and Authorino's TLS listener never starts:"`. Verified against the raw commit content.
- **No literal AsciiDoc survives** outside shell snippets (`grep -nE 'xref:|\^]|\{[a-z-]+\}'` clean except for jsonpath `{end}` inside fences, which is legitimate shell).

## 6. Script sync

- **Source:** `/tmp/rhoai-maas-guide-src/scripts/setup-maas.sh` at `fa34c69` (1902 lines). This repo's `scripts/setup-maas.sh` at HEAD `b89f454` was byte-identical to upstream `f090e3f` (1862 lines, verified with `cmp`), so the sync is a verbatim `cp`.
- **Net effect (+40 lines, 2 hunks):** Phase 1 leaves an existing Subscription untouched instead of re-applying the checked-in channel; Phase 3 re-annotates `authorino-authorino-authorization` with `service.beta.openshift.io/serving-cert-secret-name=authorino-server-cert` when the RHCL 1.5 Authorino operator drops it, waits up to 120s for the `authorino-server-cert` Secret, restarts the Authorino deployment, and fails with `log_error` if the Secret never appears. Fixes `AuthorinoNotReady` → API key 500s on RHCL 1.5 (RHOAIENG-103136, CONNLINK-1976).
- **Other vendored code:** `manifests/` and `demo/` already byte-identical to upstream `fa34c69` (12 files `cmp` SAME) — not touched.
