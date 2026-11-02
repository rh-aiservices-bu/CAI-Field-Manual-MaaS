---
title: "Platform Upgrade (3.4 → 3.5)"
description: Migrate your Models as a Service configuration after upgrading the Red Hat OpenShift AI operator from 3.4 to 3.5 — DSC fields, namespaces, ExternalModel API changes, and dashboard configuration.
weight: 10
---

This page walks through migrating your Models as a Service configuration after upgrading the Red Hat OpenShift AI operator from 3.4 to 3.5. The operator upgrade itself is handled by OLM (change the subscription channel from `stable-3.4` to `stable-3.x`). This guide covers everything else: DSC fields, namespaces, ExternalModel API changes, and dashboard configuration.

> [!IMPORTANT]
> This guide is not a replacement for the official Red Hat OpenShift AI [3.5 Release Notes - Known Issues](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/release_notes/known-issues_relnotes). Always check the release notes for the latest updates.

## Prerequisites

- Red Hat OpenShift AI 3.5+ operator is installed (OLM has completed the upgrade)
- `cluster-admin` access
- Models as a Service was previously working on 3.4

Verify the operator version before proceeding:

```sh
oc get csv -n redhat-ods-operator | grep rhods-operator
```

Expected output (version must be 3.5.x or higher):

```text
NAME                     DISPLAY                 VERSION   REPLACES               PHASE
rhods-operator.3.5.0     Red Hat OpenShift AI    3.5.0     rhods-operator.3.4.3   Succeeded
```

If the version still shows 3.4.x, the OLM upgrade has not completed yet. Check the subscription channel and InstallPlan before proceeding.

## What Changes

The 3.5 release restructures how Models as a Service is configured in the DataScienceCluster. Here are the key changes that require action:

| Area | 3.4 | 3.5+ |
| --- | --- | --- |
| **DSC MaaS field** | `kserve.modelsAsService` | `aigateway.modelsAsAService` |
| **DSC Playground** | `llamastackoperator` | `ogx` |
| **maas-api namespace** | `redhat-ods-applications` | `redhat-ai-gateway-infra` |
| **ExternalModel API** | `maas.opendatahub.io/v1alpha1` | `inference.opendatahub.io/v1alpha1` (ExternalProvider) |
| **Dashboard config** | `maasAuthPolicies` flag supported | `maasAuthPolicies` rejected by admission webhook |

For the full list of structural changes (status conditions, new CRDs, Tenant CR deprecation), see the [What Changes]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#what-changes-in-the-3-4-3-5-upgrade" >}}) table in the troubleshooting page.

## Step 1: Back Up Current State

Before making any changes, back up your current configuration:

```sh
# Back up the DataScienceCluster
oc get dsc default-dsc -o yaml > dsc-backup.yaml

# Back up the dashboard config
oc get odhdashboardconfig odh-dashboard-config -n redhat-ods-applications -o yaml > dashboard-backup.yaml

# Back up ExternalModels if you have any
oc get externalmodel.maas.opendatahub.io -A -o yaml > externalmodels-backup.yaml 2>/dev/null || true
```

## Step 2: Add aigateway Component to the DSC

The Models as a Service control plane moved from `kserve.modelsAsService` to its own top-level `aigateway` component in 3.5. Add it to the DSC:

```sh
oc patch datasciencecluster default-dsc --type=merge \
  -p '{"spec":{"components":{"aigateway":{"managementState":"Managed","modelsAsAService":{"managementState":"Managed"}}}}}'
```

> [!WARNING]
> Without `aigateway` set to `Managed`, regular (non-admin) users will not see the **AI asset endpoints** page (under Gen AI studio) in the Red Hat OpenShift AI Dashboard. Admin users may still see it, which makes this a silent failure that only affects your end users.

Verify the patch was applied:

```sh
oc get datasciencecluster default-dsc \
  -o jsonpath='{.spec.components.aigateway.modelsAsAService.managementState}'
# Expected: Managed
```

## Step 3: Add ogx Component (AI Playground) {#step-3-add-ogx-component-ai-playground}

The `llamastackoperator` DSC component was renamed to `ogx` in 3.5. Add the new component **and** explicitly remove the old one in the same patch:

```sh
oc patch datasciencecluster default-dsc --type=merge \
  -p '{"spec":{"components":{"ogx":{"managementState":"Managed"},"llamastackoperator":{"managementState":"Removed"}}}}'
```

> [!IMPORTANT]
> Do **not** leave `llamastackoperator` as `Managed` (and do not just omit it - on some clusters the field already defaults to `Managed`). Reproduced and confirmed on a live 3.5.0 cluster: having both `llamastackoperator: Managed` and `ogx: Managed` at the same time causes the operator to reject the `ogx` module with `"LlamaStackOperator is set to Managed; it has been deprecated, set it to Removed before enabling OGX"`. That error aborts the **entire** module-provisioning batch at runlevel 32 - which also includes `aigateway` and `mlflowoperator`. The practical symptom is not just a missing Playground tab: `aigateway`'s CRDs never get installed, `maas-api` never deploys, `ModelsAsAServiceReady` stays `False`, and applying `MaaSModelRef` fails with `no matches for kind "MaaSModelRef"` even though `modelsAsAService` shows `Managed`. See [Issue 14]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-14" >}}) for the full diagnosis and fix if you already hit this.

> [!WARNING]
> On some RHOAI 3.5.0 installations, the OGX CRD may still not be available after removing `llamastackoperator`. If the DSC reports `OGXReady: False` with `no matches for kind "OGX"`, set `ogx` back to `Removed` to unblock the DSC - this one genuinely only affects the AI Playground feature, not Models as a Service.

```sh
# Only if OGX is still blocking DSC Ready after removing llamastackoperator:
oc patch datasciencecluster default-dsc --type=merge \
  -p '{"spec":{"components":{"ogx":{"managementState":"Removed"}}}}'
```

## Step 4: Handle the Frozen kserve.modelsAsService Field

The old `kserve.modelsAsService` field is frozen by CEL validation (`self == oldSelf`). You cannot change its value in-place. This is by design - it prevents accidental removal of a running Models as a Service configuration during the transition period.

You will see a policy 299 deprecation warning:

```text
DataScienceCluster default-dsc violates policy 299 - "spec.components.kserve.modelsAsService is deprecated;
use spec.components.aigateway.modelsAsAService instead. Clear to Removed after migration (re-enabling is blocked).
The field remains respected at least through 3.6."
```

This warning is **expected** at this point. Both old and new paths coexist through 3.6, so Models as a Service continues to work while both are present.

After you have confirmed that `aigateway.modelsAsAService` is working ([Step 11](#verification)), you can silence the warning by setting the old field to `Removed`:

```sh
oc patch datasciencecluster default-dsc --type=json \
  -p '[{"op":"replace","path":"/spec/components/kserve/modelsAsService/managementState","value":"Removed"}]'
```

> [!IMPORTANT]
> On fresh Red Hat OpenShift AI 3.5+ installs, do NOT add `kserve.modelsAsService` to the DSC. The CEL validation will reject any attempt to re-enable it after it has been set to `Removed`.

## Step 5: Wait for DSC Ready

Wait for the DataScienceCluster to finish reconciling after the patches:

```sh
oc wait datasciencecluster default-dsc --for=condition=Ready --timeout=600s
```

If the DSC does not become Ready within the timeout, check which component is blocking:

```sh
oc get datasciencecluster default-dsc -o jsonpath='{range .status.conditions[*]}{.type}: {.status} ({.reason}) {.message}{"\n"}{end}'
```

> [!TIP]
> The MCP Lifecycle Operator (new in 3.5) is a common blocker - it can OOMKill on clusters with many secrets. See [Issue 1: MCP Lifecycle Operator OOMKill]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-1" >}}) for the workaround.

## Step 6: Verify Namespace and Secrets

In 3.5, `maas-api` moves to the `redhat-ai-gateway-infra` namespace. The controller should auto-create this namespace and copy the `maas-db-config` secret.

Verify the namespace exists:

```sh
oc get namespace redhat-ai-gateway-infra
```

Verify the `maas-db-config` secret was copied to the new namespace:

```sh
oc get secret maas-db-config -n redhat-ai-gateway-infra
```

If the secret is missing, copy it manually:

```sh
oc get secret maas-db-config -n redhat-ods-applications -o json | \
  jq 'del(.metadata.resourceVersion, .metadata.uid, .metadata.creationTimestamp, .metadata.ownerReferences) | .metadata.namespace = "redhat-ai-gateway-infra"' | \
  oc apply -f -
```

Verify `maas-api` is running in the new namespace:

```sh
oc rollout status deployment/maas-api -n redhat-ai-gateway-infra --timeout=120s
```

## Step 7: Label Namespace for Gateway Access

If the MaaS gateway is configured with label-based namespace selection (the secure configuration), the new namespace needs the matching label. Without it, the gateway rejects HTTPRoutes from `redhat-ai-gateway-infra` and the Dashboard shows "Error loading components".

```sh
oc label namespace redhat-ai-gateway-infra maas.opendatahub.io/gateway-access=true --overwrite
```

Verify the HTTPRoutes are accepted:

```sh
oc get httproute -n redhat-ai-gateway-infra -o wide
```

If HTTPRoutes show `NotAccepted`, see [Issue 3: MaaS Gateway Namespace Label]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-3" >}}) for diagnosis steps.

## Step 8: Migrate LLMInferenceServices to Body-Based Routing (BBR) {#llmisvc-migration}

In 3.5, the MaaS gateway enables body-based routing (BBR) by default: clients call `/v1/chat/completions` with the model in the request body instead of the path-based `/llm/{model-namespace}/{model-name}` URL. However, this only applies to **new** LLMInferenceServices. LLMInferenceServices that existed before the upgrade are not automatically re-rendered against the new serving presets - the operator pins the preset on each LLMInferenceService via the `serving.kserve.io/config-llm-template` status annotation, so existing instances deliberately keep their old configuration to avoid spurious rollouts. Upgraded models keep serving the old path-based endpoint, and BBR requests against them fail. If you expect to take advantage of the new feature, you must trigger the update from the pinned presets.

List all LLMInferenceServices; every one that existed before the upgrade is affected:

```sh
oc get llminferenceservice -A
```

Migrate each LLMInferenceService using one of the following paths.

**Path A: Delete and let the operator re-reconcile**

Delete the LLMInferenceService and re-create it from your manifest or GitOps repository. The operator re-renders it against the latest presets, including the new BBR HTTPRoute and all other policy changes:

```sh
oc delete llminferenceservice <name> -n <namespace>
# Re-create it from your manifest or GitOps repository
oc apply -f <llminferenceservice>.yaml -n <namespace>
```

> [!WARNING]
> Deleting the LLMInferenceService guarantees downtime: the model is unavailable until the operator recreates the service and the replacement pod is Ready.

**Path B: Remove the pinned status annotation**

Remove the pinned preset annotation from the status subresource to trigger a reconcile against the latest presets without recreating the custom resource:

```sh
oc patch llminferenceservice <name> -n <namespace> --subresource=status --type=json \
  -p '[{"op":"remove","path":"/status/annotations/serving.kserve.io~1config-llm-template"}]'
```

> [!WARNING]
> This path might still come with downtime: if the latest presets change more than the HTTPRoute and gateway policy objects, the underlying deployments roll. Whether users observe downtime depends on your ability to perform a rolling update - you need enough spare cluster capacity to run the old and new pods side by side.

> [!NOTE]
> The status patch is an out-of-band change that GitOps does not track, so the resource drifts until the next sync. If you manage LLMInferenceServices with OpenShift GitOps or a similar tool, Path A fits your workflow more naturally.

Verify BBR works against each migrated model:

```sh
MAAS_HOST=$(oc get gateway maas-default-gateway -n openshift-ingress \
  -o jsonpath='{.spec.listeners[?(@.name=="https")].hostname}')
API_KEY=$(oc whoami -t)

# Get the model ID (canonical form for body-based routing)
MODEL_ID=$(curl -sk "https://${MAAS_HOST}/v1/models" \
  -H "Authorization: Bearer ${API_KEY}" | jq -r '.data[0].id')

# Send a chat completion request (body-based routing)
curl -sk "https://${MAAS_HOST}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${MODEL_ID}\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]
  }"
```

## Step 9: Migrate ExternalModels (if applicable)

If you have ExternalModel resources (third-party LLM APIs like OpenAI, Bedrock, Gemini), they need manual migration. The old `ExternalModel` CRD under `maas.opendatahub.io/v1alpha1` is not auto-migrated to the new `ExternalProvider` CRD under `inference.opendatahub.io/v1alpha1`.

Check for existing ExternalModels:

```sh
# Old API group (3.4)
oc get externalmodel.maas.opendatahub.io -A

# New API group (3.5)
oc get externalprovider.inference.opendatahub.io -A
```

If you have old ExternalModels, recreate each one under the new API. Example for an OpenAI provider:

```sh
# 1. Create the new ExternalProvider
cat <<EOF | oc apply -f -
apiVersion: inference.opendatahub.io/v1alpha1
kind: ExternalProvider
metadata:
  name: openai
  namespace: <model-namespace>
spec:
  endpoint: "api.openai.com"
  provider: "openai"
  auth:
    type: apikey
    secretRef:
      name: openai-api-key
EOF

# 2. Delete the old ExternalModel (after verifying the new one is Ready)
oc get externalprovider openai -n <model-namespace>
oc delete externalmodel.maas.opendatahub.io openai -n <model-namespace>
```

> [!WARNING]
> The 3.5 `ExternalProvider` CRD has a stricter validation regex on `spec.auth.secretRef.name` that does not allow dots. If your secret names contain dots (e.g. `glm5.1-w8a8-key`), you must rename them first. See [Issue 2: ExternalModel Migration - Secret Names with Dots]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-2" >}}) for details.

## Step 10: Update OdhDashboardConfig

The `maasAuthPolicies` flag was removed from the `OdhDashboardConfig` CRD in 3.5. The admission webhook rejects any manifest that includes it.

Check if your dashboard config has the flag:

```sh
oc get odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  -o jsonpath='{.spec.dashboardConfig.maasAuthPolicies}'
```

If it returns a value, remove it:

```sh
oc patch odhdashboardconfig odh-dashboard-config -n redhat-ods-applications --type=json \
  -p '[{"op":"remove","path":"/spec/dashboardConfig/maasAuthPolicies"}]'
```

## Step 11: Verification Checklist {#verification}

Run through these checks to confirm the migration is complete:

| Check | Command |
| --- | --- |
| DSC is Ready | `oc get dsc default-dsc -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'`<br>Expected: `True` |
| maas-api in new namespace | `oc get pods -n redhat-ai-gateway-infra \| grep maas-api`<br>Expected: `Running` |
| MaaS Config CR exists | `oc get configs.maas.opendatahub.io default`<br>Expected: resource found |
| ModelsAsAServiceReady | `oc get dsc default-dsc -o jsonpath='{.status.conditions[?(@.type=="ModelsAsAServiceReady")].status}'`<br>Expected: `True` |
| Health endpoint | `CLUSTER_DOMAIN=$(oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}')`<br>`curl -sk "https://maas.${CLUSTER_DOMAIN}/maas-api/health"`<br>Expected: `{"status":"healthy"}` |
| BBR works against pre-3.5 models | `/v1/chat/completions` request per the [Step 8](#llmisvc-migration) verification<br>Expected: JSON completion response |
| Regular user sees AI asset endpoints | Log into the Red Hat OpenShift AI Dashboard as a non-admin user and verify the **AI asset endpoints** page is visible under Gen AI studio |
| No policy 299 warning (after Step 4 cleanup) | `oc get dsc default-dsc -o jsonpath='{.spec.components.kserve.modelsAsService.managementState}'`<br>Expected: `Removed` (or empty if the field was deleted) |

## Troubleshooting

If you hit issues during migration, see the [Post-Upgrade Troubleshooting]({{< relref "/guide/upgrade/post-upgrade-troubleshooting" >}}) page. Here is a quick mapping from migration symptoms to known issues:

| Symptom During Migration | See |
| --- | --- |
| DSC stuck not-ready after patching | [Issue 1]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-1" >}}) (MCP Lifecycle Operator OOM) |
| Dashboard shows "Error loading components" | [Issue 3]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-3" >}}) (namespace label) or [Issue 4]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-4" >}}) (hostname discovery) |
| maas-api returns 500 on `/v1/tenants` | [Issue 4]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-4" >}}) (gateway hostname discovery) |
| ExternalProvider creation fails on secret name | [Issue 2]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-2" >}}) (dotted secret names) |
| HTTPRoutes show `NotAccepted` | [Issue 3]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-3" >}}) (namespace label) |
| HTTP 500/503 under load after migration | [Issue 7]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-7" >}}) (WASM auth timeout) |
| HTTP 429 Too Many Requests | [Issue 9]({{< relref "/guide/upgrade/post-upgrade-troubleshooting#issue-9" >}}) (token rate limit default) |

## References

- [RHOAI 3.5 Release Notes - Known Issues](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/release_notes/known-issues_relnotes)
- [RHOAI 3.5 MaaS Official Docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/govern_llm_access_with_models-as-a-service/index)
- [RHOAI 3.4 MaaS Official Docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/govern_llm_access_with_models-as-a-service/index)
- [GH #107 - aigateway required for AI Assets Endpoints visibility](https://github.com/rh-aiservices-bu/rhoai-maas-guide/issues/107)
