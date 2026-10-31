---
title: Demos
description: Hands-on walkthroughs that go deeper on the subscription, access control, and authentication topics covered in Phase 5 and Phase 9.
weight: 10
---

Hands-on walkthroughs that go deeper on the subscription, access control, and authentication topics covered in [Phase 5]({{< relref "guide/model-deployment/maas-models" >}}) and [Phase 9]({{< relref "guide/external-oidc" >}}). Each scenario has setup/run/cleanup scripts and a presenter talk track.

## Prerequisites

* Complete the guide through [Phase 5]({{< relref "guide/model-deployment/maas-models" >}}) with at least the simulator model deployed
* For the OIDC, JWKS Cache, and Subscription Priority demos, also complete [Phase 9]({{< relref "guide/external-oidc" >}}) (they use Keycloak identities)

Deploy the simulator if not already done:

```sh
./scripts/setup-maas.sh --model simulator
```

## Preflight Check

Before presenting, run the preflight script to verify all demos are ready (it creates nothing and applies no YAML):

```sh
./demo/preflight.sh
```

Expected result: 16 passed, 0 failed. The script also warms up `maas-api` to absorb its cold-start 500.

## Subscriptions & Access (Phase 5)

| Demo | What it shows | Link |
| --- | --- | --- |
| User-Level Rate Limiting | Assign MaaSSubscription tiers to groups and individual users. Shows how `priority` resolves overlaps when a user belongs to multiple groups. | [README](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS/tree/main/demo/user-level-rate-limiting) |
| Subscription Priority | Proves entitlement is selected, not accumulated. A user in two groups gets the higher-priority tier, not the sum. Per-user subscriptions can cap below group tiers. _Requires [Phase 9]({{< relref "guide/external-oidc" >}}) (Keycloak)._ | [README](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS/tree/main/demo/subscription-priority) |
| Service Account Access | In-cluster workload calls a model with its ServiceAccount token via TokenReview. No API key or secret needed. Access per namespace, rate limits per workload. | [README](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS/tree/main/demo/service-account-access) |
| Corporate Scenario | Division-level model governance: three divisions (Sales, Engineering, Products), on-prem + cloud models, differentiated access and rate limits. Demonstrates the full CIO-to-deployment policy lifecycle. **Recommended starting point for enterprise demos.** | [Full Guide]({{< relref "guide/demos/corporate-scenario" >}}) / [Scripts](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS/tree/main/demo/corporate-scenario) |

## OIDC & Token Validation (Phase 9)

| Demo | What it shows | Link |
| --- | --- | --- |
| OIDC Authentication | Authenticate users from an external OIDC provider (Keycloak) who have no OpenShift account. The `groups` claim in the token selects the subscription. Includes a click-through UI and CLI sample client. | [README](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS/tree/main/demo/oidc-authentication) |
| JWKS Cache | Proves JWT signatures are verified locally from a cached JWKS, not per-request to the IdP. Blocks Authorino from reaching Keycloak and shows validation still succeeds. | [README](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS/tree/main/demo/jwks-cache) |

## Demo Structure

Every demo follows the same pattern:

```text
demo/<name>/
  setup-demo.sh      # Create users, subscriptions, auth policies
  run-demo.sh        # Repeatable runbook (read-only, safe to re-run)
  cleanup-demo.sh    # Tear down demo-specific resources
  README.md          # Full walkthrough with talk track and expected output
```

> [!TIP]
> The READMEs document three edge-case behaviors found during demo development: an identity matching two subscriptions gets 403 on the direct-token path, a token with no `groups` claim fails with an opaque `AUTH_FAILURE`, and split-horizon DNS can produce a false pass in the JWKS caching proof if you block the wrong address.
