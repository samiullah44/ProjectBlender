---
id: settlement-system
title: Settlement & Payout Engine
sidebar_label: Settlement System
sidebar_position: 6
---

# Settlement & Payout Engine

**Mental Model:** The Settlement System is the network’s immutable "Clearing House." It ensures that compute value is exchanged only upon cryptographic verification of results. By automating the escrow-to-payout pipeline on-chain, RenderOnNodes removes counterparty risk and provides immediate liquidity to agents.

---

## The Distributed Escrow Mechanism

RenderOnNodes utilizes a specialized **Strategic Ledger Layer** to orchestrate all network value transfers. This system functions as a neutral, decentralized escrow vault.

### Phase 1: Capital Commitment
When a Compute Client initiates a workload request, the platform calculates the **Projected Resource Load**.
- The Client must cryptographically authorize a commitment of this value into the Escrow Vault.
- **Verification:** The distribution engine will not allocate network resources to the task until the "Capital Lock" state is confirmed on the immutable ledger.

### Phase 2: Compute Verification
Once an Execution Agent submits a mission fragment, the orchestration plane executes **Automated Quality Logic (AQL)**:
- **Integrity Validation:** Comparing output fingerprints against predicted baseline results.
- **Specification Check:** Confirming the final artifact matches the project’s technical requirements.

### Phase 3: Liquidation & Distribution
Following successful verification, the network triggers an automated liquidation:
- **Agent Remuneration (95%):** The primary portion of the locked value is transferred directly to the Agent’s settlement address.
- **Network Ecosystem Fee (5%):** A minor portion is redirected to the protocol treasury to maintain orchestration infrastructure and long-term network sustainability.

---

## Automated Remuneration Logic

To ensure maximum efficiency and network speed, agent rewards are managed via a **Settlement Threshold**.

- Rewards are tracked in real-time as **Pending Credits** for every mission fragment successfully delivered.
- Once the credit balance crosses the platform’s **Operational Threshold**, the system automatically triggers a ledger-level payout.
- **Platform Managed Costs:** The network internally manages all interaction costs for these automated payouts. Agents receive 100% of their cross-threshold earnings without losing value to transaction fees.

---

## Strategic Transparency

Because the network logic is anchored to a strategic ledger, every payout is verifiable and auditable. 
Agents and Clients can view their **Reference Signatures** within the management portal to confirm the status and proof of payment on the public ledger.

---

## Handling Exceptions

In the rare event of a fragmented delivery or execution anomaly:
1. The orchestration plane flags the specific mission segment for review.
2. The committed funds remain in the escrow vault temporarily.
3. If a failure is verified (agent interruption or data corruption), the locked value is **returned to the Client**.
4. The Agent receives no reward and incurs a reputation penalty within the network performance registry.

:::info[Security Note]
The Backend's authority to release funds is restricted by a multi-signature wallet logic, ensuring that any single server compromise cannot drain the network's global escrow funds.
:::
