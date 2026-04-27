---
id: monitoring
title: Mission Monitoring & Finality
sidebar_label: Monitoring
sidebar_position: 4
---

# Mission Monitoring & Finality

Managing a distributed compute mission requires an understanding of the automated signals used by the **Orchestration Plane**. This guide defines the operational statuses and the lifecycle of mission finality.

---

## 1. Mission Status Signals

The Management Portal displays real-time status markers for every task fragment in your project.

| Status | Strategic Meaning |
|---|---|
| **STAGING** | Project bitstream is being transferred to the **[Staging Fabric](../concepts/storage-system)**. |
| **QUEUED** | Asset validation is complete; mission is awaiting distribution engine allocation. |
| **MATCHED** | An optimal execution agent has been identified and resource locks are active. |
| **PROCESSING** | The compute core is actively executing the mission fragment. |
| **VERIFYING** | The orchestration plane is performing **[Automated Quality Logic](../concepts/job-lifecycle)**. |
| **FINALIZED** | Mission success; artifact is ready for retrieval and settlement is complete. |
| **DISPUTED** | Compute integrity check failed; mission is undergoing re-evaluation. |

---

## 2. Interpreting Performance Markers

During execution, the portal provides high-definition telemetry for the assigned agents.

- **Compute Velocity:** The real-time frames-per-minute (FPM) or samples-per-second throughput.
- **Resource Saturation:** Monitoring the agent's hardware load. A stable saturation level indicates a healthy execution environment.
- **Progress Delta:** The predicted vs. actual time-to-finality for the current mission.

---

## 3. The Verification Process (Finality)

RenderOnNodes ensures the integrity of your results before the **Strategic Ledger** initiates any reward distribution.

1.  **Deterministic Integrity Check:** The network evaluates the artifact fingerprint to ensure it matches the predicted mission outcome.
2.  **Resolution Reconciliation:** Verification that the final dimensions and bit-depth match your mission specification.
3.  **Automated Acceptance:** Once verified, the **[Settlement System](../concepts/settlement-system)** automatically releases the capital lock and notifies the portal of mission success.

---

## 4. Troubleshooting Mission Disruption

If a mission enters a **FAILED** or **DISPUTED** state:
- **Auto-Failover:** The distribution engine will automatically attempt to re-route the mission fragment to a different agent.
- **Zero Loss Policy:** You are only billed for missions that reach a **FINALIZED** state. If an agent fails, your locked capital is preserved.
- **Log Inspection:** Access the mission logs via the portal to identify if the failure was due to an internal scene error (e.g., missing dependency) or an agent network interruption.

:::info[Next Step]
For advanced integration and pipeline automation, proceed to the **[Enterprise Pipeline Integration](./advanced-rendering)** guide.
:::
