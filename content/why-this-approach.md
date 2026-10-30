---
title: Why this approach
description: What this prototype intends, copied from the MaaS guide, changed, and why.
weight: 30
icon: fa-solid fa-lightbulb
menus:
  main:
    identifier: why
    weight: 30
---

This prototype is the example of what future field guides should be. It emulates the [RHOAI MaaS guide](https://rh-aiservices-bu.github.io/rhoai-maas-guide/modules/main/index.html)'s high-level approach with deliberate divergences.

## Copied from the MaaS guide

- **Status-gate discipline** — every command is followed by a verify command and literal expected output (see [Set up](field-guides/hello-world/set-up/)).
- **Known issues where the reader hits them** — symptom, diagnosis, workaround, tracker id (see [Things that broke](field-guides/hello-world/things-that-broke/)).
- **PR-linked changelog culture** and **version honesty** ("orientation, not a support statement").

## Changed on purpose

- **Markdown over AsciiDoc** — Hugo + Markdown, not Antora.
- **Dual consumption built in** — every page renders as HTML for humans and as markdown for AI agents: the page action menu offers *Copy markdown*, *View markdown*, and *Open in Claude/ChatGPT*; the whole guide is also available as `llms.txt`.
- **Persistent display options** — a header selector (ops mode: GitOps / ClicOps / both; guide version: 3.4 / 3.6) filters content and remembers the choice in `localStorage` across pages and visits. No re-choosing, no site forks — the MaaS guide's tabs idea, generalized.
- **Chronological guides** — each guide walks the field-work timeline: set up → operate → things that broke, instead of numbered deployment phases.

## Serving humans and AI agents

Field guides are read by humans or consumed by AI agents; they have to serve both. In this prototype:

- Humans get the styled HTML with the header selector and search.
- AI agents get the per-page markdown (the page action menu's *View markdown*), the site's `llms.txt`, and the print bundle — all of which carry every variant, labeled, because only the interactive HTML filters content.

## Search

The site search indexes every guide (`offline_search`), reached with `/` or the navbar search box.

## Google Analytics

GA4 is wired via the standard Hugo services config with a placeholder measurement ID; a real ID lands before real traffic.
