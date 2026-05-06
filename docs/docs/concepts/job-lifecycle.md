---
id: job-lifecycle
title: Job Lifecycle
sidebar_label: Job Lifecycle
sidebar_position: 2
---

# The Job Lifecycle

When an Artist clicks "Submit Render", a lot of automated software instantly springs into action to deliver the final product as fast as possible.

Here is a step-by-step breakdown of how a render actually gets processed.

## 1. Upload & Split
When you upload your packed `.blend` file on the Client Dashboard, it goes directly to our secure storage servers. The platform instantly analyzes the file and splits it up. For example, if you upload a 100-frame animation, the platform creates 100 separate "mini-jobs", ready to be distributed.

## 2. The Payment Lock (Escrow)
Before handing the job out, the platform estimates the total cost. It takes the required **RON** from your connected wallet and locks it securely in an **Escrow Account**. 
* This proves to the network that you have the money to pay.
* It guarantees the Node Providers that they won't get scammed.

## 3. Finding the Hardware
Our Matchmaker engine scans the globe for available GPUs that meet the requirements of your scene. 
* A 100-frame animation might be sent to 100 different computers simultaneously.
* The Node software on those computers downloads the `.blend` file, opens Blender in the background, and starts rendering the specific frame it was assigned.

## 4. Verification & Delivery
As soon as a Node finishes rendering a frame, it uploads the final PNG or EXR image.
* Our system analyzes the image. If the image is corrupted (e.g., all black, missing data), the system rejects it. 
* If the image is perfect, the system makes it available on your Dashboard for download.

## 5. Getting Paid
Once the perfect image is verified, the Escrow Account automatically releases a portion of your locked RON and sends it directly to the Node Provider who rendered it.

---

### What happens if a Node crashes in the middle?

Sometimes, a Node Provider's computer might lose power or crash due to overheating. 
1. If the platform doesn't hear back from a node within a few minutes, it marks the node as **OFFLINE**.
2. The platform instantly takes that broken frame and assigns it to a new, healthy computer.
3. The original offline node gets paid **nothing**, and its reputation score drops.
4. The Artist gets a seamless experience and only pays for the final, successful image.
