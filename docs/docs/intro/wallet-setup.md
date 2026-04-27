---
id: wallet-setup
title: Setting up a Solana Wallet
sidebar_label: Wallet Setup
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Setting up a Solana Wallet

**Mental Model:** RenderOnNodes does not use usernames, passwords, or email addresses. Your **Solana Wallet** is your universal identity on the platform — simultaneously your authentication credential and your payment instrument. You maintain complete, sovereign custody over your assets at all times.

This guide covers the full installation and connection procedure for both supported wallets.

---

## Choosing a Wallet

RenderOnNodes supports two Solana wallets: **Phantom** and **Solflare**. Both are non-custodial browser extensions, meaning no company ever holds your private keys.

> **Decision Point: Phantom vs. Solflare**
>
> - **Phantom** is recommended for most users. It is the most widely adopted Solana wallet and features an extremely intuitive UI optimised for onboarding. If you are new to Web3, start here.
> - **Solflare** is preferred by experienced Solana users and those who want more granular control over transaction signing, hardware wallet integration, and staking management.

---

## Installation Procedure

<Tabs>
  <TabItem value="phantom" label="Phantom" default>

### Step 1: Install the Browser Extension
Navigate to the official **[Phantom website](https://phantom.app/)** and click **"Download"**. The extension is available for Chrome, Brave, Firefox, and Edge.

:::tip
Always verify you are on the official `phantom.app` domain. Fake wallet extensions are a common vector for theft.
:::

### Step 2: Create a New Wallet
After installation, open the extension from your browser toolbar and select **"Create a new wallet"**. You will be prompted to set a local device password. This password only unlocks the extension on your current computer — it does not control your funds.

### Step 3: Secure Your Secret Recovery Phrase

:::danger[This step is irreversible]
Phantom will display a **12-word Secret Recovery Phrase**. This phrase is the only way to restore access to your wallet on any device.

**Mandatory rules:**
- Write it down on physical paper. Never type it into any website or application.
- Store it in a secure, private location (a safe is ideal).
- Never share it with anyone — not with RenderOnNodes support, not with Phantom support, not with anyone.

If you lose this phrase and lose access to your device, your computing credits are permanently unrecoverable.
:::

  </TabItem>
  <TabItem value="solflare" label="Solflare">

### Step 1: Install the Browser Extension
Navigate to the official **[Solflare website](https://solflare.com/)** and select **"Access Web Wallet"** or click the browser extension install link for Chrome, Brave, or Firefox.

:::tip
Verify you are on the official `solflare.com` domain before entering any information.
:::

### Step 2: Create a New Wallet
Open the extension and select **"I need a new wallet"**. Follow the guided setup to configure a local device password for the extension.

### Step 3: Secure Your Mnemonic Seed Phrase

:::danger[This step is irreversible]
Solflare will present a **12-to-24 word Mnemonic Seed Phrase**. This is your master key.

**Mandatory rules:**
- Record it using pen and paper only. No screenshots, no cloud notes, no password managers.
- Store it physically in a location you alone control.
- Never enter it into any website or form — any legitimate application will never ask for it.

Loss of this phrase means permanent, irrecoverable loss of all wallet assets.
:::

  </TabItem>
</Tabs>

---

## Connecting to RenderOnNodes

Once your wallet extension is installed and your recovery phrase is secured offline, connect it to the platform:

1. Open the **[RenderOnNodes application](https://renderonnodes.com)** in your browser.
2. Click the **"Client"** or **"Provider"** button in the top navigation bar, depending on your intended role.
3. A wallet connection modal will appear. Select your wallet — **Phantom** or **Solflare**.
4. Your wallet extension will open and request connection approval. Review the permissions and click **"Connect"**.

You are now authenticated. Your public wallet address — a string resembling `5J2kBz8...yRt9` — is your permanent RenderOnNodes identity. No email or password is associated with your account; the cryptographic key pair inside your wallet is the authentication mechanism itself.

---

:::info[Next Step]
Now that your wallet is connected, proceed to **[The Token Economy](./token-economy)** to understand what tokens you need and how to fund your account for your first render job.
:::
