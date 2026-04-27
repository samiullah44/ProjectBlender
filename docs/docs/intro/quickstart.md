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

2. **Contribute Funds:** 
   You must have a minimum balance of computing credits (**RON**) to commission jobs. These act as the fuel for the network.

3. **Upload your Scene:** 
   Navigate to the **Client Dashboard**, click "New Job." Here, you slice and encode your `.blend` file to our secure nodes. *(Read the [Job Management](../clients/job-management) guide to ensure your file is packed correctly).*

4. **Retrieve Results:** 
   Once the network consensus confirms your job is `COMPLETED`, the final mathematically-verified image will appear in your dashboard ready for download.

<div style={{textAlign: 'center', margin: '30px 0'}}>
  <img src="/img/artist-dashboard.png" alt="Artist Workflow" style={{borderRadius: '8px', border: '1px solid #10B981'}} />
  <p style={{fontSize: '0.8rem', color: '#888'}}>*The RenderOnNodes Client Dashboard.*</p>
</div>

  </TabItem>
  <TabItem value="provider" label="I want to Earn RON (Provider)">

### The Node Provider Journey

If you have a Windows PC with an NVIDIA RTX or AMD Radeon GPU and want to earn tokens for processing other people's frames:

1. **Download the Node Application:** 
   Toggle the top navigation to **"Provider"**, and download the lightweight `BlendFarm.exe` desktop app.

2. **Link your Payout Address:** 
   When you first open the app, you will be prompted to paste the public Solana address where you want to receive your earnings.

3. **Activate the Heartbeat:** 
   Click **"Start Node"**. As long as `BlendFarm.exe` is running, it will constantly poll the network looking for incoming Artist jobs that match your exact hardware specifications.

4. **Earn Tokens:** 
   Once you process jobs and cross the Settlement Threshold (see [Settlement System](../concepts/settlement-system)), RON tokens are automatically airdropped into your wallet—gas free.

<div style={{textAlign: 'center', margin: '30px 0'}}>
  <img src="/img/node-dashboard.png" alt="Provider Application" style={{borderRadius: '8px', border: '1px solid #8B5CF6'}} />
  <p style={{fontSize: '0.8rem', color: '#888'}}>*The BlendFarm.exe Desktop Node Interface.*</p>
</div>

  </TabItem>
</Tabs>

---

## Next Steps

Now that you understand the basic sequence, you need to set up the cryptography that powers your account. Proceed to the next section to configure your Solana Wallet.

:::info[Deep Dive]
If you are heavily technical and want to know *exactly* what happens between step 3 and step 4, read the [Job Lifecycle (End-to-End)](../concepts/job-lifecycle) architectural document.
:::
