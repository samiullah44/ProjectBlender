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

// ── Connection config ─────────────────────────────────────────────────────────

export const redisConnectionOptions: ConnectionOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    enableReadyCheck: false,
    maxRetriesPerRequest: null, // REQUIRED by BullMQ — do not remove
};

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
            connection: redisConnectionOptions,
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
                connection: redisConnectionOptions,
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
        queueEventsMap.set(queueName, new QueueEvents(queueName, { connection: redisConnectionOptions }));
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
    queueName: string
): Promise<void> {
    try {
        const q = getOrCreateQueue(queueName);
        const bullJob = await BullJob.fromId<FrameJobData>(q, bullJobId);
        if (!bullJob) return;
        await bullJob.moveToFailed(new Error(errorMessage), lockToken, false);
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
export async function requeueFramesFromOfflineNode(
    jobsToRequeue: Array<{ id: string, queueName: string, lockToken: string }>,
    nodeId: string
): Promise<void> {
    if (jobsToRequeue.length === 0) return;
    await Promise.all(
        jobsToRequeue.map(job => nackFrame(job.id, job.lockToken, `Node ${nodeId} went offline mid-render`, job.queueName))
    );
    console.log(`🔄 NACK'd ${jobsToRequeue.length} BullMQ frames from offline node ${nodeId}`);
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
