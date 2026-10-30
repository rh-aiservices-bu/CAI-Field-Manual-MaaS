---
title: Annotated examples
description: Each convention in source form — the markup, a wrong way, and the right way.
icon: fa-solid fa-code
weight: 20
---

Each convention from [Conventions and intent](conventions/) in source form: the markup first, then a wrong way and a right way. Snippets are literal source — shortcodes are escaped with Hugo's `*/*` comment form so they print as text instead of executing.

## Chronological information architecture

The nav order is each page's `weight` in front matter, set along the timeline:

```markdown
---
title: Set up
weight: 10
---
```

`operate.md` carries `weight: 20` and `things-that-broke.md` carries `weight: 30`, so the left nav reads set up → operate → things that broke.

**Wrong:**

```markdown
---
title: Validate the deployment
weight: 30
---
```

A phase page named for the install route — the reader loses the operator's timeline and cannot tell where a day-two check lives.

**Right:**

```markdown
---
title: Operate
weight: 20
---
```

Named for the stage of field work the page covers, so the nav matches the moment the reader is in.

## Status-gate verification

The gate: a verify command and its literal expected output, right after the command it checks.

````markdown
Confirm the resource reports Ready:

```sh
oc wait --for=condition=Ready hello/hello-world --timeout=120s
```

Expected output:

```sh
hello.hello.example.com/hello-world condition met
```
````

**Wrong:**

```sh
oc apply -k manifests/hello-world/
```

Applied with no gate — a half-applied change reads as success, and the failure surfaces two steps later, away from its cause.

**Right:**

````markdown
```sh
oc apply -k manifests/hello-world/ && \
oc wait --for=condition=Ready hello/hello-world --timeout=120s
# expect: hello.hello.example.com/hello-world condition met
```
````

The step cannot pass silently — the expected output is part of the step.

## Inline known issues

The block, placed on the page where the reader hits it:

```markdown
## Known issue: hello-world pod OOMKill

**Symptom.** The pod restarts with reason `OOMKilled`.

**Diagnosis.** `oc describe pod hello-world | grep -A3 "Last State"`

**Workaround.** Raise the memory limit in `manifests/hello-world/` and re-apply. (RHOAIENG-0000)
```

**Wrong:**

```markdown
Known issues are collected on the [known-issues](../known-issues/) page.
```

A pointer out of the page — the reader mid-procedure loses their place and, usually, the workaround.

**Right:**

```markdown
**Symptom.** The pod restarts with reason `OOMKilled`.
**Diagnosis.** `oc describe pod hello-world | grep -A3 "Last State"`
**Workaround.** Raise the memory limit and re-apply. (RHOAIENG-0000)
```

Symptom, diagnosis, workaround, tracker id — all on the page where the pod restarts.

## Variant selector axes

A variant block — filtered in the HTML by the page-top selector, labeled in the markdown output:

````markdown
{{</* variant mode gitops */>}}
Apply via GitOps (manifests under `manifests/hello-world/`):

```sh
oc apply -k manifests/hello-world/
```
{{</* /variant */>}}
````

**Wrong:**

```sh
oc apply -k manifests/hello-world/   # GitOps only
```

One mode's commands shipped to every reader — the other modes lose their path, and per-mode copies of the page drift apart instead.

**Right:**

````markdown
{{</* variant mode manual */>}}
Apply from the web console: **Ecosystem → Installed Operators → Hello World → Create instance**.
{{</* /variant */>}}
````

Every mode gets its own block on the same page; the selector filters, the label describes.

## Customize tokens

Tokens in a command, with the shipped default stated where the reader sets it:

````markdown
- Your cluster's API endpoint, e.g. `api{{</* customize cluster */>}}`, and a
  username (default: {{</* customize user */>}}).
````

**Wrong:**

```sh
oc login --username=guest --server=api.ocp.abcd.sandbox1234.opentlc.com
```

One environment's values baked into the command — every other reader hand-edits, and hand-edits are where wrong clusters and typos come from.

**Right:**

````markdown
```sh
oc login --username={{</* customize user */>}} --server=api{{</* customize cluster */>}}
```
````

The reader's own values substitute everywhere once they set them; the default carries the reader who has not set anything.

## Dual consumption

The block that survives flattening: the prose restates the axis and the value, so the markdown-only reader — who gets the block labeled but every page merged — still knows what applies when.

````markdown
{{</* variant version 3.4 */>}}
On **3.4**, the health endpoint is `/healthz` instead of `/readyz`.
{{</* /variant */>}}
````

**Wrong:**

```markdown
The health endpoint is `/healthz`.
```

Shipped unlabeled into the merged markdown — the reader, and any agent, cannot tell which version the sentence describes.

**Right:**

````markdown
{{</* variant version 3.4 */>}}
On **3.4**, the health endpoint is `/healthz` instead of `/readyz`.
{{</* /variant */>}}
````

The sentence carries its own condition; the markdown output labels the block, the prose does the rest.

Ready to write yours? [Write your first manual](write-a-manual/).
