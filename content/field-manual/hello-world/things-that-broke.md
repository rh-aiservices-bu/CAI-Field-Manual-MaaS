---
title: Things that broke
description: Known issues, where the reader hits them — symptom, diagnosis, workaround.
weight: 30
icon: fa-solid fa-triangle-exclamation
---

Known issues live in the page where the reader hits them: symptom, diagnosis command, workaround, tracker id.

## Known issue: hello-world pod OOMKill

**Symptom.** The pod restarts with reason `OOMKilled`.

**Diagnosis.**

```sh
oc describe pod hello-world | grep -A3 "Last State"
```

**Workaround.** Raise the memory limit in `manifests/hello-world/` and re-apply.

**Tracker.** RHOAIENG-0001 (placeholder — real issues carry their Jira/KCS id here).

## Known issue: hello-world route 503 after rollout

**Symptom.** The route returns 503 right after a rollout.

**Diagnosis.**

```sh
oc get route hello-world
oc describe pod hello-world | grep -A3 "Last State"
```

**Workaround.** Wait for the rollout to finish, then retry the request.

**Tracker.** RHOAIENG-0000 (placeholder — real issues carry their Jira/KCS id here).

> [!TIP]
> The anatomy each known issue must carry is codified in [Conventions and intent]({{< relref "/writing-the-field-manual/conventions" >}}).
