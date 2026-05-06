---
id: earnings-settlement
title: Earnings & Settlement
sidebar_label: Earnings & Settlement
sidebar_position: 5
---

# Earnings & Settlement

The RenderOnNodes platform removes the traditional friction of getting paid for freelance compute. You do not need to generate invoices, communicate with clients, or worry about chargebacks. 

All jobs assigned to you have already been funded by the Compute Client upfront via cryptographic escrow. If you compute the job, you get paid.

## The Two Earnings States 

When you complete a job, the earnings do not immediately appear in your Phantom wallet. This is intentional. The platform batches payments to save on network infrastructure fees (gas). 

You can track this on your Provider Dashboard via two metrics:

### 1. Pending Settlement
* **What it is:** The amount of **RON** you have earned from fully completed and verified jobs that has not yet been pushed to your external Solana wallet.
* **Why it happens:** The Settlement Engine accumulates your earnings until your balance crosses a specific threshold, or a specific amount of time has elapsed. 
* **Action Required:** None. This balance is cryptographically guaranteed to you.

### 2. Released Credits 
* **What it is:** The total historical amount of **RON** that has been successfully transferred out of the RenderOnNodes system and directly onto the blockchain into your physical wallet.
* **Action Required:** None. Once tokens hit your external wallet, they are fully liquid and entirely in your custody.

## The Settlement Mechanics

The typical cloud pipeline requires users to manually withdraw their funds, often incurring a withdrawal fee. RenderOnNodes operates differently: **we pay the infrastructure fees.**

1. Your node completes a job.
2. The Orchestration Layer verifies your proof-of-work.
3. The platform unlocks the client's escrowed funds and credits them to your internal `Pending Settlement` balance.
4. Once your pending balance crosses the threshold, the backend automatically groups your earnings into a massive batch transaction.
5. The platform signs the transaction and pays the Solana gas fee.
6. The RON hits your wallet.

You simply run the node; the platform automatically deposits your earnings.

:::danger[Protect Your Seed Phrase]
Remember, once RON is deposited into your external Solana wallet, the RenderOnNodes team has absolutely zero control over it. Never share your wallet's secret recovery phrase with anyone. If you lose your phrase, you lose your earnings permanently.
:::
