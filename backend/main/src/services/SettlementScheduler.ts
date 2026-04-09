/**
 * SettlementScheduler.ts — Automatic Batch Release Trigger
 * 
 * Runs every 1 hour. Triggers PaymentService.settleAll() when either:
 *   1. ≥ 20 unsettled completed jobs accumulated
 *   2. 7 days since last settlement run
 * 
 * Uses setInterval with a mutex lock to prevent concurrent executions.
 */
import { paymentService, SettlementResult } from "./PaymentService";
import { forceRequeueActiveJobs } from "./FrameQueueService";

// ── Config ───────────────────────────────────────────────────────────────────
// Change these two lines:
const CHECK_INTERVAL_MS = 60 * 60 * 1000;  // 1 hours for testing
const JOB_THRESHOLD = 10;              // Trigger on every 10 jobs
const TIME_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class SettlementScheduler {
  private static instance: SettlementScheduler;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastSettlementRun: Date | null = null;

  public static getInstance(): SettlementScheduler {
    if (!SettlementScheduler.instance) {
      SettlementScheduler.instance = new SettlementScheduler();
    }
    return SettlementScheduler.instance;
  }

  /**
   * Start the scheduler. Call once on server boot.
   */
  public start(): void {
    if (this.intervalId) {
      console.warn("[SettlementScheduler] Already running — skipping start.");
      return;
    }

    console.log("[SettlementScheduler] ✅ Started. Checking every 10 seconds.");
    console.log(`  Job threshold: ${JOB_THRESHOLD} | Time threshold: 1 day`);

    // Run an initial check 30 seconds after boot (give DB time to connect)
    setTimeout(() => this.check(), 30_000);

    // Then check every hour
    this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  /**
   * Stop the scheduler.
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[SettlementScheduler] Stopped.");
    }
  }

  /**
   * Manual trigger (admin force-settlement).
   */
  public async forceSettle(): Promise<SettlementResult> {
    console.log("[SettlementScheduler] 🔥 Force settlement triggered by admin!");
    return this.runSettlement();
  }

  /**
   * Periodic check — evaluates thresholds.
   */
  private async check(): Promise<void> {
    if (this.isRunning) {
      console.log("[SettlementScheduler] Skipping — settlement already in progress.");
      return;
    }

    try {
      const unsettledCount = await paymentService.getUnsettledJobCount();
      const daysSinceLastRun = this.lastSettlementRun
        ? (Date.now() - this.lastSettlementRun.getTime()) / (24 * 60 * 60 * 1000)
        : Infinity; // Never run → always trigger on first check

      console.log(`[SettlementScheduler] Check: ${unsettledCount} unsettled jobs, ${daysSinceLastRun.toFixed(1)} days since last run.`);

      const shouldTrigger =
        unsettledCount >= JOB_THRESHOLD ||
        daysSinceLastRun >= 7;

      if (shouldTrigger) {
        const reason = unsettledCount >= JOB_THRESHOLD
          ? `Job threshold reached (${unsettledCount} ≥ ${JOB_THRESHOLD})`
          : `Time threshold reached (${daysSinceLastRun.toFixed(1)} days ≥ 7)`;
        console.log(`[SettlementScheduler] 🚀 Triggering settlement: ${reason}`);
        await this.runSettlement();
      }

      // Also trigger a background recovery sweep for BullMQ frames
      // This will recover stuck frames or purge zombie frames from BullMQ.
      await forceRequeueActiveJobs();
    } catch (error: any) {
      console.error("[SettlementScheduler] Check failed:", error.message);
    }
  }

  /**
   * Execute settlement with mutex lock.
   */
  private async runSettlement(): Promise<SettlementResult> {
    if (this.isRunning) {
      console.log("[SettlementScheduler] Settlement already running — skipping.");
      return { totalJobsSettled: 0, totalJobsFailed: 0, totalTokensReleased: 0, txSignatures: [], errors: ["Already running"] };
    }

    this.isRunning = true;
    try {
      const result = await paymentService.settleAll();
      this.lastSettlementRun = new Date();
      console.log(`[SettlementScheduler] ✅ Settlement finished. Settled: ${result.totalJobsSettled}, Failed: ${result.totalJobsFailed}`);
      return result;
    } catch (error: any) {
      console.error("[SettlementScheduler] Settlement run failed:", error.message);
      return { totalJobsSettled: 0, totalJobsFailed: 0, totalTokensReleased: 0, txSignatures: [], errors: [error.message] };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current scheduler status (for admin dashboard).
   */
  public getStatus(): {
    isRunning: boolean;
    lastSettlementRun: Date | null;
    nextCheckIn: string;
  } {
    return {
      isRunning: this.isRunning,
      lastSettlementRun: this.lastSettlementRun,
      nextCheckIn: this.intervalId ? "~1 hour" : "Not scheduled",
    };
  }
}

export const settlementScheduler = SettlementScheduler.getInstance();
