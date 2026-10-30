---
title: Set up
description: One command that changes the system — prerequisites, procedure, verification, rollback.
weight: 10
icon: fa-solid fa-play
---

Every procedure leads with the outcome, states what must be true before starting, and closes with verification and rollback.

{{< variant mode all >}}
This manual's steps work the same in every ops mode — GitOps, Manual, and Scripted; the blocks below call out where they differ.
{{< /variant >}}

## Prerequisites

- Access to the target system (cluster-admin or equivalent).
- Tooling the procedure needs.
- Your cluster's API endpoint, e.g. `api{{< customize cluster >}}`, and a username (default: {{< customize user >}}).

## Procedure

1. Log in to the cluster:

```sh
oc login --username={{< customize user >}} --server=api{{< customize cluster >}}
```

2. Run the setup command and confirm the output matches the expected output below.
3. Apply the change.

{{< variant mode gitops >}}
Apply via GitOps (manifests under `manifests/hello-world/`):

```sh
oc apply -k manifests/hello-world/
```
{{< /variant >}}

{{< variant mode manual >}}
Apply from the web console: **Ecosystem → Installed Operators → Hello World → Create instance**, filling each field from the prerequisites above.
{{< /variant >}}

{{< variant mode scripted >}}
Apply with the deployment script (idempotent — safe to re-run):

```sh
./scripts/apply-hello-world.sh
```
{{< /variant >}}

{{< variant version "3.5 3.6" >}}
On **3.5 and 3.6**, the prototype default, use the commands above as-is.
{{< /variant >}}

{{< variant version 3.4 >}}
On **3.4**, pass `--api-version=v1beta1` — the API default changed in 3.5.
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

{{< variant mode manual >}}
Delete the instance from the web console; the operator removes the resources it created.
{{< /variant >}}

{{< variant mode scripted >}}
Run the rollback script:

```sh
./scripts/rollback-hello-world.sh
```
{{< /variant >}}

> [!WARNING]
> Rollback mid-flight leaves the resource half-applied — re-run the procedure from step 1 after rollback.

Why this shape? See [Conventions and intent]({{< relref "/writing-the-field-manual/conventions" >}}).
