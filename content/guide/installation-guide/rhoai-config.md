---
title: "Phase 4: RHOAI Configuration"
description: "Configures the RHOAI operator instances to enable Models-as-a-Service so the maas-api deployment starts healthy immediately."
weight: 40
---

Configure the RHOAI operator instances to enable Models-as-a-Service. Because the PostgreSQL database and `maas-db-config` secret already exist ([Phase 3]({{< relref "/guide/installation-guide/maas-platform" >}})), the `maas-api` deployment will start healthy immediately.

> [!TIP]
> All file paths and `oc apply` commands in this guide are relative to the [CAI-Field-Manual-MaaS](https://github.com/rh-aiservices-bu/CAI-Field-Manual-MaaS) repository root. Make sure you have cloned it and are working from its root directory (see [Getting Started]({{< relref "/guide#getting-started" >}})).

> [!IMPORTANT]
> This guide is not a replacement for the official Red Hat OpenShift AI Models as a Service documentation ([3.5](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/govern_llm_access_with_models-as-a-service/index) | [3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/govern_llm_access_with_models-as-a-service/index)). It is a companion resource with opinionated Kustomize manifests and automation scripts to accelerate deployment.

## Prerequisites

* RHOAI operator is installed and CSV is in `Succeeded` state
* [Phase 3]({{< relref "/guide/installation-guide/maas-platform" >}}) (MaaS platform) is completed — PostgreSQL is running and `maas-db-config` secret exists

Verify the operator is ready before proceeding:

```sh
oc get csv -n redhat-ods-operator | grep rhods-operator
```

Expected output (version varies):

```text
NAME                     DISPLAY                 VERSION   REPLACES               PHASE
rhods-operator.3.5.0     Red Hat OpenShift AI    3.5.0     rhods-operator.3.4.3   Succeeded
```

## Apply

On a fresh install, apply in two stages. The `OdhDashboardConfig` CRD does not exist until the RHOAI operator has reconciled the DataScienceCluster, so applying the full kustomization in one shot will fail the first time.

> [!NOTE]
> The RHOAI operator auto-creates a `default-dsci` and `odh-dashboard-config` during installation. When you `oc apply` over these auto-created resources, you will see a warning: *"resource is missing the kubectl.kubernetes.io/last-applied-configuration annotation"*. This is harmless — the annotation is patched automatically and subsequent applies will be clean.

```sh
# Stage 1: DSC and DSCI (triggers operator reconciliation)
oc apply -f manifests/04-rhoai-config/dscinitialization.yaml
```

Wait until the DSCI is created (this step must complete before creating the DSC):

```sh
oc wait --for=jsonpath='{.status.phase}'=Ready \
  dscinitialization/default-dsci --timeout=600s
```

Create the Data Science Cluster:

{{< variant version "3.5 3.6" >}}
```sh
oc apply -f manifests/04-rhoai-config/datasciencecluster.yaml
```

Enables MaaS via `aigateway.modelsAsAService: Managed`, the modularized path for RHOAI 3.5+.
{{< /variant >}}

{{< variant version 3.4 >}}
```sh
oc apply -f manifests/04-rhoai-config/datasciencecluster-34.yaml
```

> [!WARNING]
> The `kserve.modelsAsService` DSC path is deprecated in RHOAI 3.5 and replaced by `aigateway.modelsAsAService`. Without `aigateway` set to `Managed`, regular (non-admin) users will not see the **AI asset endpoints** page in the Dashboard. If upgrading from 3.4, see [Platform Upgrade (3.4 -> 3.5)]({{< relref "/guide/upgrade/platform-upgrade" >}}).
{{< /variant >}}

Apply the GPU HardwareProfile so RHOAI properly schedules GPU workloads:

```sh
oc apply -f manifests/04-rhoai-config/hardwareprofile.yaml
```

> [!NOTE]
> Without this HardwareProfile, GPU model deployments may hang. The node will show `nvidia.com/gpu: 0` requested even when the GPU is physically present, because RHOAI needs a HardwareProfile to map GPU resources to workloads.

The DataScienceCluster reconciles multiple components. Wait for `KServe` and the `Model Controller` (MaaS) to reach Ready:

```sh
oc wait --for=jsonpath='{.status.phase}'=Ready \
  datasciencecluster/default-dsc --timeout=600s
```

With the Data Science Cluster created we can now apply the dashboard configuration:

```sh
# Stage 2: Dashboard config (requires OdhDashboardConfig CRD to exist)
oc apply -f manifests/04-rhoai-config/odh-dashboard-config.yaml
```

> [!NOTE]
> On subsequent runs (CRDs already exist), `oc apply -k manifests/04-rhoai-config/` works in one shot. The kustomization includes the 3.5+ DSC by default - for RHOAI 3.4, apply the individual files as shown above.

## Verify

### Check MaaS CRDs are installed

The operator installs MaaS CRDs when Models-as-a-Service is set to Managed:

```sh
oc get crd | grep maas.opendatahub.io
```

Expected CRDs (RHOAI 3.4):

* externalmodels.maas.opendatahub.io
* maasauthpolicies.maas.opendatahub.io
* maasmodelrefs.maas.opendatahub.io
* maassubscriptions.maas.opendatahub.io
* tenants.maas.opendatahub.io

RHOAI 3.5+ adds three additional CRDs:

* aitenants.maas.opendatahub.io
* configs.maas.opendatahub.io
* maastenantconfigs.maas.opendatahub.io

### Check maas-api deployment

Since PostgreSQL and the `maas-db-config` secret were created in Phase 3, the `maas-api` deployment should start healthy:

{{< variant version "3.5 3.6" >}}
```sh
oc rollout status deployment/maas-api -n redhat-ai-gateway-infra --timeout=120s
```

In RHOAI 3.5+, `maas-api` runs in the `redhat-ai-gateway-infra` namespace.
{{< /variant >}}

{{< variant version 3.4 >}}
```sh
oc rollout status deployment/maas-api -n redhat-ods-applications --timeout=120s
```
{{< /variant >}}

> [!TIP]
> The `maas-api` deployment may take 30-60 seconds to appear after the DSC is applied. If it is not found, wait and retry.

### Check Tenant / Config CR

{{< variant version "3.5 3.6" >}}
In RHOAI 3.5+, the maas-controller auto-creates a cluster-scoped `Config` CR (replacing the namespaced Tenant CR from 3.4):

```sh
oc get configs.maas.opendatahub.io
```
{{< /variant >}}

{{< variant version 3.4 >}}
The maas-controller auto-creates a `default-tenant` CR in the `models-as-a-service` namespace:

```sh
oc get tenant default-tenant -n models-as-a-service
```

> [!NOTE]
> The `default-tenant` CR may show either `Ready=True` (reason `Reconciled`) or `Ready=False` (reason `DeploymentsNotReady`) at this stage. Both are normal - if it shows `Ready=False`, it will become `Ready=True` after a model is deployed in [Phase 5]({{< relref "/guide/model-deployment/maas-models" >}}).
{{< /variant >}}

### MaaS health endpoint

```sh
CLUSTER_DOMAIN=$(oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}')
curl -sk "https://maas.${CLUSTER_DOMAIN}/maas-api/health"
# Expected: {"status":"healthy"}
```

### Check OdhDashboardConfig flags

```sh
oc get odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  -o jsonpath='{.spec.dashboardConfig}' | jq .
```

Verify the following flags are set:

* `modelAsService: true` - enables the Models as a Service tab
* `genAiStudio: true` - enables the GenAI Studio tab (requires `ogx` Managed on 3.5+ or `llamastackoperator` Managed on 3.4)
* `observabilityDashboard: true` - enables the Observability tab (requires COO + monitoring configured)
* `externalModels: true` - enables the **External models** tab under **AI hub > Models > Deployments** in the Dashboard, where administrators can view deployed external models, their providers, and connection details

> [!IMPORTANT]
> The **External models** tab is a **Technology Preview** feature in RHOAI 3.5. Technology Preview features are not supported with Red Hat production service level agreements (SLAs) and might not be functionally complete. The external models functionality itself (CRDs, CLI, gateway routing) is fully supported (GA). For CLI-based external model management, see [Phase 8: External Models]({{< relref "/guide/external-models" >}}).

> [!NOTE]
> The `maasAuthPolicies` flag was removed from the OdhDashboardConfig CRD in RHOAI 3.5. Do not include it in the manifest - the admission webhook will reject it.

## What this creates

| Resource | Purpose |
| --- | --- |
| `DSCInitialization/default-dsci` | Configures applications namespace, monitoring, and trusted CA bundle |
| `DataScienceCluster/default-dsc` | Enables all RHOAI components including KServe with modelsAsService Managed |
| `OdhDashboardConfig/odh-dashboard-config` | Enables MaaS, GenAI Studio, and Observability UI tabs |
| `HardwareProfile/gpu` | Registers GPU resources with RHOAI for proper GPU scheduling |

## Troubleshooting

If components do not become ready:

```sh
# Inspect DSC conditions and events
oc describe datasciencecluster default-dsc

# Check operator logs
oc logs -n redhat-ods-operator deployment/rhods-operator --tail=100

# Check pods in the applications namespace
oc get pods -n redhat-ods-applications
```

## Appendix

### Directory Structure

```text
manifests/04-rhoai-config/
  kustomization.yaml             # Aggregates all RHOAI config resources
  dscinitialization.yaml         # DSCInitialization CR
  datasciencecluster.yaml        # DataScienceCluster CR (RHOAI 3.5+, aigateway path)
  datasciencecluster-34.yaml     # DataScienceCluster CR (RHOAI 3.4, kserve path)
  odh-dashboard-config.yaml      # OdhDashboardConfig CR
  hardwareprofile.yaml           # GPU HardwareProfile for proper GPU scheduling
```

## References

* [RHOAI 3.5 MaaS Official Docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/govern_llm_access_with_models-as-a-service/index)
* [RHOAI 3.4 MaaS Official Docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/govern_llm_access_with_models-as-a-service/index)
* [RHOAI 3.5 Installation Guide](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.5/html/installing_and_uninstalling_openshift_ai_self-managed/index)
* [RHOAI 3.4 Installation Guide](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/installing_and_uninstalling_openshift_ai_self-managed/index)
* [Upstream MaaS Documentation](https://opendatahub-io.github.io/models-as-a-service/latest/)

## Next step

Proceed to [Phase 5: Model Deployment]({{< relref "/guide/model-deployment/maas-models" >}}).
