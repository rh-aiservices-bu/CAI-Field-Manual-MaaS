---
title: Automated Setup
description: "setup-maas.sh is a single script that handles the entire MaaS lifecycle, from operator installation through model deployment and verification."
weight: 20
---

`setup-maas.sh` is a single script that handles the entire MaaS lifecycle, from operator installation through model deployment and verification. Each phase is idempotent; re-running skips what's already done.

> [!IMPORTANT]
> This guide is not a replacement for the official Red Hat OpenShift AI Models as a Service documentation ([3.5](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/govern_llm_access_with_models-as-a-service/index) | [3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/govern_llm_access_with_models-as-a-service/index)). It is a companion resource with opinionated Kustomize manifests and automation scripts to accelerate deployment.

## Clone and Run

```sh
git clone https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS.git
cd CAI-Field-Manual-MaaS
```

{{< variant version "3.5 3.6" >}}
```sh
./scripts/setup-maas.sh
```
{{< /variant >}}

{{< variant version 3.4 >}}
```sh
./scripts/setup-maas.sh --rhoai-version 3.4
```
{{< /variant >}}

This runs Phases 0-6 automatically. The script detects what's already installed and skips completed phases.

## Arguments

| Option | Description | Default |
| --- | --- | --- |
| `--model <name>` | Model to deploy: `simulator` (CPU), `granite-tiny-gpu` (small GPU), `gemma` (mid GPU), `gpt-oss-20b` (large GPU), `qwen3-06b` (real CPU, no GPU), `auto` (auto-detect by GPU VRAM) | `auto` |
| `--rhoai-version <v>` | RHOAI version: `3.4` or `3.5`. Auto-detects if already installed. | `3.5` |
| `--from-phase <N>` | Start from phase N (0-8), skipping earlier phases | `0` |
| `--skip-models` | Skip Phase 5 (model deployment) |  |
| `--skip-verify` | Skip Phase 6 (verification) |  |
| `--with-observability` | Also run Phase 7 (COO + Gateway telemetry) |  |
| `--with-external-models` | Also run Phase 8 (ExternalModel deployment via OpenAI, Gemini, or Bedrock) |  |
| `--dry-run` | Preview what would be applied without making changes |  |

## Phases

| Phase | What it does | Time |
| --- | --- | --- |
| 0 | Preflight - detect cluster state, decide which phases to run | instant |
| 1 | Operators - `oc apply -k manifests/01-prerequisites/operators/`, wait for CSVs | 2-5 min |
| 2 | Platform - Kuadrant, UWM, GatewayClass, envsubst Gateway | 2-5 min |
| 3 | MaaS Platform - PostgreSQL secrets/deployment | 2-3 min |
| 4 | RHOAI - DSC with modelsAsService: Managed, Dashboard flags, wait for maas-api | 3-5 min |
| 5 | Model - auto-detect GPU, apply Kustomize, wait for Ready | 0.5-15 min |
| 6 | Verify - 6-phase E2E (API, auth, rate limits, cleanup) | 3-5 min |
| 7 | Observability - COO subscription + Gateway TelemetryPolicy | 2-3 min |
| 8 | External Models - ExternalModel CRs + MaaS governance (only with `--with-external-models`) | 5-10 min |

## Common Usage Patterns

### Full installation (recommended)

For a fresh cluster with no MaaS components:

```sh
./scripts/setup-maas.sh
```

### With observability

```sh
./scripts/setup-maas.sh --with-observability
```

### Resume from a specific phase

If a previous run failed at Phase 4:

```sh
./scripts/setup-maas.sh --from-phase 4
```

### Models only

If the platform is already installed and you just want to deploy a model:

```sh
./scripts/setup-maas.sh --from-phase 5
```

Or use the standalone model script for more control:

```sh
./scripts/deploy-model.sh --model simulator
```

### With external OIDC authentication

After the base installation, add Keycloak-based OIDC authentication so users can access MaaS with their corporate credentials instead of OpenShift tokens:

```sh
# Deploy Keycloak + configure MaaS for OIDC
./manifests/09-external-oidc/setup-keycloak.sh

# Verify the OIDC flow (tokens, API keys, inference, group access)
./manifests/09-external-oidc/test-external-oidc.sh
```

See [Phase 9: External OIDC Authentication]({{< relref "guide/external-oidc" >}}) for the full manual walkthrough and Bring Your Own IdP instructions.

### Verify only

```sh
./scripts/setup-maas.sh --from-phase 6
```

Or directly:

```sh
./manifests/06-verification/verify.sh
```

## Convenience Scripts

These wrap individual phases for standalone use:

| Script | What it does |
| --- | --- |
| `scripts/deploy-model.sh` | Phase 5 only - deploy a model with GPU auto-detection |
| `scripts/test-inference.sh` | Send inference requests to a deployed model endpoint |
| `scripts/verify-maas.sh` | Phase 6 only - wrapper for `manifests/06-verification/verify.sh` |
| `manifests/09-external-oidc/setup-keycloak.sh` | Phase 9 - deploy Keycloak + configure OIDC on the MaaS tenant (`--cleanup` to revert) |
| `manifests/09-external-oidc/test-external-oidc.sh` | Phase 9 verification - 6-test OIDC flow (tokens, API keys, inference, group access) |

## State Detection

Phase 0 inspects the cluster and reports what's already installed. The script uses this to skip completed phases:

* Operators installed? Skip Phase 1.
* Kuadrant + UWM + Gateway ready? Skip Phase 2.
* PostgreSQL running? Skip Phase 3.
* DSC with modelsAsService: Managed + maas-api running? Skip Phase 4.
* Models deployed in llm namespace? Skip Phase 5.

Override with `--from-phase N` to force re-running from a specific phase.

## AI-Assisted Installation

If you use an AI coding tool ([Claude Code](https://claude.ai/code), [Open Code](https://opencode.ai), [Cursor](https://cursor.com), [Roo Code](https://roocode.com)), the `/install-maas` skill wraps the same script with an interactive, AI-assisted workflow. Clone the repo, open it in your tool, and run:

```text
/install-maas
```

Or with arguments:

```text
/install-maas --model simulator --with-observability
```

See [AI-Assisted Installation]({{< relref "guide/claude-code" >}}) for details.

## Final Report

The script ends with a summary: RHOAI version, MaaS API URL, Gateway status, health check, deployed models, and suggested next steps.
