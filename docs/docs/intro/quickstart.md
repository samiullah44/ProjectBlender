---
id: quickstart
title: Platform Quickstart
sidebar_label: Quickstart
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Platform Quickstart

To get started on RenderOnNodes, you need to decide if you are uploading files to be rendered, or if you are providing hardware to earn money.

**Choose your path below to see exact setup instructions:**

<Tabs groupId="user-role">
  <TabItem value="client" label="I am an Artist (Rendering)" default>

### How to Start Rendering

If you have a `.blend` file and want to render it using the network:

1. **Get a Wallet:** Install the **Phantom** browser extension. [(See Wallet Setup)](./wallet-setup).
2. **Login:** Go to the [RenderOnNodes Portal](https://app.renderonnodes.com) and click **Connect Wallet**.
3. **Submit a Render:** On the Client Dashboard, click the bright blue **New Render Job** button in the top right.
4. **Track Progress:** Watch the real-time telemetry like **Frames Today** and monitor your **Active Jobs** ledger directly from the dashboard.

<div style={{textAlign: 'center', margin: '30px 0'}}>
  <img src={require('@site/static/img/client-dashboard-new.png').default} alt="RenderOnNodes Client Dashboard" style={{borderRadius: '8px', border: '1px solid #10B981', boxShadow: '0 10px 30px rgba(0,0,0, 0.5)', maxWidth: '100%'}} />
</div>

  </TabItem>
  <TabItem value="provider" label="I am a Node Provider (Earning)">

### How to Start Earning Provider

If you have a Windows PC with a powerful GPU and want to earn money:

1. **Get a Wallet:** Install the **Phantom** browser extension. This is where your earnings will be automatically sent. [(See Wallet Setup)](./wallet-setup).
2. **Login:** Go to the [RenderOnNodes Portal](https://app.renderonnodes.com) and toggle to the **Provider** view at the top.
3. **Set Payout Wallet:** In the large **Payout Wallet** section, paste your Solana address and click **Save**. (You cannot receive jobs without doing this).
4. **Download Software:** Click the **Node Software** button to download the execution agent.
5. **Add Node:** Click the purple **+ Add Node** button to register your machine and start earning.

<div style={{textAlign: 'center', margin: '30px 0'}}>
  <img src={require('@site/static/img/provider-dashboard-new.png').default} alt="RenderOnNodes Provider Dashboard" style={{borderRadius: '8px', border: '1px solid #8B5CF6', boxShadow: '0 10px 30px rgba(0,0,0, 0.5)', maxWidth: '100%'}} />
</div>

  </TabItem>
</Tabs>
