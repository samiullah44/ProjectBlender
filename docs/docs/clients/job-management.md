---
id: job-management
title: Management Portal Guide
sidebar_label: Portal Guide
sidebar_position: 3
---

# Management Portal Guide

The **RenderOnNodes Management Portal** is your central cockpit for network orchestration. It provides real-time visibility into mission status, financial finality, and agent performance.

---

## 1. Mission Configuration
When initiating a new compute mission, the portal provides a high-fidelity configuration suite.

- **Priority Allocation:** Select between *Standard* and *Priority Allocation tiers*. Priority tiers guarantee routing to the highest-trust agents with the lowest latency profiles.
- **Dynamic Chunking:** Define the fragmentation factor for your animation. The **[Distribution Engine](../concepts/scheduler-and-queues)** will automatically split your sequence into these discrete missions.
- **Resource Constraints:** Optionally restrict your mission to specific hardware tiers (e.g., "Minimum 24GB VRAM Agents").

---

## 2. Real-Time Telemetry
Once a mission is ACTIVE, the portal displays a live stream of network telemetry.

- **Global Mesh View:** Visualize your compute task fragments being processed across the global network in real-time.
- **Agent Vitals:** Monitor the thermal and load status of the specific agents assigned to your mission.
- **Log Streaming:** Real-time access to the compute output stream (stdout), allowing you to identify any environment-level exceptions immediately.

---

## 3. Financial Finality & History
The portal provides a historical audit trail for every interaction with the **Strategic Ledger**.

- **Cumulative Consumption:** Monitor your RON balance and active resource locks in real-time.
- **Transaction Proofs:** Every settlement has a corresponding cryptographic signature that links directly to a strategic explorer for public audit.
- **Historical Analysis:** Review the cost-per-frame and time-to-finality for previous missions to better estimate future project budgets.

---

## 4. Collaborative Features (Enterprise)
For studios and high-volume teams, the portal supports collaborative management.
- **Resource Buckets:** Organization-level RON pools to manage compute across multi-artist teams.
- **Telemetry Sharing:** Share real-time mission status links with stakeholders for review.

:::info[Next Step]
To understand how to interpret the performance markers and mission status signals, proceed to the **[Monitoring & Mission Finality](./monitoring)** guide.
:::
