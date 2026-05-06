---
id: artist-quickstart
title: Client Quickstart Guide
sidebar_label: Quickstart
sidebar_position: 1
---

# Client Quickstart Guide

Welcome to RenderOnNodes. As a **Compute Client (Artist)**, you can connect your wallet and immediately distribute your rendering tasks to a global fleet of GPUs without renting servers or signing contracts.

Follow these 3 easy steps to start your first network render.

## Step 1: Connect Your Wallet

The RenderOnNodes platform uses the Solana blockchain strictly for logging transactions and handling secure escrows. You do not need to understand crypto to use it.

1. Navigate to the **Web Portal** (app.renderonnodes.com).
2. Click **Connect Wallet** in the top right corner.
3. Select your provider (e.g., Phantom) and approve the connection.
4. Ensure your wallet has **RON** tokens to pay for compute, and a tiny fraction of **SOL** (e.g., $0.05) to pay for the system's ledger logging fees.

## Step 2: Prepare Your Scene

If your 3D scene references external images, caches, or HDRIs on your local hard drive, the remote network GPUs won't be able to find them. You must pack your scene before uploading.

1. Open your project in Blender.
2. Go to **File > External Data > Pack Resources**.
3. Save your `.blend` file. 

*For detailed instructions on optimizing your scene for speed, read the [Scene Preparation Guide](./scene-preparation).*

## Step 3: Launch Your Render

1. On the web portal, navigate to the **Client Dashboard**.
2. Click the **New Render Job** button.
3. Upload your packed `.blend` file.
4. Define your desired resolution and sample count.
5. Click **Submit**.

The network will automatically lock your RON escrow and distribute your frames to the network. You can watch your frames complete in real-time under the **Active Jobs** tab!

---

## Next Steps
Want to learn exactly how to manage running jobs and download your final products? Read the **[Creating & Managing Jobs](./job-management)** guide.
