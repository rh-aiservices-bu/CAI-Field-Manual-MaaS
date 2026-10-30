---
title: Operate
description: Day-two routine checks — health, drift, escalation.
weight: 20
icon: fa-solid fa-gauge-high
---

What an operator does on a normal day: confirm health, watch for drift, and know when to escalate.

{{< variant version 3.4 >}}
On **3.4**, the health endpoint is `/healthz` instead of `/readyz`.
{{< /variant >}}

## Procedure

1. Check resource health:

```sh
oc get hello hello-world
```

2. Confirm the reported condition is `Ready`.
3. If not Ready, go to [Things that broke]({{< relref "things-that-broke" >}}).

> [!TIP]
> The header selector at the top filters this guide: pick GitOps or ClicOps, 3.4 or 3.6 — the choice persists across pages and visits.
