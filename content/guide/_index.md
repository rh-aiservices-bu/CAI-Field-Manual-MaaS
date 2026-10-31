---
title: CAI Field Manual for MaaS
description: Deploy RHOAI 3.4/3.5 Models-as-a-Service on OpenShift 4.19+ — Kustomize manifests with status gates and a single automation script.
linkTitle: Guide
icon: fa-solid fa-book-open
outputs: [HTML, RSS, print, markdown, LLMSFULL]
cascade:
  type: docs
  footer_style: slim
---

Guide to deploy Red Hat OpenShift AI 3.4 / 3.5 Models as a Service on OpenShift.

* Kustomize manifests with status gates between every phase
* Single automation script for end-to-end deployment
* CPU-only simulator model for validation without GPUs

Requires OpenShift 4.19+ with cluster-admin access.

> [!IMPORTANT]
> This guide is not a replacement for the official Red Hat OpenShift AI Models as a Service documentation ([3.5](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/govern_llm_access_with_models-as-a-service/index) | [3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/govern_llm_access_with_models-as-a-service/index)). It is a companion resource with opinionated Kustomize manifests and automation scripts to accelerate deployment.

> [!NOTE]
> {{< visualizer file="visualizers/install-flow.html" label="Open the Install & Configuration Visualizer" >}} (opens in new tab)
> *4 Flows | 9 Phases | Governance Pairing | Tiers & Priority | 30+ Components*
> An animated, click-to-inspect walkthrough of the full install sequence, the most common ordering mistake, and how MaaSModelRef/MaaSAuthPolicy/MaaSSubscription pair up. Handy for explaining the moving parts to a customer before you touch a cluster.

## Getting Started

Clone the repository and work from its root directory. All commands and file paths in this guide are relative to the cloned repo.

```sh
git clone https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS.git
cd CAI-Field-Manual-MaaS
```

You also need:

* OpenShift 4.19+ cluster with `oc` CLI authenticated as cluster-admin
* `envsubst`, `curl`, `jq` available on PATH

## Phases

Each phase has step-by-step instructions, status gates, and troubleshooting.

### Disconnected Setup

| Phase | Description | Time |
| --- | --- | --- |
| [0. Disconnected Setup]({{< relref "guide/disconnected" >}}) _(air-gapped only)_ | Mirror MaaS operators and images, ITMS for modelcars, WASM shim patch, GPU driver setup | 30-60 min |

### Installation Guide

| Phase | Description | Time |
| --- | --- | --- |
| [1. Prerequisites]({{< relref "guide/installation-guide/prerequisites" >}}) | Operator subscriptions (RHOAI, RHCL, cert-manager, LWS) | 5-10 min |
| [2. Platform Configuration]({{< relref "guide/installation-guide/platform-config" >}}) | Kuadrant/Authorino, User Workload Monitoring, GatewayClass, Gateway | 5-10 min |
| [3. MaaS Platform]({{< relref "guide/installation-guide/maas-platform" >}}) | PostgreSQL database and secrets | 5 min |
| [4. RHOAI Configuration]({{< relref "guide/installation-guide/rhoai-config" >}}) | DataScienceCluster, DSCInitialization, Dashboard settings | 5-10 min |

### Model Deployment & Verification

| Phase | Description | Time |
| --- | --- | --- |
| [5. Model Deployment]({{< relref "guide/model-deployment/maas-models" >}}) | Deploy and register LLM models with MaaS | 1-15 min |
| [6. Verification]({{< relref "guide/model-deployment/verification" >}}) | End-to-end checks (API keys, inference, rate limiting) | 5 min |

### Observability

| Phase | Description | Time |
| --- | --- | --- |
| [7. Observability]({{< relref "guide/observability" >}}) _(optional)_ | COO subscription + Gateway telemetry dashboards | 5 min |

### External Models

| Phase | Description | Time |
| --- | --- | --- |
| [8. External Models]({{< relref "guide/external-models" >}}) _(optional)_ | Expose third-party LLM APIs (OpenAI, Bedrock, Gemini) through the MaaS gateway | 5-10 min |

### External OIDC Authentication

| Phase | Description | Time |
| --- | --- | --- |
| [9. External OIDC Authentication]({{< relref "guide/external-oidc" >}}) _(optional)_ | Integrate MaaS with Keycloak or other OIDC providers for corporate authentication | 10-15 min |

## Automated Setup

For end-to-end deployment using a single script, see the [Automated Setup]({{< relref "guide/quick-start" >}}) page.

## Available Models

| Model | GPU Required | VRAM | Use Case |
| --- | --- | --- | --- |
| `simulator` | No | None | Testing/demo (CPU-only) |
| `granite-tiny-gpu` | Yes | ~8 GiB | Small GPU (L4, L40) |
| `gemma` | Yes | ~12 GiB | Mid GPU (L4, L40, L40S) |
| `gpt-oss-20b` | Yes | ~16 GiB | Large model, runs quantized (L4 24 GB, L40S, A100) |
| `qwen3-06b` | No | None (~16 GiB RAM) | Real CPU inference (no GPU needed) |

## Documentation

* [RHOAI 3.5 MaaS Official Docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/govern_llm_access_with_models-as-a-service/index)
* [RHOAI 3.4 MaaS Official Docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/govern_llm_access_with_models-as-a-service/index)
* [Upstream MaaS Documentation](https://opendatahub-io.github.io/models-as-a-service/latest/)
* [Upstream MaaS Architecture](https://opendatahub-io.github.io/models-as-a-service/latest/concepts/architecture/)
