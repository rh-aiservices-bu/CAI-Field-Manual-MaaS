---
title: Customize this!
description: Set the choices this manual remembers — RHAIE version, ops mode, your name, your cluster.
weight: 40
icon: fa-solid fa-sliders
---

Make this manual yours. Every choice below persists in `localStorage` across pages, visits, and tabs — set them once and every manual substitutes them everywhere.

{{< customize-form >}}

## What each choice does

- **RHAIE Version** — filters version-specific notes: pick 3.4, 3.5, or 3.6, or *Show all* to read every version's notes together.
- **Ops Mode** — filters procedure blocks: GitOps, Manual, and Scripted steps differ (see [Set up](set-up/)); *Show all* keeps every mode visible.
- **Your name** — substitutes into login commands: `oc login --username={{< customize user >}} …`
- **Cluster** — substitutes into every cluster-scoped command: `oc login --server=api{{< customize cluster >}} …`

## Resetting

Clear the site's storage to return to the shipped defaults (guest, `.ocp.abcd.sandbox1234.opentlc.com`, Show all, 3.6) — or just re-set each control above.
