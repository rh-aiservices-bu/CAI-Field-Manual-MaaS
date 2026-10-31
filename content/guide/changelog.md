---
title: Guide Changelog
description: Changes to the Red Hat OpenShift AI Models as a Service companion guide since the project started in June 2026.
weight: 130
---

Changes to the Red Hat OpenShift AI Models as a Service companion guide since the project started in June 2026. Covers new guide phases, automation improvements, bug fixes, and community contributions.

Each entry links to its pull request for full details.

## October 2026

### New Pages

- **MaaS:PAL Automated Verification** - A new section to explain the MaaS:PAL community plugin to help with MaaS configuration verification ([#192](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/170))

### Features

- **HTTP Proxy for External Models** - New section in the external models page for clusters that can only reach provider APIs through a corporate HTTP proxy, with Azure OpenAI as the worked example. Explains why there is no proxy setting to turn on (Envoy ignores `HTTP_PROXY`, Istio `tunnel` does not apply to HTTP routes, `http_11_proxy` EnvoyFilters cannot attach to the reconciler-generated cluster on Envoy 1.35, and the `tls`/`port` annotations are 3.4 only), then documents the egress tunnel pattern that keeps TLS end-to-end to the provider. Includes Kustomize manifests with a lab proxy for testing. ([#194](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/194))

### Fixes

- **Version Notes in Phase 1** - Added an orientation-only table of the OCP / RHOAI / RHCL versions the guide is exercised against, pointing at the supported configurations matrix as the authoritative source, plus a note on how the Red Hat AI subscription guide describes RHCL entitlement for MaaS. Dropped the stale "pin to 1.3.4" suggestion from the troubleshooting checklist. ([#189](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/189))

- **WASM Auth Timeout in External Models Guide** - Added Known Issue entry for the WASM auth timeout (RHOAIENG-71638) to the external models page so users hitting HTTP 500 under load can find the fix directly. Also bumped the recommended AUTH_SERVICE_TIMEOUT from 2s to 10s based on field feedback. ([#186](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/186))

- **CORS Undo Status Code** - Fixed expected status code in the CORS guide undo section: stock gateway returns 404 on OPTIONS (no HTTPRoute match), not 401 as originally documented. ([#185](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/185))

## September 2026

### New Pages

- **Multi-Tenancy Reference** - What RHOAI 3.5 MaaS multi-tenancy covers: tenants vs instances, dedicated vs shared resources, isolation boundaries, AITenant provisioning walkthrough, and quick answers for the common questions. ([#170](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/170))

- **API Key Security Reference** - Deep dive into MaaS API key internals: key anatomy, hash derivation, ValidateAPIKey flow, IDOR protection, lifecycle management, and 8-threat model. ([#129](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/129))

- **Model Swap Reference** - How to swap a model backend without customer-facing changes. Covers MaaSModelRef hierarchy, 6-step migration procedure, BBR endpoint routing, and concrete Qwen 3.6→3.8 swap templates. ([#113](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/113), [#134](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/134))

- **Platform Upgrade Guide (3.4 → 3.5)** - End-to-end 10-step MaaS migration guide covering DSC fields, namespace migration, ExternalModel API changes, and dashboard config. ([#119](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/119))

- **Demos Page** - 5 presenter-ready demos for subscription tiering, priority resolution, OIDC authentication, service account access, and JWKS cache validation. Contributed by deewhyweb. Grouped by parent phase with inline TIP pointers from Phase 5 and Phase 9. ([#152](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/152), [#153](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/153))

### Features

- **Admin Key Management FAQ** - New section in the API Key Security page: why keys cannot be created on behalf of another user (and what works instead: self-service, IdP tokens with external OIDC, ServiceAccount tokens), and why there is no per-user key cap (quota is per subscription, not per key). ([#172](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/172))

- **Site Search** - Search box in the top navbar, powered by the official Antora Lunr extension. Client-side index built at build time, results grouped by page with section deep links and snippets. ([#171](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/171))

- **Verify Guide Skill Documentation** - Added `/verify-guide` skill to the Claude Code guide page with usage, arguments, phases table, and description of all 6 verification phases. ([#166](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/166))

- **Azure OpenAI External Model Provider** - Added Azure OpenAI as fifth external model provider with Kustomize manifests, setup/cleanup script support, and gpt-4.1-mini as default model. Uses the `azure-openai` BBR provider type. ([#168](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/168))

- **Anthropic External Model Provider** - Added Anthropic (Claude Haiku 4.5) as fourth external model provider with Kustomize manifests, setup/cleanup script support, and RHOAIENG-93984 known issue documentation for /v1/messages token counting gap. ([#164](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/164))

- **Phase 9: External OIDC Authentication** - Full Keycloak integration with PostgreSQL backend, realm import, automation script, and 6-check test suite. Supports corporate SSO with JWT claim-based authorization. ([#98](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/98))

- **Loki-based Usage Dashboards** - Added Loki Operator, MinIO, and LokiStack manifests to Phase 7. When usage logging is enabled, operator auto-creates EnvoyFilter, OTEL Collector, Tenancy Proxy, and Perses dashboards. RHOAI 3.5+ only. ([#96](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/96))

- **Qwen3-0.6B CPU-only Model** - First model in the guide that does not need a GPU. Runs on vLLM CPU runtime with 4-8 CPU and 16Gi memory. ([#133](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/133))

- **Limitador Persistence with Redis** - Added dev Redis deployment and Limitador CR patch so rate-limit counters survive pod restarts. New `--with-redis` flag for setup-maas.sh. ([#142](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/142))

- **External Models Dual 3.4/3.5 Support** - Added ExternalProvider + ExternalModel manifests for RHOAI 3.5 new `inference.opendatahub.io/v1alpha1` API. Tabs blocks in docs and version branching in setup script. ([#88](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/88))

- **Gateway Proxy Workaround** - On OCP < 4.22 behind corporate proxy, gateway pod does not get cluster-wide proxy settings. Added Step 5f with ConfigMap template for HTTP_PROXY/HTTPS_PROXY/NO_PROXY env vars. ([#137](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/137))

- **Gateway Telemetry Auto-Creation** - Replaced manual `oc apply -k` telemetry step with MaasTenantConfig/Tenant CR patch. The RHOAI operator (`maas-controller`) auto-creates TelemetryPolicy and Istio Telemetry when `spec.telemetry.enabled: true` is set. Added 3.4/3.5 tabs and optional per-user metrics toggle. ([#146](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/146))

- **Governance Pairing Documentation** - Both MaaSAuthPolicy AND MaaSSubscription must reference the same model for Ready state. Day 2 patch commands included. ([#117](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/117))

- **ServiceAccount-Scoped Subscriptions** - New section in Phase 5 showing how to scope a MaaSSubscription to a specific ServiceAccount via `spec.owner.users`. Useful for CI/CD pipelines and batch jobs that need their own rate limits. ([#150](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/150))

- **External Models Dashboard Documentation** - Added Technology Preview callout for the External models tab in the RHOAI Dashboard (AI hub > Models > Deployments). New section in Phase 8 with screenshot showing the model listing and provider details. ([#156](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/156))

### Fixes

- **Broken Official Docs Links** - The RHOAI 3.5 docs renamed the MaaS chapter chunk and retired two anchors, breaking five deep links in Phases 2, 7, and 8. All links now point at the correct per-version chunk and anchors, verified against the live docs. ([#170](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/170))

- **Live Install Review Fixes** - Docs, script, and demo fixes from a full manual install review: Phase 3 namespace pre-create for 3.5+, Phase 9 Keycloak hostname patch, verify.sh now keeps pre-existing models at cleanup, demo subscription priorities raised above the generic model tiers, and gpt-oss-20b VRAM corrected to ~16 GiB (runs quantized on a 24 GB L4). ([#169](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/169))

- **UWM No Longer Required in RHOAI 3.5** - Marked User Workload Monitoring as optional in Phase 2. RHOAI 3.5 uses COO's MonitoringStack for metrics collection. UWM is still useful for forwarding metrics to external tools. ([#167](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/167))

- **Phase 4 CRD Race Condition** - DSC triggers async CRD registration. Script was applying HardwareProfile before CRD existed. Added wait_for_crd() helper. ([#108](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/108))

- **OGX Rename for RHOAI 3.5** - RHOAI 3.5 renamed llamastackoperator to ogx. Old key was silently ignored, blocking Playground from appearing. ([#110](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/110))

- **IPP-managed Label for External Models** - RHOAI 3.5 changed secret label from `bbr-managed` to `ipp-managed`. Without correct label, apikey-injection watcher never picks up the secret and inference returns 500. ([#90](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/90))

- **Stale DNSRecord After Gateway Service Type Change** - When gateway switches from LoadBalancer to ClusterIP, stale dnsrecord pointing to defunct AWS ELB is not cleaned up. Added troubleshooting entry with diagnosis and workaround. Filed RHOAIENG-93962. ([#140](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/140))

- **HTTPRoute Rule Name Collision** - RHOAI 3.5 hardcoded HTTPRoute rule names. Multiple models on the same gateway cause Istio to merge duplicate rules, sending all traffic to one EPP. Documented as known issue. ([#139](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/139))

- **Body-Based Routing Curl Examples** - All inference curl examples across 5 guide pages, verify.sh, and setup-maas.sh now use body-based routing at `/v1/chat/completions` with the correct model ID from `/v1/models`. Local models require the canonical `publishers/{namespace}/models/{model-name}` format - short names return 404. Also added `qwen3-06b` to VALID_MODELS. ([#147](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/147))

- **13 Documentation Fixes from Full Guide Review** - Broken xref anchor, wrong Roo Code URL, missing namespace in oc patch, stale llamastackoperator ref, missing externalModels flag, wrong OCP version, and more across 10 files. ([#124](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/124))

- **Gateway-access Namespace Labeling for RHOAI 3.5** - Phase 2 tried to label `redhat-ai-gateway-infra` before it exists. Moved labeling to Phase 4 with safety-net re-label. ([#101](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/101))

- **OperatorGroup Skip for Pre-installed Operators** - OLM only allows one OperatorGroup per namespace. Script now checks for existing groups and skips if present. ([#104](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/104))

- **Authorino Patch Race on Fresh Install** - Script tried to patch Authorino CR before it exists. Added existence check with Phase 3 retry logic. ([#114](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/114))

- **3.4 to 3.5 Upgrade Path Bugs** - Channel not restored on cluster after `--rhoai-version 3.4`, and DSC not updated during upgrade with `--from-phase 4`. ([#84](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/84))

- **OTEL Collector Proxy Interception** - On proxied clusters, OTEL collector routes TargetAllocator request through corporate proxy. Root cause: short hostname without .svc suffix. Workaround patches OTel CR spec.env. Filed RHOAIENG-91640. ([#105](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/105))

## August 2026

### New Pages

- **Post-Upgrade Troubleshooting** - 10 most common 3.4→3.5 upgrade issues with symptoms, diagnosis commands, and workarounds. Covers MCP OOM, ExternalModel migration, gateway label mismatch, hostname discovery, and more. All issues linked to Jira. ([#79](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/79))

- **Cleanup and Teardown Guide** - New Phase 9 cleanup page with `cleanup-maas.sh` script. Reverses setup in 7 phases, supports `--dry-run`, `--keep-operators`, `--from-phase`, `--yes`. ([#56](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/56))

### Features

- **RHOAI 3.4/3.5 Dual-Version Support** - Auto-detects RHOAI version from CSV. AI Gateway modularization (`kserve.modelsAsService` -> `aigateway.modelsAsAService`), dual DSC manifests, version tabs in docs. Validated across 10 walkthroughs. ([#76](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/76))

- **Disconnected/Air-gapped Full Support** - Phase 0 docs, ImageSetConfiguration, ITMS manifests, GPU MachineSet template. Added Gemma 2 9B IT FP8 model for single A10G GPU. Fixed internal LB annotation for AWS disconnected. ([#57](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/57), [#58](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/58), [#59](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/59))

- **WASM Shim for Disconnected Clusters** - Kuadrant WASM shim is fetched via OCI at runtime, bypassing CRI-O/IDMS. Added RELATED_IMAGE_WASMSHIM patch and WASM shim to ImageSetConfiguration/ITMS. ([#59](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/59))

- **GPU HardwareProfile and Model Cleanup** - Added HardwareProfile CR to Phase 4 for proper GPU scheduling. Removed T4 (compute capability 75 too low for FP8) and A10G (tensor tile size error with current vLLM) from supported GPUs. ([#72](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/72))

### Fixes

- **Custom Hostname Support** - Added `--maas-hostname` flag and `MAAS_HOSTNAME` env var. Fixed CSV wait on fresh clusters. Commented out TelemetryPolicy fields that crash Wasm shim before RHOAI 3.4.4. ([#71](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/71))

- **Istiod/Proxyv2 Images for Disconnected OCP >= 4.20.32** - Ingress operator embeds Istio (sail library) instead of standalone OSSM. Images are not in any catalog, causing ImagePullBackOff. Added discovery commands. ([#75](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/75))

- **RHCL Pin Removed** - Removed v1.3.4 pin since RHCL v1.4.2 fixes the WASM bugs. ([#56](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/56))

- **Skip ModelControllerReady on RHOAI 3.5+** - DSC condition was removed in 3.5, causing setup script to wait 300s for nothing on every fresh install. ([#78](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/78))

- **GPU Driver DTK Kernel Check** - Made the kernel check the gate for GPU driver builds on disconnected clusters. Driver builds only needed when DTK image kernel does not match the node. Contributed by deewhyweb. ([#69](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/69))

## July 2026

### Changes

- **OSSM3 Removal** - On OCP 4.20+, openshift-ingress manages OSSM internally. Pre-installing servicemeshoperator3 blocked the gateway controller. Removed OSSM subscription and all manual OSSM references. ([#45](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/45), [#46](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/46))

- **Verify-guide Claude Code Skill** - New automation skill that runs a full naive-user walkthrough on a live cluster. Covers 6 phases: cluster login, setup-maas.sh, verify.sh E2E (15 checks), 8 blind-spot regression checks, guide content verification, and report. ([#49](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/49))

- **Pipefail and RHCL Install Plan Fixes** - Fixed Phase 5 crash when all model pods are healthy (grep exit 1 under pipefail). Fixed RHCL install plan approval to use subscription status lookup. ([#50](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/50))

## June 2026

### Initial Release

- **Guide Launch** - Antora documentation site deployed on GitHub Pages. Phases 1-7 covering prerequisites, platform config, MaaS platform, RHOAI config, model deployment, verification, and observability. Includes `setup-maas.sh` automation script and Kustomize manifests for each phase.

- **Alpha Testing** - Initial alpha-test feedback from bryonbaker and nueda-rh covering content accuracy, missing steps, typo fixes, and redundant verification removal. ([#2](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/2), [#3](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/3), [#4](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/4), [#8](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/8))

### Features

- **Architecture and Request Flow Reference** - New reference page with 4-layer component overview, 8-step request flow walkthrough, Mermaid diagrams, and FlowStory interactive visualizer link. ([#12](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/12))

- **Phase 8: External Models** - Added ExternalModel support for OpenAI (gpt-4o-mini), Google Gemini (gemini-2.5-flash), and AWS Bedrock. Kustomize manifests, `--external-model-provider` flag, and full documentation. ([#20](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/20), [#21](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/21))

- **Gateway OOMKill Persistent Fix** - Replaced temporary `oc patch deployment` workaround with persistent ConfigMap + `spec.infrastructure.parametersRef` approach. Survives Istio reconciliation. ([#26](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/26))

- **Gateway Namespace Binding Restriction** - Switched gateway from `allowedRoutes.namespaces.from: All` to `from: Selector` with `maas.opendatahub.io/gateway-access=true` label. Only labeled namespaces can attach HTTPRoutes. ([#36](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/36))

- **DSCI Monitoring Configuration** - Phase 7 installed observability operators but never configured the DSCI to use them. Added DSCI patch with metrics and traces configuration. ([#37](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/37))

### Fixes

- **End-to-End Testing Fixes** - Fixed 5 script bugs (CSV timeout, Kuadrant pod restart label, ODH namespace label, RHOAI version parsing, OdhDashboardConfig race) and 2 doc inaccuracies from first live cluster testing. ([#14](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/14))

- **Expected Outputs Update for RHOAI 3.4.0** - Updated CSV versions, route/TLS output, CSV column names, API key creation command, verification pass count, and replaced static placeholders with shell variables. ([#16](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/16))

- **RHCL Pinned to v1.3.4** - RHCL 1.4.0 had WASM plugin loading issues causing gateway errors and breaking the RHOAI model UI. Added startingCSV + Manual install plan approval. ([#32](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/32))

- **GPU Operand Instances** - Added ClusterPolicy and NodeFeatureDiscovery CRs to Phase 1 manifests. Without these, GPU operator does not install drivers. ([#33](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/33))

- **MetalLB IP Collision on SNO** - Using node's own InternalIP for MetalLB caused kube-proxy iptables to hijack port 443 traffic, breaking OAuth callbacks, console access, and in-cluster `*.apps` routes. Now derives MetalLB IP as node IP + 1. ([#40](https://github.com/rh-aiservices-bu/rhoai-maas-guide/pull/40))

## Contributors

| Contributor | Contributions |
| --- | --- |
| rcarrata | Primary author - guide content, automation scripts, Kustomize manifests |
| bryonbaker | Alpha testing review and documentation feedback |
| deewhyweb | MaaS entitlement and authentication demos, GPU driver DTK kernel check |
| nueda-rh | Platform configuration fixes |
| rafpcloud | Dashboard namespace labeling |
| skoussou | README link fixes |
| Surote | Custom hostname support and dashboard feature flags |
| stefan-bergstein | OperatorGroup pre-install bug report |

Issue reporters: hupiper, guimou, svalluru, erwangranger.
