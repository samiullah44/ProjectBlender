---
id: scheduler-and-queues
title: How Jobs are Assigned
sidebar_label: Job Assignments
sidebar_position: 4
---

# How Jobs are Assigned (The Matchmaker)

When an Artist uploads a job, how does the platform decide which of the thousands of Node Providers around the world actually gets to render it?

This is handled by our automated backend Matchmaker engine, which evaluates three main things in less than a second:

## 1. Hardware Compatibility
The engine first looks for nodes that can actually handle the job.
* For example, if your Blender scene requires 12GB of VRAM to open, the Matchmaker instantly filters out all Node Providers running older 8GB graphics cards.

## 2. The Trust Score (Reputation)
As explained in the [Node Lifecycle](./node-lifecycle) guide, Node Providers earn a Trust Score between 0 and 100 based on their reliability.

If there is a highly urgent job that pays well, the Matchmaker will **always** offer it to the Nodes with the highest Trust Scores first (e.g., 95+). If none of them are available, it offers the job to the next tier down.

## 3. The Artist's Urgency
When an Artist uploads a render, they can choose how fast they need it.
* **Standard Priority:** The job goes into the normal queue and is distributed evenly across the network to provide the cheapest possible price.
* **High Priority:** The job jumps to the front of the line and is brute-forced across the highest-tier nodes available, guaranteeing blazing fast speeds at a slightly higher cost.

---

## What happens when a job gets stuck?

If the Matchmaker gives a frame to a Node Provider, and that Node Provider's internet cuts out, the platform has an automated fail-safe.

The platform knows exactly how long a frame *should* take to render. If the Node Provider exceeds that time limit by too much, or drops completely offline, the Matchmaker instantly claws the frame back and gives it to a different, highly-trusted Node so the Artist doesn't have to wait.
