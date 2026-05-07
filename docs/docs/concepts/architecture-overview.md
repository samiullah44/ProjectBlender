---
id: architecture-overview
title: Architecture Overview
sidebar_label: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

**RenderOnNodes** is essentially a giant, decentralized computer built out of three main components: **The Artists**, **The Platform (Backend)**, and **The Nodes**.

Here is exactly how these pieces communicate with each other in plain English:

<div style={{textAlign: 'center', margin: '40px 0'}}>
  <img src={require('@site/static/img/architecture-flow-premium.png').default} alt="RenderOnNodes Architecture Flow Infographic" style={{borderRadius: '12px', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)', maxWidth: '100%'}} />
</div>

## The Four Main Parts

### 1. The Artist Dashboard
This is what you see at `app.renderonnodes.com`. It’s your control panel where you upload your Blender files, set your render settings, and download your final images. 

### 2. The Matchmaker (Backend Service)
When you click "Render", our backend system instantly looks at thousands of computers connected to the network worldwide. It checks which ones have the fastest GPUs and the right software installed, and it assigns your frames to them.

### 3. The Execution Nodes
These are the computers sitting in other people's homes and studios. They run our lightweight Node Software, which automatically receives your frames, renders them in the background, and uploads the finished images back to us.

### 4. The Payment System
Everything is powered by cryptocurrency (Solana and RON). Why? Because it allows us to lock your payment safely in an automated Escrow account. 
* We don't take your money until the render finishes.
* We don't pay the Node Provider until they deliver a perfect, crash-free frame.
* If a Node crashes, your money simply unlocks and is given to a different Node that gets the job done.

:::info[Next Step]
To see exactly what happens step-by-step from the moment you click "Upload", read the **[Job Lifecycle](./job-lifecycle)** document.
:::
