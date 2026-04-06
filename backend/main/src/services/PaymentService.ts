/**
 * PaymentService.ts — Core Settlement Engine
 * 
 * Aggregates completed job payouts, resolves provider wallets, chunks transactions,
 * and executes on-chain batch releases with idempotency and verification.
 */
import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { solanaService, BatchItem } from "./SolanaService";
import { Job } from "../models/Job";
import { User } from "../models/User";
import { Node } from "../models/Node";

// ── Constants ────────────────────────────────────────────────────────────────
const MIN_PAYOUT_LAMPORTS = 1000;       // Skip dust < 0.001 RNDR (1000 microlamports)
const MAX_JOBS_PER_TX = 5;              // Solana TX size safety
const MAX_PAYOUTS_PER_TX = 10;          // Solana remaining_accounts limit
const MAX_RETRY_COUNT = 10;
const STALE_SETTLING_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface SettlementResult {
  totalJobsSettled: number;
  totalJobsFailed: number;
  totalTokensReleased: number;
  txSignatures: string[];
  errors: string[];
}

export class PaymentService {
  private static instance: PaymentService;

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Main entry point: settle all eligible jobs.
   */
  public async settleAll(): Promise<SettlementResult> {
    const result: SettlementResult = {
      totalJobsSettled: 0,
      totalJobsFailed: 0,
      totalTokensReleased: 0,
      txSignatures: [],
      errors: [],
    };

    console.log("[PaymentService] ═══ Starting Settlement Run ═══");

    // Step 0: Reset stale "settling" jobs (crashed mid-TX)
    await this.resetStaleSettlingJobs();

    // Step 1: Find all eligible jobs (no populate — we need userId as raw ObjectId string)
    const jobs = await Job.find({
      status: { $in: ["completed", "failed"] },
      "escrow.status": "locked",
      $or: [
        { "escrow.paymentStatus": "unsettled" },
        { "escrow.paymentStatus": { $exists: false } },
        {
          "escrow.paymentStatus": "failed",
          "escrow.retryCount": { $lt: MAX_RETRY_COUNT },
        },
      ],
    }).lean();

    if (jobs.length === 0) {
      console.log("[PaymentService] No eligible jobs for settlement.");
      return result;
    }

    console.log(`[PaymentService] Found ${jobs.length} eligible jobs.`);

    // Step 2: Group jobs by userId (each batch_release TX = 1 user PDA)
    const jobsByUser = new Map<string, typeof jobs>();
    for (const job of jobs) {
      // job.userId is a raw ObjectId after .lean() — cast safely
      const userId = (job.userId as any)?._id?.toString() ?? (job.userId as any)?.toString();
      if (!userId) continue;
      if (!jobsByUser.has(userId)) {
        jobsByUser.set(userId, []);
      }
      jobsByUser.get(userId)!.push(job);
    }

    // Step 3: Process each user's jobs
    for (const [userId, userJobs] of jobsByUser) {
      try {
        const userResult = await this.settleUserJobs(userId, userJobs);
        result.totalJobsSettled += userResult.totalJobsSettled;
        result.totalJobsFailed += userResult.totalJobsFailed;
        result.totalTokensReleased += userResult.totalTokensReleased;
        result.txSignatures.push(...userResult.txSignatures);
        result.errors.push(...userResult.errors);
      } catch (error: any) {
        console.error(`[PaymentService] Fatal error for user ${userId}:`, error.message);
        result.errors.push(`User ${userId}: ${error.message}`);
        result.totalJobsFailed += userJobs.length;
      }
    }

    console.log(`[PaymentService] ═══ Settlement Complete ═══`);
    console.log(`  Settled: ${result.totalJobsSettled}, Failed: ${result.totalJobsFailed}, Tokens: ${result.totalTokensReleased}, TXs: ${result.txSignatures.length}`);

    return result;
  }

  /**
   * Settle all jobs belonging to a single user.
   */
  private async settleUserJobs(userId: string, jobs: any[]): Promise<SettlementResult> {
    const result: SettlementResult = {
      totalJobsSettled: 0,
      totalJobsFailed: 0,
      totalTokensReleased: 0,
      txSignatures: [],
      errors: [],
    };

    // Get user's Solana seed
    const user = await User.findById(userId);
    if (!user?.solanaSeed) {
      const errMsg = `User ${userId} has no solanaSeed — cannot settle.`;
      console.warn(`[PaymentService] ${errMsg}`);
      result.errors.push(errMsg);
      result.totalJobsFailed = jobs.length;
      return result;
    }

    // ── IDEMPOTENCY: Mark all jobs as 'settling' BEFORE any TX ──
    const jobIds = jobs.map((j) => j._id);
    await Job.updateMany(
      { _id: { $in: jobIds } },
      { $set: { "escrow.paymentStatus": "settling" } }
    );

    // ── AGGREGATE: Sum creditsEarned per nodeId across all jobs ──
    const allPayoutData: {
      job: any;
      payouts: { providerWallet: string; amount: number; userId: string }[];
      skippedProviders: string[];
    }[] = [];

    for (const job of jobs) {
      const jobPayouts = await this.aggregateJobPayouts(job);
      allPayoutData.push(jobPayouts);
    }

    // ── CHUNK: Build TX-sized batches ──
    const txChunks = this.buildTxChunks(allPayoutData);

    // ── EXECUTE: Send each chunk as a separate TX ──
    for (const chunk of txChunks) {
      try {
        const txSig = await this.executeChunk(user.solanaSeed, chunk);

        // Mark chunk's jobs as settled
        for (const item of chunk) {
          await this.completeJobSettlement(item, txSig, result);
        }
        result.txSignatures.push(txSig);
      } catch (error: any) {
        console.error(`[PaymentService] TX chunk failed:`, error.message);

        // FALLBACK: If batch fails due to insufficient funds, try jobs one-by-one
        if (this.isInsufficientFundsError(error)) {
          console.log(`[PaymentService] ⚡ Batch failed with insufficient funds. Retrying granularly to maximize payouts...`);
          await this.settleChunkGranularly(user.solanaSeed, chunk, result);
        } else {
          // Normal failure for non-funding errors
          result.errors.push(error.message);
          for (const item of chunk) {
            await this.failJobSettlement(item, error.message, result);
          }
        }
      }
    }

    // ── VERIFY: Check on-chain state after all TXs ──
    if (result.txSignatures.length > 0) {
      try {
        const onchainState = await solanaService.getUserAccountState(user.solanaSeed);
        console.log(`[PaymentService] On-chain verify for user ${userId}: locked=${onchainState.lockedAmount}, credited=${onchainState.creditedAmount}`);
      } catch (verifyError: any) {
        console.warn(`[PaymentService] On-chain verification failed (non-fatal): ${verifyError.message}`);
      }
    }

    return result;
  }

  /**
   * Aggregate frame payouts for a single job.
   * Returns payouts grouped by provider wallet.
   */
  private async aggregateJobPayouts(job: any): Promise<{
    job: any;
    payouts: { providerWallet: string; amount: number; userId: string }[];
    skippedProviders: string[];
  }> {
    const payoutsByNodeId = new Map<string, number>();
    const skippedProviders: string[] = [];

    // Sum creditsEarned per nodeId from frame assignments
    let totalCalculatedCredits = 0;
    for (const frame of job.frameAssignments || []) {
      if (frame.status === "rendered" && frame.creditsEarned && frame.creditsEarned > 0) {
        const nodeId = frame.nodeId;
        payoutsByNodeId.set(nodeId, (payoutsByNodeId.get(nodeId) || 0) + frame.creditsEarned);
        totalCalculatedCredits += frame.creditsEarned;
      }
    }

    // ── SAFETY CAP: Never payout more than what was locked ──
    const lockedAmount = job.escrow?.lockedAmount || 0;
    let scalingFactor = 1.0;
    
    if (lockedAmount <= 0) {
      scalingFactor = 0;
      console.warn(`[PaymentService] Job ${job.jobId} has ZERO lockedAmount — forcing scalingFactor to 0.`);
    } else {
      if (totalCalculatedCredits > lockedAmount) {
        scalingFactor = lockedAmount / totalCalculatedCredits;
        console.warn(`[PaymentService] Job ${job.jobId} needs safety scaling (${totalCalculatedCredits} > ${lockedAmount}). Factor: ${scalingFactor.toFixed(6)}`);
      }
    }

    // Resolve nodeId → User.payoutWallet
    const payouts: { providerWallet: string; amount: number; userId: string }[] = [];
    for (let [nodeId, totalCredits] of payoutsByNodeId) {
      // Apply scaling if necessary
      if (scalingFactor < 1.0) {
        totalCredits *= scalingFactor;
      }

      // Convert credits to raw lamports (6 decimals)
      const rawAmount = Math.floor(totalCredits * 1_000_000);
      if (rawAmount < MIN_PAYOUT_LAMPORTS) {
        console.log(`[PaymentService] Skipping dust payout for node ${nodeId}: ${totalCredits} credits`);
        skippedProviders.push(nodeId);
        continue;
      }

      // Look up node → user → payoutWallet
      const node = await (Node as any).findOne({ nodeId });
      if (!node?.userId) {
        console.warn(`[PaymentService] Node ${nodeId} has no userId — skipping.`);
        skippedProviders.push(nodeId);
        continue;
      }

      const providerUser = await User.findById(node.userId);
      if (!providerUser?.payoutWallet) {
        console.warn(`[PaymentService] Provider user ${node.userId} has no payoutWallet set — skipping.`);
        skippedProviders.push(nodeId);
        continue;
      }

      payouts.push({ 
        providerWallet: providerUser.payoutWallet, 
        amount: rawAmount,
        userId: node.userId.toString()
      });
    }

    return { job, payouts, skippedProviders };
  }

  /**
   * Split aggregated payouts into TX-sized chunks.
   */
  private buildTxChunks(
    allPayoutData: { job: any; payouts: { providerWallet: string; amount: number; userId: string }[]; skippedProviders: string[] }[]
  ): { jobRef: any; payouts: { providerWallet: string; amount: number; userId: string }[]; skippedProviders: string[] }[][] {
    const chunks: { jobRef: any; payouts: { providerWallet: string; amount: number; userId: string }[]; skippedProviders: string[] }[][] = [];

    let currentChunk: typeof chunks[0] = [];
    let currentJobCount = 0;
    let currentPayoutCount = 0;

    for (const data of allPayoutData) {
      const wouldExceedJobs = currentJobCount + 1 > MAX_JOBS_PER_TX;
      const wouldExceedPayouts = currentPayoutCount + data.payouts.length > MAX_PAYOUTS_PER_TX;

      if ((wouldExceedJobs || wouldExceedPayouts) && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentJobCount = 0;
        currentPayoutCount = 0;
      }

      currentChunk.push({
        jobRef: data.job,
        payouts: data.payouts,
        skippedProviders: data.skippedProviders,
      });
      currentJobCount++;
      currentPayoutCount += data.payouts.length;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Execute a single TX chunk on-chain.
   */
  private async executeChunk(
    userSolanaSeed: string,
    chunk: { jobRef: any; payouts: { providerWallet: string; amount: number; userId: string }[]; skippedProviders: string[] }[]
  ): Promise<string> {
    const batchItems: BatchItem[] = [];
    const allProviderATAs: PublicKey[] = [];

    const connection = solanaService.getConnection();
    const mintAddress = solanaService.getMintAddress();
    // We need a payer for getOrCreateAssociatedTokenAccount — use admin keypair
    // Access it indirectly through a helper since wallet is private
    const adminSecretStr = process.env.SOLANA_ADMIN_SECRET_KEY!;
    let adminKeypair: any;
    const { Keypair } = await import("@solana/web3.js");
    const bs58Module = await import("bs58");
    if (adminSecretStr.startsWith("[")) {
      adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(adminSecretStr)));
    } else {
      adminKeypair = Keypair.fromSecretKey(bs58Module.default.decode(adminSecretStr));
    }

    for (const item of chunk) {
      const payouts: { provider: PublicKey; amount: anchor.BN }[] = [];

      for (const p of item.payouts) {
        const providerPubkey = new PublicKey(p.providerWallet);

        // ── ATA AUTO-CREATION: Ensure provider's token account exists ──
        const ata = await getOrCreateAssociatedTokenAccount(
          connection,
          adminKeypair,          // payer for account creation
          mintAddress,
          providerPubkey         // owner
        );

        payouts.push({
          provider: providerPubkey,
          amount: new anchor.BN(p.amount),
        });
        allProviderATAs.push(ata.address);
      }

      batchItems.push({
        jobId: new anchor.BN(item.jobRef.escrow?.onchainJobId || 0),
        payouts,
      });
    }

    // Execute on-chain
    return await solanaService.batchRelease(userSolanaSeed, batchItems, allProviderATAs);
  }

  /**
   * FALLBACK: Attempt to settle each job in the chunk individually.
   */
  private async settleChunkGranularly(solanaSeed: string, chunk: any[], result: SettlementResult): Promise<void> {
    for (const item of chunk) {
      try {
        const txSig = await this.executeChunk(solanaSeed, [item]);
        await this.completeJobSettlement(item, txSig, result);
        result.txSignatures.push(txSig);
      } catch (error: any) {
        console.warn(`[PaymentService] Granular settlement failed for job ${item.jobRef.jobId}:`, error.message);
        await this.failJobSettlement(item, error.message, result);
      }
    }
  }

  private async completeJobSettlement(item: any, txSig: string, result: SettlementResult): Promise<void> {
    const job = item.jobRef;
    const releasedAmount = item.payouts.reduce((sum: number, p: any) => sum + p.amount, 0) / 1_000_000;

    await Job.findByIdAndUpdate(job._id, {
      $set: {
        "escrow.status": "released",
        "escrow.paymentStatus": item.skippedProviders.length > 0 ? "partial" : "settled",
        "escrow.releasedAmount": releasedAmount,
        "escrow.settledAt": new Date(),
      },
      $push: { "escrow.settlementTxSignatures": txSig },
    });

    result.totalJobsSettled++;
    result.totalTokensReleased += releasedAmount;

    // Increment provider database earnings upon success
    for (const payout of item.payouts) {
      const providerUser = await User.findById(payout.userId);
      if (providerUser) {
        await providerUser.addEarnings(payout.amount / 1_000_000);
      }
    }

    // Notify frontend to refresh its state via WebSocket
    try {
      const { wsService } = await import("../app");
      if (wsService) {
        // Send a job update so that UI knows the job is now finalized
        wsService.broadcastJobUpdate(job.jobId).catch((err: any) => console.error("Error broadcasting job update:", err));
        
        // Also tell the specific user to reload their wallet balance
        wsService.emitToUser(job.userId.toString(), "credit_balance_updated", {});
      }
    } catch (wsErr) {
      console.error("WS Emit failed:", wsErr);
    }
  }

  private async failJobSettlement(item: any, reason: string, result: SettlementResult): Promise<void> {
    await Job.findByIdAndUpdate(item.jobRef._id, {
      $set: { "escrow.paymentStatus": "failed", "escrow.failureReason": reason },
      $inc: { "escrow.retryCount": 1 },
    });
    result.totalJobsFailed++;
  }

  private isInsufficientFundsError(error: any): boolean {
    const msg = error.message?.toLowerCase() || "";
    // Check for standard Solana message or the 0x1 program error
    return msg.includes("insufficient funds") || msg.includes("0x1");
  }

  /**
   * Reset jobs stuck in 'settling' state for > 30 min (crash recovery).
   */
  private async resetStaleSettlingJobs(): Promise<void> {
    const threshold = new Date(Date.now() - STALE_SETTLING_THRESHOLD_MS);
    const result = await Job.updateMany(
      {
        "escrow.paymentStatus": "settling",
        updatedAt: { $lt: threshold },
      },
      {
        $set: { "escrow.paymentStatus": "failed", "escrow.failureReason": "Stale settling state — auto-reset" },
        $inc: { "escrow.retryCount": 1 },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[PaymentService] Reset ${result.modifiedCount} stale settling jobs.`);
    }
  }

  /**
   * Get count of unsettled jobs (for scheduler threshold check).
   */
  public async getUnsettledJobCount(): Promise<number> {
    return Job.countDocuments({
      status: { $in: ["completed", "failed"] },
      "escrow.status": "locked",
      $or: [
        { "escrow.paymentStatus": "unsettled" },
        { "escrow.paymentStatus": { $exists: false } },
      ],
    });
  }
}

export const paymentService = PaymentService.getInstance();
