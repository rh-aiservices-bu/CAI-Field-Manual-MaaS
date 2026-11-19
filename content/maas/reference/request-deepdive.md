---
title: "Request Deep Dive: Pod-by-Pod Tracing"
description: Traces an inference request through every pod in the Red Hat OpenShift AI 3.5 Models as a Service stack, with the oc commands to debug each hop.
weight: 20
---

This page traces an inference request through every pod in the Red Hat OpenShift AI 3.5 Models as a Service stack. Use it to understand where to look when debugging, what each component does to the request, and which `oc` commands to run.

> [!TIP]
> For an animated walkthrough of these flows, see the {{< visualizer file="visualizers/flow.html" label="RHOAI 3.5 Flow Visualizer" >}}.

## Envoy Filter Chain (Inside the Gateway)

The `maas-default-gateway` Envoy proxy in `openshift-ingress` processes every request through this filter chain:

![Envoy filter chain - 4 stages inside the Gateway](images/deepdive-filter-chain.svg)

| Order | Filter | Pod / Mechanism | What It Does |
| --- | --- | --- | --- |
| **①** | `ext_proc` (IPP Pre) | `payload-pre-processing` | Runs two plugins: `model-extractor` (body-field-to-header) copies the `model` field from the body into the `X-Gateway-Model-Name` header, and `model-provider-resolver` resolves it. Runs BEFORE auth so Kuadrant can use the header for per-model policy matching. |
| **②** | `wasm` (Kuadrant) | WasmPlugin CR (in-process) | Auth via Authorino (gRPC), rate limiting via Limitador (gRPC). Uses `X-Gateway-Model-Name` for route-level policy enforcement. |
| **③** | `ext_proc` (IPP Post) | `payload-processing` | Header guarding, usage enforcement, provider resolution, API format translation, credential injection. Runs AFTER auth completes. |
| **④** | `router` | (built-in) | Routes the mutated request to the upstream - external provider API or on-cluster InferencePool/InferenceService. |

```sh
# View the EnvoyFilter that configures the two-stage IPP
oc get envoyfilter payload-processing -n openshift-ingress -o yaml

# View the Kuadrant WasmPlugin
oc get wasmplugin -n openshift-ingress -o yaml

# View all filters on the gateway
oc get envoyfilters -n openshift-ingress
```

## Namespace Map

Every component lives in a specific namespace. Here is the full layout for RHOAI 3.5:

![RHOAI 3.5 namespace map](images/deepdive-namespace-map.svg)

| Namespace | Components | Purpose |
| --- | --- | --- |
| `openshift-ingress` | maas-default-gateway (Envoy), payload-pre-processing, payload-processing, istiod, kube-auth-proxy, router-default | Gateway, IPP ext_proc pods, Istio control plane |
| `redhat-ai-gateway-infra` | maas-api, maas-api-key-cleanup (CronJob) | API key management (moved from redhat-ods-applications in 3.5) |
| `redhat-ods-applications` | maas-controller, maas-ui, postgres | MaaS controller, UI, PostgreSQL database |
| `kuadrant-system` | authorino, limitador-limitador | Auth server, rate limit server |
| `models-as-a-service` | MaaSAuthPolicy, MaaSSubscription CRs | User-facing access control and quota definitions |
| `ai-tenants` | AITenant CRs | Multi-tenancy configuration |
| *model namespace* (e.g., `llm`) | vLLM pods, MaaSModelRef, TokenRateLimitPolicy, LLMInferenceService | Model serving workloads |
| *external-models namespace* | ExternalProvider, ExternalModel CRs | Third-party API proxy configuration |

```sh
# Quick view of all MaaS-related pods across namespaces
oc get pods -n openshift-ingress -l app.kubernetes.io/part-of=maas 2>/dev/null; \
oc get pods -n redhat-ai-gateway-infra; \
oc get pods -n redhat-ods-applications | grep -E 'maas|postgres'; \
oc get pods -n kuadrant-system
```

## Pod-by-Pod Request Trace

### External Model Request (e.g., Anthropic)

![External model request sequence](images/deepdive-external-model.svg)

| Step | Pod | Namespace | What Happens | Debug Command |
| --- | --- | --- | --- | --- |
| 1 | *client* | - | Sends `POST /v1/chat/completions` with `Authorization: Bearer sk-oai-...` | `curl -v https://maas.${CLUSTER_DOMAIN}/v1/chat/completions ...` |
| 2-4 | `payload-pre-processing` | `openshift-ingress` | Parses JSON body, extracts `model` field, sets `X-Gateway-Model-Name` header. Resolves model type. | `oc logs -n openshift-ingress deploy/payload-pre-processing -f` |
| 5-6 | `maas-default-gateway` (Wasm) | `openshift-ingress` | Kuadrant WasmPlugin triggers auth-service action | `oc logs -n openshift-ingress deploy/maas-default-gateway-istio -c istio-proxy -f` |
| 7 | `authorino` | `kuadrant-system` | Receives gRPC call from Wasm shim. Calls MaaS API to validate the `sk-oai-*` key. On success, injects the identity headers (`X-MaaS-Username`, `X-MaaS-Group`, `X-MaaS-Subscription`) from the validation result via the `MaaSAuthPolicy` response stage. | `oc logs -n kuadrant-system deploy/authorino -f` |
| 8-9 | `maas-api` | `redhat-ai-gateway-infra` | Looks up key hash in PostgreSQL. Returns the validation result `{valid, userId, groups, subscription}` to Authorino (a JSON body, not headers). The subscription comes from the key record bound at mint time. | `oc logs -n redhat-ai-gateway-infra deploy/maas-api -f` |
| 10 | `limitador-limitador` | `kuadrant-system` | Receives gRPC call from Wasm shim. Checks token quota for the subscription. | `oc logs -n kuadrant-system deploy/limitador-limitador -f` |
| 11-17 | `payload-processing` | `openshift-ingress` | Runs post-processing plugins in order: maas-headers-guard, stream-usage-enforcer, model-provider-resolver (resolves ExternalModel CRD), api-translation (OpenAI to Anthropic format), apikey-injection (injects provider key from Secret). | `oc logs -n openshift-ingress deploy/payload-processing -f` |
| 18-19 | `maas-default-gateway` (router) | `openshift-ingress` | Routes mutated request to `https://api.anthropic.com/v1/messages` | `oc logs -n openshift-ingress deploy/maas-default-gateway-istio -c istio-proxy -f` |
| 20 | *Anthropic API* | - | Processes request, returns Anthropic Messages format response | - |
| 21-22 | `payload-processing` | `openshift-ingress` | Response plugins: api-translation converts Anthropic response back to OpenAI format (only when response translation is enabled - see note below) | `oc logs -n openshift-ingress deploy/payload-processing -f` |
| 23-25 | `maas-default-gateway` (Wasm) | `openshift-ingress` | Kuadrant Wasm reads `usage.total_tokens` from response body. Reports consumed tokens to Limitador via gRPC. | `oc logs -n openshift-ingress deploy/maas-default-gateway-istio -c istio-proxy -f` |
| 26 | *client* | - | Receives OpenAI-format response regardless of which provider was used | - |

> [!NOTE]
> Response `api-translation` is **off by default**. The `payload-processing-plugins` ConfigMap ships with an empty response profile (`response: []`) so streaming (SSE) is not held by a response processor. Providers that rewrite responses (for example Anthropic Messages to OpenAI) need it enabled manually on the ConfigMap. Steps 21-22 above only run once you opt in. See the upstream [MaaS docs](https://opendatahub-io.github.io/models-as-a-service/latest/) (External Model Setup - IPP response translation).

### Internal Model Request (P/D Disaggregated)

![Internal Model P/D disaggregated sequence](images/deepdive-pd-disaggregated.svg)

After step 16 (IPP Post returns to Gateway), the internal model flow diverges:

| Step | Pod | Namespace | What Happens | Debug Command |
| --- | --- | --- | --- | --- |
| 17-19 | EPP (ext_proc) | *model namespace* | Endpoint Picker selects optimal Prefill and Decode pods based on KV cache utilization and queue depth | `oc logs -n <model-ns> deploy/<epp-deploy> -f` |
| 20-21 | Sidecar | *model namespace* | Coordinates the Prefill/Decode transaction | `oc logs -n <model-ns> <sidecar-pod> -f` |
| 22-23 | Prefill Pod (vLLM) | *model namespace* | Processes input prompt, generates KV cache, returns KVXfer metadata | `oc logs -n <model-ns> <prefill-pod> -c kserve-container -f` |
| 24-25 | NIXL | *model namespace* | High-speed KV cache transfer from Prefill to Decode pod (GPU-direct RDMA or DCN) | - |
| 26-27 | Decode Pod (vLLM) | *model namespace* | Pulls KV cache via NIXL, generates tokens auto-regressively, streams response back to Gateway | `oc logs -n <model-ns> <decode-pod> -c kserve-container -f` |

## Key Configuration Resources

![CRD relationship hierarchy](images/deepdive-crd-hierarchy.svg)

These are the ConfigMaps, Secrets, and CRDs that control the request flow:

| Resource | Namespace | Purpose |
| --- | --- | --- |
| `ConfigMap/payload-processing-plugins` | `openshift-ingress` | Defines which plugins run in IPP pre and post stages |
| `Secret` with label `inference.llm-d.ai/ipp-managed=true` | *external-models namespace* | Provider API keys for apikey-injection plugin (3.5 label; was `bbr-managed` in 3.4) |
| `Config/default` | *(cluster-scoped)* | Platform anchor CR that triggers MaaS controller reconciliation |
| `AITenant` | `ai-tenants` | Multi-tenancy configuration for the AI Gateway |
| `MaaSModelRef` | *model namespace* | Maps user-facing model name to provider endpoint and target model ID |
| `MaaSAuthPolicy` | `models-as-a-service` | Configures API key authentication via K8s Secret |
| `MaaSSubscription` | `models-as-a-service` | Defines quota - associates user/team with allowed models and rate limits |
| `ExternalProvider` | *external-models namespace* | Provider connection config (URL, auth type) |
| `ExternalModel` | *external-models namespace* | Maps model name to provider and target model |
| `AuthPolicy` | `openshift-ingress` | Generated by maas-controller from MaaSAuthPolicy |
| `TokenRateLimitPolicy` | *model namespace* | Generated by maas-controller from MaaSSubscription |

```sh
# View IPP plugin configuration
oc get cm payload-processing-plugins -n openshift-ingress -o yaml

# View provider secrets (check label)
oc get secrets -l inference.llm-d.ai/ipp-managed=true -A

# View all MaaS CRDs
oc get maasmodelref -A
oc get maasauthpolicy -A
oc get maassubscription -A
oc get externalmodel -A
oc get externalprovider -A

# View platform config
oc get config default -o yaml
oc get aitenant -A
```

## Common Debugging Scenarios

![Debugging decision tree](images/deepdive-debugging.svg)

### 500 Error on External Model

The request reaches the provider but credential injection failed:

```sh
# Check if the Secret has the correct label
oc get secrets -n <external-models-ns> -l inference.llm-d.ai/ipp-managed=true

# Check payload-processing logs for apikey-injection errors
oc logs -n openshift-ingress deploy/payload-processing | grep -i "apikey\|credential\|secret"

# Check ExternalModel CRD is correct
oc get externalmodel <model-name> -n <external-models-ns> -o yaml
```

### 401 Unauthorized

The API key is invalid, expired, or revoked:

```sh
# Check Authorino logs
oc logs -n kuadrant-system deploy/authorino | grep -i "denied\|reject\|invalid"

# Check MaaS API key validation
oc logs -n redhat-ai-gateway-infra deploy/maas-api | grep -i "validate\|invalid"

# Check MaaSAuthPolicy
oc get maasauthpolicy -A -o yaml
```

### 429 Too Many Requests

Token quota exceeded:

```sh
# Check Limitador logs
oc logs -n kuadrant-system deploy/limitador-limitador | grep -i "rate\|limit\|exceed"

# Check subscription limits
oc get maassubscription -A -o yaml | grep -A5 "rateLimits"

# Check TokenRateLimitPolicy
oc get tokenratelimitpolicy -A -o yaml
```

### Model Not Found

The model name doesn't match any MaaSModelRef:

```sh
# List all registered models
oc get maasmodelref -A

# Check payload-processing logs for resolver errors
oc logs -n openshift-ingress deploy/payload-processing | grep -i "resolver\|model.*not.*found"

# Check the pre-processing header extraction
oc logs -n openshift-ingress deploy/payload-pre-processing | grep -i "model\|header"
```

## RHOAI 3.4 vs 3.5 Differences

![RHOAI 3.4 vs 3.5 architecture comparison](images/deepdive-34-vs-35.svg)

If you are debugging a 3.4 cluster, these are the key differences:

| What | 3.4 | 3.5 |
| --- | --- | --- |
| DSC component | `kserve.modelsAsService` | `aigateway.modelsAsAService` |
| MaaS API namespace | `redhat-ods-applications` | `redhat-ai-gateway-infra` |
| Secret label | `inference.networking.k8s.io/bbr-managed=true` | `inference.llm-d.ai/ipp-managed=true` |
| Kuadrant integration | EnvoyFilter-based Wasm | WasmPlugin CRs |
| External model CRD | Single `ExternalModel` | `ExternalProvider` + `ExternalModel` |
| IPP architecture | Single ext_proc stage (after auth) | Two stages: pre (before auth) + post (after auth) |
| IPP plugins (post) | model-provider-resolver, body-field-to-header, api-translation, apikey-injection | maas-headers-guard, stream-usage-enforcer, model-provider-resolver, api-translation, apikey-injection |
