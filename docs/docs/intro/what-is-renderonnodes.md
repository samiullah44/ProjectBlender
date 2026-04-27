---
id: what-is-renderonnodes
title: What is RenderOnNodes?
sidebar_label: What is it?
sidebar_position: 1
---

# What is RenderOnNodes?

**Mental Model:** A traditional render farm is a centralized warehouse of computers owned by a single company. **RenderOnNodes** is fundamentally different — we are a decentralized compute marketplace. We do not own the GPUs; we connect **Artists** who need rendering done to **Providers** who have idle hardware, settling payments automatically and trustlessly via a Solana smart contract.

---

## The Problem We Solve

The global demand for 3D rendering, visual effects, machine learning inference, and spatial computing is growing dramatically faster than the capacity of traditional cloud data centers. Meanwhile, an enormous quantity of high-performance consumer GPUs — NVIDIA RTX 4080s, 4090s, AMD Radeon RX 7900s — sit completely idle in homes and studios across the world for 20 or more hours per day.

These two realities create a massive economic inefficiency. **RenderOnNodes is built specifically to eliminate it.**

---

## How It Works at a High Level

At its core, the platform operates a continuous matching engine:

1. A **Compute Client** stages their project assets to the platform's secure **Staging Fabric** and defines their compute parameters. The estimated cost in **RON** is immediately locked in escrow.
2. The **Orchestration Layer** evaluates all connected Execution Agents on the network and dispatches the fragmented job to the highest-matching agent based on hardware capability and verified trust score.
3. The matched **Execution Agent** retrieves the scoped job data, processes the render in a fully isolated compute environment, and returns the finalized artifacts.
4. The **Strategic Settlement Ledger** automatically releases payment to the Agent and makes the completed frames available for retrieval by the Client.

No Client can avoid payment. No Agent can claim payment without delivering verified work. The settlement mechanism enforces both sides simultaneously at the protocol level.

<div style={{textAlign: 'center', margin: '40px 0'}}>
  <img src="/img/mesh-network.png" alt="The RenderOnNodes distributed GPU node network" style={{borderRadius: '12px', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.2)', maxWidth: '100%'}} />
  <p style={{fontSize: '0.85rem', color: '#888', marginTop: '10px'}}>A global mesh of independently operated GPU Execution Agents — dispatched, orchestrated, and settled by the RenderOnNodes platform in real time.</p>
</div>

---

## Why RenderOnNodes Over Traditional Solutions?

### Radically Lower Cost
Node Providers are monetizing hardware they already own. They have no data center leases, no enterprise-grade power contracts, and no cooling infrastructure to pay for. Those savings are passed directly to you. RenderOnNodes renders are consistently **60-80% cheaper** than equivalent compute on major cloud providers.

### Horizontal Elasticity at Scale
A centralized farm has a fixed pool of machines. When demand spikes, you wait in queue. RenderOnNodes grows with demand automatically. A 2,000-frame animation project can be distributed across 2,000 simultaneous nodes, reducing wall-clock time to a single frame's render time.

### Cryptographic Trust — No Middlemen
Payment disputes between Artists and render farms are common in traditional pipelines. On RenderOnNodes, trust is not a requirement — it is enforced by code. The Escrow Smart Contract is the impartial arbiter: it releases funds only upon cryptographic verification of a successful render.

### Full File Ownership
Your scene files are staged to an encrypted, stateless buffer — never persisted on a centralized server. Execution Agents retrieve only the specific artifacts needed for their assigned fragment and operate in isolated compute environments that are destroyed immediately upon job completion.

---

## The Two Roles in the Network

RenderOnNodes operates as a two-sided marketplace. Every user on the platform is either a **Compute Client** or a **Node Provider** — or both.

### Compute Client (Artists & Studios)
You represent the demand side of the marketplace. You create production-quality digital art, architectural visualizations, or animation sequences using **Blender (Cycles or Eevee)**. You upload your scenes to the platform, pay for compute in **RON** (our platform token), and retrieve the completed frames.

### Node Provider (Hardware Owners)
You represent the supply side. You own one or more high-performance GPUs. You install the **RenderOnNodes Execution Agent** on your machine, connect it to your settlement wallet, and let it run in the background. As long as it is online and passes hardware validation, the network will assign compute missions to your machine and credit **RON** tokens to your wallet automatically upon settlement.

---

:::tip[Ready to get started?]
Jump straight into the **[Quickstart Guide](./quickstart)** to see exactly how to get your first render submitted or your first node connected to the network.
:::
