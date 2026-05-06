---
id: settlement-system
title: Automated Payouts
sidebar_label: Automated Payouts
sidebar_position: 6
---

# Automated Payouts

One of the biggest problems with traditional freelance rendering is trust. Artists worry about paying for renders that look broken, and Node Providers worry about rendering thousands of frames and never getting paid.

**RenderOnNodes solves this by completely automating the payment process.**

## The Escrow Guarantee

When an Artist clicks "Submit," they do not hand their money to the Node Provider, nor do they hand it to our company. 

Instead, the money (**RON** tokens) is locked in a neutral "Escrow" smart contract on the blockchain. The money is frozen there, meaning neither the Artist nor the Node Provider can touch it.

## Verification

When the Node finishes rendering the frame, it uploads the image. Our platform analyzes the image automatically:
* Is it completely black?
* Is the file size totally wrong?
* Is it corrupted?

If the frame passes the quality check, the platform sends a cryptographic signal to the Escrow contract, telling it the job is complete.

## Distribution

The exact moment the frame is verified, the Escrow contract automatically unlocks and splits the money:

* **95% goes directly to the Node Provider's wallet.**
* **5% goes to the RenderOnNodes platform** to pay for server costs, storage, and matcher engine maintenance.

If the frame was bad, or the Node crashed, **100% of the money goes safely back to the Artist**. 

### Do I have to pay transaction fees?

Normally, every time a smart contract moves money, there is a tiny network fee (called "Gas"). 
Because we want RenderOnNodes to be incredibly simple to use, **the platform pays all of these automated payout fees for you.**

Node Providers receive all 95% of their earnings automatically dropped into their Phantom wallets without having to click any buttons or pay any hidden withdrawal fees.
