---
id: artist-issues
title: Artist Troubleshooting
sidebar_label: Common Artist Issues
sidebar_position: 1
---

# Common Issues for Artists

If your render didn't turn out right, or if it failed to submit, check these common fixes.

## 1. Purple Textures (Missing Assets)
**The Problem:** You downloaded your final render, and many of the textures or materials are bright purple.
**The Fix:** This means you forgot to "Pack" your textures into the `.blend` file before uploading. 
* Open Blender.
* Go to **File > External Data > Pack Resources**.
* Save the file, and re-upload it to the dashboard.

## 2. Job fails immediately on Upload
**The Problem:** You click "Submit" and it instantly says "Failed: Insufficient Escrow".
**The Fix:** You do not have enough **RON** in your wallet to cover the estimated cost of the render. Go to the "Billing" tab on your dashboard and deposit more RON into your platform account.

## 3. "Transaction Failed" when depositing
**The Problem:** You try to deposit RON into the platform, but Phantom gives a red "Simulation Failed" or "Not enough SOL" error.
**The Fix:** You used all your SOL. Solana requires a tiny fraction of a penny (in SOL) to process transactions. You must keep at least `$0.50` worth of SOL in your wallet at all times just to pay network gas fees.

## 4. Render is extremely noisy
**The Problem:** The frames are finished but they look very grainy or noisy.
**The Fix:** The nodes render exactly what you tell them to. Open your file in Blender, go to the Render Properties panel, and increase your **Max Samples** or ensure the **Denoise** checkbox is checked before uploading.
