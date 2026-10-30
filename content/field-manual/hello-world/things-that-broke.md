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

> [!IMPORTANT]
> When a real field manual ships, each known issue carries its tracker id (Jira/KCS) inline, like the MaaS guide's RHOAIENG blocks.
