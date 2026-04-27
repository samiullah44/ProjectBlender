---
id: quickstart
title: Platform Quickstart
sidebar_label: Quickstart
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quickstart: From 0 to Render

**Mental Model:** RenderOnNodes is a **two-sided marketplace**. You are either *buying* compute power (Client) or *selling* compute power (Provider). The network connects you cryptographically.

This guide is the fastest way to get your machine connected, regardless of which side of the marketplace you are joining.

---

## Choose Your Path

> **Decision Point:** Are you a 3D Artist who needs scenes rendered instantly, or are you a Hardware Owner with a high-end GPU looking to earn passive income?

Select your path below to see your specific quickstart guide:

<Tabs groupId="user-role">
  <TabItem value="client" label="I want to Render Scenes (Client)" default>

### The Compute Client Journey

If you have a `.blend` file and want to use the network's decentralized GPUs to render it at blistering speeds:

1. **Connect your Wallet:** 
   Click the **"Client"** button on the top right of the navigation bar, and connect your Solana Phantom or Solflare wallet.
   *(Don't have a wallet? Read the [Wallet Setup Guide](./wallet-setup)).*

2. **Fund your Account:** 
   Ensure your account holds a sufficient balance of **RON** (Compute Credits). These credits are the economic fuel of every compute mission on the network.

3. **Submit your Mission:** 
   Navigate to the **Management Portal** and create a new compute mission. The platform will stage your scene assets to the secure **Staging Fabric** and initialize the job allocation pipeline. *(Read the [Asset Preparation](../clients/scene-preparation) guide to ensure your project is correctly packaged).*

4. **Retrieve Results:** 
   Once the network verifies your job has reached **FINALIZED** status, the completed frames become available for retrieval directly from your portal dashboard.

:::note[Screenshot Coming Soon]
This section will include a screenshot of the live RenderOnNodes Management Portal. Please provide a screenshot of your dashboard so we can embed an accurate, up-to-date visual here.
:::

  </TabItem>
  <TabItem value="provider" label="I want to Earn RON (Provider)">

### The Node Provider Journey

If you have a Windows PC with an NVIDIA RTX or AMD Radeon GPU and want to earn tokens for processing other people's compute missions:

1. **Download the Execution Agent:** 
   Toggle the top navigation to **"Provider"** and download the **RenderOnNodes Execution Agent** — a lightweight desktop application.

2. **Link your Settlement Address:** 
   When you first open the application, you will be prompted to connect your Solana wallet. This is the address where your earned **RON** will be automatically delivered.

3. **Activate the Agent:** 
   Click **"Start Agent"**. As long as the Execution Agent is running and your system passes performance validation, the network's **[Distribution Engine](../concepts/scheduler-and-queues)** will autonomously assign compute missions to your hardware.

4. **Earn Tokens Automatically:** 
   Once your agent completes verified missions and crosses the **[Settlement Threshold](../concepts/settlement-system)**, RON tokens are automatically credited to your wallet — platform-managed, gas free.

:::note[Screenshot Coming Soon]
This section will include a screenshot of the live RenderOnNodes Node Agent interface. Please provide a screenshot of the agent running on your machine so we can embed an accurate, up-to-date visual here.
:::

  </TabItem>
</Tabs>

---

## Next Steps

Now that you understand the basic sequence, you need to set up the cryptography that powers your account. Proceed to the next section to configure your Solana Wallet.

:::info[Deep Dive]
If you are heavily technical and want to know *exactly* what happens between step 3 and step 4, read the [Job Lifecycle (End-to-End)](../concepts/job-lifecycle) architectural document.
:::
