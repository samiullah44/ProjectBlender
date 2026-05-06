---
id: node-lifecycle
title: Node Lifecycle & Trust
sidebar_label: Node Lifecycle
sidebar_position: 3
---

# Node Lifecycle & Trust

As a Node Provider, your computer's job is to sit and wait for work. To do this effectively, the platform needs to know exactly what state your hardware is in at all times.

## The 4 Node States

When you look at your Provider Dashboard, you will see your Nodes moving between these four states automatically:

### 1. Online (Idle)
You have opened the Node software on your desktop and clicked Connect. Your computer is telling the platform, "I am awake, my GPU is ready, give me a job." 

### 2. Validating
Before we give a brand new node a paying job, we test it. We send a tiny, fake render job to see if the hardware actually works as fast as it claims to. If the test passes, the node moves to Active.

### 3. Active & Busy
Your computer has been matched with an Artist's job. Your local GPU usage will spike to 100%, your fans will spin up, and you are currently rendering frames. While you are Busy, the platform knows not to send you any other jobs. 

### 4. Offline
If your computer goes to sleep, or you close the Node software, or you lose Wi-Fi, the platform immediately marks you as offline. You will not receive any jobs or earn any money in this state.

---

## The Trust Score Engine

We don't let just anyone render files. To keep the network fast and reliable for Artists, every Node Provider has a hidden **Trust Score** between 0 and 100.

### How to get a High Trust Score (90-100)
* Stay **Online** for long periods without disconnecting.
* Render frames quickly without crashing.
* Keep your GPU cool so it doesn't slow down (thermal throttle) in the middle of a render.

If your Trust Score is high, **you get right of first refusal on the best-paying jobs**.

### What lowers your Trust Score?
* Crashing during an Active render.
* Delivering corrupted images.
* Going offline constantly.

If a Node Provider's Trust Score drops below 50, the platform will ban their machine from receiving any high-priority or high-paying jobs until they prove their computer is stable again.
