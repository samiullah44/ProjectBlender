---
id: artist-quickstart
title: Artist Quickstart Guide
sidebar_label: Quickstart
sidebar_position: 1
---

# Artist Quickstart Guide

Welcome to the RenderOnNodes network. This guide provides a three-phase blueprint to transition from local production to distributed, high-velocity compute.

---

## Phase 1: Authentication & Ledger Bonding
To interact with the network, you must establish a secure session through the **Management Portal**.

1.  **Identity Verification:** Access the [RenderOnNodes Portal](https://app.renderonnodes.com) and authenticate using your preferred strategic wallet.
2.  **Asset Collateral (Optional):** Ensure your settlement address holds sufficient **RON** (Compute Credits) and a marginal **SOL** reserve for ledger interaction fees.
3.  **Active Session:** Once bonded, the portal will provide real-time telemetry regarding your current compute limits and account standing.

---

## Phase 2: Strategic Asset Staging
RenderOnNodes utilizes a **Stateless Staging Fabric** to handle large-scale project files without central bottlenecks.

1.  **Project Introspection:** Use the **One-Click Plugin** or the dedicated **Staging Engine** to scan your scene for external dependencies (textures, cache files, HDRIs).
2.  **Autonomous Staging:** The system will automatically package these dependencies and initiate a 256-bit encrypted stream to the staging buffer.
3.  **Validation:** Once the bitstream transfer is complete, the network controller verifies the integrity of the staged artifacts before enabling mission initiation.

---

## Phase 3: Mission Initiation & Execution
With your assets staged, you are ready to trigger a distributed compute mission.

1.  **Configuration:** Define your mission parameters (Parallelization factor, Output resolution, Priority tier).
2.  **Escrow Authorization:** Sign the programmatic fund lock. This secures the compute resources required for your task.
3.  **Distribution:** The **[Optimized Distribution Logic](../concepts/scheduler-and-queues)** immediately allocates your task fragments across the global agent pool.
4.  **Finality Progress:** Monitor the real-time progress via the **Live Monitoring Dashboard**.

---

## Next Steps
For detailed instructions on optimizing your scene for the network's distribution engine, proceed to the **[Asset Management & Preparation](./scene-preparation)** guide.
