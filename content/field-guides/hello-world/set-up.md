---
title: Set up
description: One command that changes the system — prerequisites, procedure, verification, rollback.
weight: 10
icon: fa-solid fa-play
---

Every procedure leads with the outcome, states what must be true before starting, and closes with verification and rollback.

{{< variant mode both >}}
This guide's steps work for both ops modes; blocks below call out where GitOps and ClicOps differ.
{{< /variant >}}

## Prerequisites

- Access to the target system (cluster-admin or equivalent).
- Tooling the procedure needs.

## Procedure

1. Run the setup command and confirm the output matches the expected output below.
2. Apply the change.

{{< variant mode gitops >}}
Apply via GitOps (manifests under `manifests/hello-world/`):

```sh
oc apply -k manifests/hello-world/
```
{{< /variant >}}

{{< variant mode clicops >}}
Apply via ClicOps:

```sh
clicops apply hello-world
```
{{< /variant >}}

{{< variant version 3.6 >}}
On **3.6**, the prototype default, use the commands above as-is.
{{< /variant >}}

{{< variant version 3.4 >}}
On **3.4**, pass `--api-version=v1beta1` — the 3.6 API default changed.
{{< /variant >}}

## Verification

Confirm the resource reports Ready:

```sh
oc wait --for=condition=Ready hello/hello-world --timeout=120s
```

Expected output:

```sh
hello.hello.example.com/hello-world condition met
```

## Rollback

{{< variant mode gitops >}}
Revert the manifest commit; the cluster converges back.
{{< /variant >}}

{{< variant mode clicops >}}
Run `clicops rollback hello-world`.
{{< /variant >}}

> [!WARNING]
> Rollback mid-flight leaves the resource half-applied — re-run the procedure from step 1 after rollback.
