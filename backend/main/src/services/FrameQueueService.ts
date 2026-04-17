/**
 * FrameQueueService.ts
 *
 * Manages BullMQ queues for atomic, scalable frame distribution.
 *
 * Key design decisions:
 *  - Uses ConnectionOptions (plain object) not an IORedis instance — avoids bundled-ioredis conflicts
 *  - One queue: "frame-render" — each BullMQ job = one frame
 *  - Atomic dequeue via Worker.getNextJob() — no two nodes get the same frame
 *  - MongoDB stays for progress, credits, output URLs, and dashboard
 *  - QueueEvents provides real-time hooks for WebSocket broadcasting
 */

import { Queue, QueueEvents, Worker, Job as BullJob, ConnectionOptions } from 'bullmq';

// Global cooldown for on-demand sweep to prevent hammering Redis
let lastSweepTime = 0;
const SWEEP_COOLDOWN_MS = 10000;

// ── Connection config ─────────────────────────────────────────────────────────

import dotenv from 'dotenv';
dotenv.config();
import IORedis from 'ioredis';

/**
 * Shared Redis instance for all BullMQ components.
 * Automatically handles REDIS_URL (cloud) vs localhost fallback.
 */
export const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

redis.on('error', (err) => {
    console.error('⚠️ BullMQ Redis Connection Error:', err.message);
});


// ── Types ─────────────────────────────────────────────────────────────────────

export interface FrameJobData {
    jobId: string;
    frame: number;
}

export interface DequeuedFrame {
    bullJobId: string;
    jobId: string;
    frame: number;
    /** lock token needed to ACK/NACK this frame — keep it private to the consumer */
    lockToken: string;
    /** the name of the topic queue this frame was popped from */
    queueName: string;
    takenAt: string;
}

// ── Queues & Workers (Topic-based routing) ──────────────────────────────────
// We group frames into queues by Engine + Device so nodes only pop compatible frames.
// Example: "frame-render:CYCLES:GPU"

const queues = new Map<string, Queue<FrameJobData>>();
const workers = new Map<string, Worker<FrameJobData>>();
const queueEventsMap = new Map<string, QueueEvents>();

export function getQueueName(engine: string, device: string): string {
    return `frame-render-${engine.toUpperCase()}-${device.toUpperCase()}`;
}

function getOrCreateQueue(queueName: string): Queue<FrameJobData> {
    if (!queues.has(queueName)) {
        const q = new Queue<FrameJobData>(queueName, {
            connection: redis as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { count: 2000 },
                removeOnFail: { count: 1000 }
            }
        });
        q.on('error', (err: Error) => console.error(`❌ BullMQ Queue error (${queueName}):`, err.message));
        queues.set(queueName, q);
    }
    return queues.get(queueName)!;
}

function getOrCreateWorker(queueName: string): Worker<FrameJobData> {
    if (!workers.has(queueName)) {
        const w = new Worker<FrameJobData>(
            queueName,
            async () => { /* manual pop only */ },
            {
                connection: redis as any,
                autorun: false,
                lockDuration: 300_000,
                stalledInterval: 60_000,
                concurrency: 500
            }
        );
        w.on('error', (err: Error) => console.error(`❌ BullMQ Worker error (${queueName}):`, err.message));
        workers.set(queueName, w);
    }
    return workers.get(queueName)!;
}

function getOrCreateQueueEvents(queueName: string): QueueEvents {
    if (!queueEventsMap.has(queueName)) {
        queueEventsMap.set(queueName, new QueueEvents(queueName, { connection: redis as any }));
    }
    return queueEventsMap.get(queueName)!;
}

/**
 * Helper to initialize all possible queue routing topics on startup if desired.
 */
export function initializeQueues() {
    const engines = ['CYCLES', 'EEVEE'];
    const devices = ['CPU', 'GPU'];
    for (const e of engines) {
        for (const d of devices) {
            const qn = getQueueName(e, d);
            getOrCreateQueue(qn);
            getOrCreateWorker(qn);
            getOrCreateQueueEvents(qn);
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Enqueue all selected frames for a render job.
 * Uses deterministic BullMQ job IDs — re-enqueueing the same frame is idempotent.
 */
export async function enqueueJobFrames(jobId: string, frames: number[], engine: string, device: string): Promise<void> {
    if (frames.length === 0) return;

    const queueName = getQueueName(engine, device);
    const q = getOrCreateQueue(queueName);

    const bulkJobs = frames.map(frame => ({
        name: `frame-${jobId}-${frame}`,
        data: { jobId, frame },
        opts: { jobId: `${jobId}-${frame}` }
    }));

    await q.addBulk(bulkJobs as any);
    console.log(`📥 Enqueued ${frames.length} frames for job ${jobId} into BullMQ queue ${queueName}`);
}

/**
 * Remove all queued (waiting) frames for a cancelled job from the queue.
 */
export async function removeJobFrames(jobId: string, frames: number[], engine: string, device: string): Promise<void> {
    const q = getOrCreateQueue(getQueueName(engine, device));
    await Promise.all(
        frames.map(frame =>
            q.remove(`${jobId}-${frame}`).catch(() => { /* already processed — safe */ })
        )
    );
    console.log(`🗑️  Removed up to ${frames.length} queued BullMQ frames for cancelled job ${jobId}`);
}

/**
 * Aggressively completely purges all frames across all initialized queues that belong to a specified jobId.
 * Used when a job is unexpectedly deleted from MongoDB but ghost frames remain in BullMQ.
 */
export async function purgeJobFromAllQueues(targetJobId: string): Promise<number> {
    let removedCount = 0;
    if (queues.size === 0) {
        initializeQueues();
    }

    const stateTypes: any[] = ['waiting', 'delayed', 'paused', 'prioritized'];

    console.log(`🧹 Aggressive Purge: Checking all queues for ghost frames of job ${targetJobId}`);

    for (const [name, q] of queues.entries()) {
        try {
            // We fetch the jobs to check their data.jobId
            const jobsInQueue = await q.getJobs(stateTypes);
            const targetJobs = jobsInQueue.filter(j => j?.data?.jobId === targetJobId);

            for (const job of targetJobs) {
                try {
                    await job.remove();
                    removedCount++;
                } catch (e) {
                    // ignore if already removed
                }
            }
        } catch (err) {
            console.error(`❌ Error sweeping queue ${name} for job ${targetJobId}:`, err);
        }
    }

    if (removedCount > 0) {
        console.log(`✅ Successfully purged ${removedCount} ghost frames from BullMQ for deleted job ${targetJobId}`);
    }
    return removedCount;
}

/**
 * Atomically pop up to `count` frames from the queue for a node.
 * Uses Worker.getNextJob() which is backed by a Redis LMOVE + lock —
 * no two nodes can ever receive the same frame.
 *
 * The caller MUST later call ackFrame() or nackFrame() for every frame returned,
 * otherwise the frame will be reclaimed by BullMQ's stall detection after lockDuration ms.
 */
export async function dequeueFramesForNode(
    nodeId: string,
    queueNames: string[],
    count: number
): Promise<DequeuedFrame[]> {
    const results: DequeuedFrame[] = [];
    const lockToken = `${nodeId}-${Date.now()}`;

    // Try queues in priority order (as passed in by the caller)
    for (const queueName of queueNames) {
        if (results.length >= count) break;

        const w = getOrCreateWorker(queueName);

        // Attempt to fill remaining quota from this queue
        const remaining = count - results.length;
        for (let i = 0; i < remaining; i++) {
            try {
                // IMPORTANT: getNextJob with a token is a manual move-to-active operation
                const bullJob = await w.getNextJob(lockToken);

                if (!bullJob) {
                    break; // this queue is empty, move to next queue
                }

                results.push({
                    bullJobId: bullJob.id!,
                    jobId: bullJob.data.jobId,
                    frame: bullJob.data.frame,
                    lockToken,
                    queueName,
                    takenAt: new Date().toISOString()
                });
            } catch (err: any) {
                console.warn(`⚠️  dequeue stopped early on ${queueName}: ${err?.message}`);
                break; // skip this queue on error
            }
        }
    }

    return results;
}

/**
 * ACK a frame: mark the BullMQ job as completed.
 * Call from NodeController.frameCompleted() after MongoDB is updated.
 */
export async function ackFrame(bullJobId: string, lockToken: string, queueName: string): Promise<void> {
    try {
        const q = getOrCreateQueue(queueName);
        const bullJob = await BullJob.fromId<FrameJobData>(q, bullJobId);
        if (!bullJob) return;
        await bullJob.moveToCompleted('rendered', lockToken, false);
    } catch (err: any) {
        if (!err?.message?.includes('Missing lock')) {
            console.warn(`⚠️  ackFrame(${bullJobId}) warning: ${err?.message}`);
        }
    }
}

/**
 * NACK a frame: move to failed/retry.
 * BullMQ retries up to 3 times with exponential backoff automatically.
 * Call from NodeController.reportFrameFailure().
 */
export async function nackFrame(
    bullJobId: string,
    lockToken: string,
    errorMessage: string,
    queueName: string,
    requeue: boolean = false
): Promise<void> {
    try {
        const q = getOrCreateQueue(queueName);
        const bullJob = await BullJob.fromId<FrameJobData>(q, bullJobId);
        if (!bullJob) return;

        if (requeue) {
            // Move back to waiting so another node can pick it up immediately
            // This is better than moveToFailed + retry() for node-offline scenarios
            await (bullJob as any).moveToWait(lockToken, false);
        } else {
            await bullJob.moveToFailed(new Error(errorMessage), lockToken, false);
        }
    } catch (err: any) {
        if (!err?.message?.includes('Missing lock')) {
            console.warn(`⚠️  nackFrame(${bullJobId}) warning: ${err?.message}`);
        }
    }
}

/**
 * Fast-path requeue for node disconnect.
 * Active bullJobIds stored on the Node should now contain the prefix so we know the queue!
 * Wait — we only stored the string IDs. Let's just store `{id: string, queueName: string}` on Node.
 * We'll pass the `queueName` here directly.
 */
/**
 * Force a frame back to the waiting list for retry.
 * Used when a frame failure is reported but retries remain.
 */
export async function requeueFrame(jobId: string, frame: number, engine: string, device: string): Promise<void> {
    try {
        const queueName = getQueueName(engine, device);
        const q = getOrCreateQueue(queueName);
        const bullJobId = `${jobId}-${frame}`;
        const bullJob = await BullJob.fromId<FrameJobData>(q, bullJobId);

        if (bullJob) {
            // If it's in failed state, retry it
            const state = await bullJob.getState();
            if (state === 'failed') {
                await bullJob.retry();
            } else if (state === 'active') {
                // If it's somehow active (though it shouldn't be if we are requeueing a failure),
                // we can't easily move it without a token. But reportFrameFailure should have it.
            }
        } else {
            // If it doesn't exist at all, re-enqueue it
            await enqueueJobFrames(jobId, [frame], engine, device);
        }
    } catch (err: any) {
        console.warn(`⚠️  requeueFrame(${jobId}-${frame}) warning: ${err?.message}`);
    }
}

export async function requeueFramesFromOfflineNode(
    jobsToRequeue: Array<{ id: string, queueName: string, lockToken: string }>,
    nodeId: string
): Promise<void> {
    if (jobsToRequeue.length === 0) return;
    await Promise.all(
        jobsToRequeue.map(job => nackFrame(job.id, job.lockToken, `Node ${nodeId} went offline mid-render`, job.queueName, true))
    );
    console.log(`🔄 Requeued ${jobsToRequeue.length} BullMQ frames from offline node ${nodeId} to waiting list`);
}

/**
 * Forcefully moves ALL current active jobs in BullMQ back to the waiting list.
 * Use as a recovery mechanism if frames get stuck in 'active' state.
 * @param specificQueues Optional list of queue names to sweep. If empty, sweeps all.
 */
export async function forceRequeueActiveJobs(specificQueues?: string[]): Promise<number> {
    const now = Date.now();
    if (now - lastSweepTime < SWEEP_COOLDOWN_MS) return 0;
    lastSweepTime = now;

    let count = 0;
    if (queues.size === 0) {
        initializeQueues();
    }

    // Determine which queues to check
    const targets = specificQueues
        ? Array.from(queues.entries()).filter(([name]) => specificQueues.includes(name))
        : Array.from(queues.entries());

    console.log(`🔍 Sweep: Checking ${targets.length} queues for stuck frames...`);

    for (const [name, q] of targets) {
        try {
            const activeJobs = await q.getJobs(['active']);
            if (activeJobs.length > 0) {
                console.log(`Found ${activeJobs.length} active jobs in queue ${name}`);
            }

            for (const job of activeJobs) {
                console.log(`Recovering stuck job: ${job.id} (state: active)`);
                try {
                    // Method 1: Try move to wait (requires lock, usually fails if node is dead but lock persists)
                    await (job as any).moveToWait('force-recovery', true);
                    count++;
                } catch (e: any) {
                    console.warn(`⚠️ Failed moveToWait for ${job.id}: ${e.message}. Using aggressive Remove + Re-add.`);
                    try {
                        // Method 2: Aggressive - remove the job entirely and re-enqueue it
                        // Since we use deterministic IDs (${jobId}-${frame}), this is safe and effective.
                        const { jobId, frame } = job.data as FrameJobData;
                        const jobName = job.name;

                        await q.remove(job.id!);
                        await q.add(jobName, job.data, { jobId: job.id });

                        count++;
                        console.log(`✅ Successfully re-enqueued ${job.id}`);
                    } catch (e2: any) {
                        console.error(`❌ Total failure to rescue ${job.id}: ${e2.message}`);
                    }
                }
            }
        } catch (err) {
            console.error(`❌ Error in forceRequeueActiveJobs for queue ${name}:`, err);
        }
    }
    if (count > 0) console.log(`🚀 Force-recovered ${count} stuck active BullMQ jobs`);
    return count;
}

/**
 * Real-time queue statistics across all engine/device queues.
 */
export async function getQueueStats() {
    const stats = { waiting: 0, active: 0, failed: 0, completed: 0, delayed: 0 };

    for (const q of queues.values()) {
        const [w, a, f, c, d] = await Promise.all([
            q.getWaitingCount(), q.getActiveCount(), q.getFailedCount(),
            q.getCompletedCount(), q.getDelayedCount()
        ]);
        stats.waiting += w; stats.active += a; stats.failed += f;
        stats.completed += c; stats.delayed += d;
    }
    return stats;
}

/**
 * Graceful shutdown. Call on SIGTERM/SIGINT.
 */
export async function closeQueue(): Promise<void> {
    try {
        for (const w of workers.values()) await w.close();
        for (const qe of queueEventsMap.values()) await qe.close();
        for (const q of queues.values()) await q.close();
        console.log('✅ BullMQ topic queues closed gracefully');
    } catch (err: any) {
        console.warn(`⚠️  Queue close warning: ${err?.message}`);
    }
}
