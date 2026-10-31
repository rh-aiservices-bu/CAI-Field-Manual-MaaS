---
title: "Phase 6: MaaS Verification"
description: End-to-end verification of a MaaS deployment on OpenShift.
weight: 20
---

End-to-end verification of a MaaS (Models as a Service) deployment on OpenShift.

> [!TIP]
> All file paths and `oc apply` commands in this guide are relative to the [CAI-Field-Manual-MaaS](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS) repository root. Make sure you have cloned it and are working from its root directory (see [Getting Started]({{< relref "/guide#getting-started" >}})).

> [!IMPORTANT]
> This guide is not a replacement for the official Red Hat OpenShift AI Models as a Service documentation ([3.5](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/govern_llm_access_with_models-as-a-service/index) | [3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/govern_llm_access_with_models-as-a-service/index)). It is a companion resource with opinionated Kustomize manifests and automation scripts to accelerate deployment.

## What it tests

The `verify.sh` script runs 6 phases:

1. **Infrastructure health** - checks Gateway, PostgreSQL, maas-api, maas-controller, Authorino, DSC readiness, and the `/maas-api/health` endpoint.
2. **Deploy simulator model** - creates a temporary CPU-only simulator (LLMInferenceService, MaaSModelRef, MaaSAuthPolicy, MaaSSubscription) and waits for it to become Ready.
3. **API verification** - creates an API key, lists available models, and sends a chat completion inference request.
4. **Auth enforcement** - sends requests with no token and an invalid token, verifying both are rejected (HTTP 401/403).
5. **Rate limiting** - fires 16 rapid requests to trigger the 100 tokens/min rate limit and confirms HTTP 429 responses.
6. **Cleanup** - removes all temporary test resources (API key, MaaS CRs, simulator pods, namespaces if empty).

## Prerequisites

- MaaS platform installed on the cluster
- `oc` logged into the cluster (`oc whoami` succeeds)
- `curl`, `jq`, and `dig` available on PATH

## Usage

> [!NOTE]
> The verification script deploys a temporary simulator model and removes it during the cleanup phase. Resources that already existed before the run - such as a simulator you deployed in [Phase 5]({{< relref "/guide/model-deployment/maas-models" >}}) - are detected and kept. Use `--no-cleanup` to keep even the script's own test resources, and `--cleanup-only` to remove all test resources including a pre-existing simulator.

```sh
# Full verification (deploy, test, cleanup)
./manifests/06-verification/verify.sh

# Keep test resources after verification
./manifests/06-verification/verify.sh --no-cleanup

# Remove leftover test resources from a previous run
./manifests/06-verification/verify.sh --cleanup-only
```

## Expected output

When all checks pass, the script prints:

```text
=========================================
MaaS Verification Summary
=========================================
MaaS API URL:  https://maas.<cluster-domain>
Passed:        15
Failed:        0
Status:        ALL CHECKS PASSED
=========================================
```

The exit code is 0 on success and 1 if any check failed.

## Manual verification commands

If you prefer to verify each phase manually:

### Phase 1: Infrastructure health

{{< variant version "3.5 3.6" >}}

```sh
# Gateway
oc get gateway maas-default-gateway -n openshift-ingress \
  -o jsonpath='{.status.conditions[?(@.type=="Programmed")].status}'

# Core deployments (maas-api is in redhat-ai-gateway-infra on 3.5+)
oc get deployment postgres maas-controller -n redhat-ods-applications
oc get deployment maas-api -n redhat-ai-gateway-infra

# Authorino
oc get deployment authorino -n kuadrant-system

# DSC condition (ModelsAsAServiceReady on 3.5+)
oc get datasciencecluster default-dsc \
  -o jsonpath='{.status.conditions[?(@.type=="ModelsAsAServiceReady")].status}'

# Health endpoint
DOMAIN=$(oc get ingresses.config/cluster -o jsonpath='{.spec.domain}')
curl -sk "https://maas.${DOMAIN}/maas-api/health"
```

{{< /variant >}}

{{< variant version 3.4 >}}

```sh
# Gateway
oc get gateway maas-default-gateway -n openshift-ingress \
  -o jsonpath='{.status.conditions[?(@.type=="Programmed")].status}'

# Core deployments
oc get deployment postgres maas-api maas-controller -n redhat-ods-applications

# Authorino
oc get deployment authorino -n kuadrant-system

# DSC condition
oc get datasciencecluster default-dsc \
  -o jsonpath='{.status.conditions[?(@.type=="ModelsAsServiceReady")].status}'

# Health endpoint
DOMAIN=$(oc get ingresses.config/cluster -o jsonpath='{.spec.domain}')
curl -sk "https://maas.${DOMAIN}/maas-api/health"
```

{{< /variant >}}

### Phase 2: Deploy simulator model

```sh
oc get llminferenceservice -n llm
oc get maasmodelref -n llm -o wide
oc get maasauthpolicy -n models-as-a-service
oc get maassubscription -n models-as-a-service
oc get pods -n llm
```

### Phase 3: API verification

```sh
DOMAIN=$(oc get ingresses.config/cluster -o jsonpath='{.spec.domain}')
HOST="https://maas.${DOMAIN}"

# Create API key (save the key and model ID for subsequent phases)
API_KEY=$(curl -sk -X POST \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","expiresIn":"1h","subscription":"simulator-free"}' \
  "${HOST}/maas-api/v1/api-keys" | jq -r '.key')
echo "API_KEY=${API_KEY}"

# List models
curl -sk -H "Authorization: Bearer ${API_KEY}" "${HOST}/v1/models"

# Get the model ID (canonical form for body-based routing)
MODEL_ID=$(curl -sk -H "Authorization: Bearer ${API_KEY}" \
  "${HOST}/v1/models" | jq -r '.data[0].id')
echo "MODEL_ID=${MODEL_ID}"
```

### Phase 4: Auth enforcement

```sh
# Should return 401 or 403
curl -sk -o /dev/null -w '%{http_code}' \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${MODEL_ID}\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}" \
  "${HOST}/v1/chat/completions"
```

### Phase 5: Rate limiting

```sh
# Send rapid requests and watch for 429
for i in $(seq 1 16); do
  curl -sk -o /dev/null -w '%{http_code}\n' \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${MODEL_ID}\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello, write a long essay\"}],\"max_tokens\":50}" \
    "${HOST}/v1/chat/completions"
done
```

## Troubleshooting

### Gateway pod OOMKilled (CrashLoopBackOff)

If the verification script fails at Phase 1 (health endpoint unreachable) or Phase 3 (API key creation returns `{}`), check the MaaS gateway pod:

```sh
oc get pods -n openshift-ingress | grep maas-default-gateway
```

If the pod shows `CrashLoopBackOff` with multiple restarts, the Kuadrant Wasm extensions may exceed the default `1Gi` memory limit. Apply the ConfigMap fix from [Phase 2 Step 5b]({{< relref "/guide/installation-guide/platform-config#gateway-pod-oomkill-prevention" >}}):

```sh
oc apply -f manifests/02-platform-config/gateway-resources.yaml

oc patch gateway maas-default-gateway -n openshift-ingress --type=merge -p '{
  "spec": {
    "infrastructure": {
      "parametersRef": {
        "group": "",
        "kind": "ConfigMap",
        "name": "maas-gateway-options"
      }
    }
  }
}'
```

Wait for the pod to stabilize, then re-run the script.

### Wrong subscription name in API key creation

If the API key creation returns `{"code":"invalid_subscription","error":"Unable to resolve a subscription for this API key"}`, ensure the subscription name matches an existing `MaaSSubscription` resource:

```sh
oc get maassubscription -n models-as-a-service
```

The Kustomize-deployed simulator uses `simulator-free` and `simulator-premium`. The verification script creates its own `simulator-subscription`.

## Appendix

### Directory Structure

```text
manifests/06-verification/
  verify.sh                      # End-to-end MaaS verification script
```

## References

- [MaaS upstream documentation](https://github.com/opendatahub-io/models-as-a-service)
- [MaaS verification in rhoai-nightly](https://github.com/rh-aiservices-bu/rhoai-nightly/blob/main/scripts/verify-maas.sh)

## Next step

Proceed to [Phase 7: Observability]({{< relref "/guide/observability" >}}).
