---
id: provider-issues
title: Provider Troubleshooting
sidebar_label: Common Provider Issues
sidebar_position: 2
---

# Common Issues for Providers

If your node is not receiving jobs, or if you aren't seeing your earnings increase, check the following issues.

## 1. Node is stuck on "Validating"
**The Problem:** You started the Desktop App, but it has been stuck in the Validating phase for over 10 minutes.
**The Fix:** The platform is testing your hardware. Check your task manager. If Blender is running but using 0% GPU, your drivers may be out of date. Update your NVIDIA Game Ready or Studio Drivers and restart the computer.

## 2. Low Trust Score warning
**The Problem:** Your dashboard shows a warning that your Trust Score has dropped, and you are receiving fewer jobs.
**The Fix:** Your computer is likely failing jobs. This is almost always caused by **Thermal Throttling**. If your GPU hits 90°C during a heavy render, the computer might slow down significantly or crash Blender entirely, failing the job. Improve the cooling in your case, or use software like MSI Afterburner to set a Power Limit on your GPU.

## 3. Earnings are not showing in Phantom
**The Problem:** The node finished a job, your dashboard shows "Earnings: +1.5 RON", but you don't see it in your Phantom Wallet.
**The Fix:** Payouts are batched to save on blockchain fees. The platform waits until you have earned a certain minimum threshold before grouping the payments and sending them directly to the blockchain. Check your dashboard for your "Pending Balance" versus "Settled Balance".

## 4. Desktop App says "Cannot Connect to Orchestrator"
**The Problem:** The Node Software refuses to connect to the network.
**The Fix:** Your Windows Firewall or Router is blocking the connection. Ensure that the RenderOnNodes Execution Agent has permission to pass through Windows Defender, and ensure your internet connection is stable.
