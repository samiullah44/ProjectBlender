---
id: advanced-rendering
title: Enterprise Pipeline Integration
sidebar_label: Pipeline Integration
sidebar_position: 5
---

# Enterprise Pipeline Integration

For high-volume production studios and automated pipelines, RenderOnNodes provides extensive integration options. These tools allow you to bypass the manual portal interface and embed distributed compute directly into your asset management lifecycle.

---

## 1. The Strategic Control CLI
The **RenderOnNodes CLI** is a lightweight binary designed for headless integration and automation.

- **Non-Interactive Authentication:** Use ephemeral session tokens to authorize compute missions from CI/CD runners or local script environments.
- **Dynamic Mission Generation:** Programmatically generate mission specifications, facilitating massive batch submissions across multiple project files.
- **Real-Time Log Ingestion:** Stream mission telemetry directly into your internal monitoring systems (e.g., ELK stack, Datadog, or custom internal dashboards).

### Core Command Set
The CLI operates on an abstract command model:
- `auth`: Bond your local environment to your strategic settlement address.
- `stage`: Initiate an optimized bitstream transfer to the **[Staging Fabric](../concepts/storage-system)**.
- `execute`: Trigger a distribution mission with custom priority and parallelization flags.
- `retrieve`: Automated collection of finalized artifacts upon mission completion.

---

## 2. API Integration (Headless Orchestration)
The **Network Control API** provides direct access to the orchestration plane for deep application-level integration.

- **Webhooks:** Register listeners for mission finality, data disputes, or financial settlement events.
- **Global Mesh Registry:** Query real-time network throughput and agent availability to optimize your internal production scheduling.
- **Resource Management:** Programmatically manage RON allocations and resource locks for sub-teams and projects.

---

## 3. High-Fidelity Infrastructure Customization
Enterprise users can leverage the **Proprietary Distribution Engine** to create customized resource pools.

- **Private Agent Groups:** Restrict mission distribution to a specific set of verified high-performance agents for extreme data security or precision requirements.
- **Optimized Throughput Tiers:** Custom prioritization logic designed for near-instant turnaround on mission-critical visual effects.

---

## 4. Integration Best Practices
- **Token Hygiene:** Always use time-limited session tokens for automated runners.
- **Dependency Isolation:** Ensure your staging logic utilizes relative path normalization to prevent environment-level failure in distributed contexts.
- **Monitoring Automation:** Utilize webhooks to trigger downstream pipeline steps (e.g., automated compositing or color grading) the moment a mission reaches **FINALIZED** status.

:::info[Next Step]
To explore the technical specifications and developer-specific documentation, proceed to the **[Developer API Reference](../api/reference)**.
:::
