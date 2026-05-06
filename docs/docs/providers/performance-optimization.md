---
id: performance-optimization
title: Performance Optimization
sidebar_label: Performance Optimization
sidebar_position: 4
---

# Performance Optimization

As a Node Provider, your goal is to process as many frames as quickly as possible to maximize your accumulation of **RON** tokens. TheRenderOnNodes Distribution Engine highly prioritizes faster nodes.

This guide outlines practical steps you can take to optimize your hardware for the network.

## Understand the Distribution Logic

The network evaluates your node based on three main criteria:
1. **Hardware Specifications:** Total VRAM and CUDA Core / Stream Processor count.
2. **Uptime Reliability:** Your machine's historical response time to "are you there?" heartbeats.
3. **Execution Speed:** Your historical average frame time compared to peers on the network.

If two nodes have identical hardware, the node that historically renders frames faster will get the job.

## Practical Optimization Steps

### 1. Dedicated Execution
Do not use your computer for heavy tasks (like gaming or local rendering) while the Execution Agent is active. The engine detects resource contention. If you are gaming while trying to process a network render, your frame time will drop drastically, and the network will quickly assign the job to someone else, negatively impacting your trust score.

### 2. Thermal Management
Rendering is an intensely thermal process. If your GPU hits its thermal limit (usually around 83°C for NVIDIA cards), it will "thermal throttle" and reduce its clock speed to prevent damage. This drastically increases your render times.
* **Fan Curves:** Use software like MSI Afterburner to set an aggressive fan curve. You want your fans ramping up to 80-100% *before* the card hits 75°C.
* **Airflow:** Ensure your physical chassis has adequate intake and exhaust airflow. 
* **Undervolting:** Advanced users can undervolt their GPU. This often allows the card to maintain higher sustained clock speeds while generating less heat.

### 3. Disable Sleep and Hibernation
The network cannot assign jobs to a sleeping computer.
1. Open Windows Settings > System > Power & Sleep.
2. Set "Screen" and "Sleep" to **Never**.
3. Under "Additional power settings", ensure you are using the **High Performance** power plan.

### 4. Optimize Connectivity
Render assets can be gigabytes in size. If your internet connection is slow, you will spend more time downloading the scene than actually rendering it.
* Always use a hardwired ethernet connection. Wi-Fi introduces latency and packet loss that can delay asset staging.
* Ensure your network firewall is not aggressively throttling inbound connections. 

By keeping your machine alert, cool, and well-connected, you ensure that you receive the highest priority ranking from the Distribution Engine.
