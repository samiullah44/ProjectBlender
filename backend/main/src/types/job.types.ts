// backend/src/types/job.types.ts
import { Types } from 'mongoose';

export interface IJobOutput {
    frame: number;
    url: string;
    s3Key: string;
    fileSize: number;
    uploadedAt: Date;
    thumbnailUrl?: string;
}

export interface IFrameAssignment {
    frame: number;
    nodeId: string;
    status: 'assigned' | 'rendered' | 'failed';
    assignedAt: Date;
    completedAt?: Date;
    renderTime?: number;
    creditsEarned?: number;
    s3Key?: string;
    errorMessage?: string;
    retryCount?: number;  // tracks Blender crash retries (max 3 before permanent failure)
}

export interface IJobSettings {
    engine: 'CYCLES' | 'EEVEE' | 'BLENDER_EEVEE';
    device: 'CPU' | 'GPU' | 'GPU_CUDA' | 'GPU_OPTIX';
    samples: number;
    resolutionX: number;
    resolutionY: number;
    tileSize: number;
    denoiser?: 'NONE' | 'OPTIX' | 'OPENIMAGEDENOISE' | 'NLM';
    outputFormat: 'PNG' | 'JPEG' | 'EXR' | 'TIFF' | 'TARGA' | 'BMP' | 'OPEN_EXR';
    colorMode?: 'BW' | 'RGB' | 'RGBA';
    colorDepth?: '8' | '16' | '32';
    compression?: number; // 0-100 for PNG/JPEG
    exrCodec?: 'ZIP' | 'PIZ' | 'RLE' | 'ZIPS' | 'BXR' | 'DWAA' | 'DWAB';
    tiffCodec?: 'NONE' | 'PACKBITS' | 'DEFLATE' | 'LZW';
    creditsPerFrame: number;
    blenderVersion?: string;
    selectedFrame?: number;
    animationFrameRate?: number;
    useCompositing?: boolean;
    useSequencer?: boolean;
    scene?: string;
    camera?: string;
}

export interface IJobFrames {
    start: number;
    end: number;
    total: number;
    selected: number[];
    rendered: number[];
    failed: number[];
    assigned: number[];
    pending: number[];
}

export interface IJobTiles {
    totalX: number;
    totalY: number;
    rendered: string[];
    failed: string[];
    assigned: string[];
}

export interface IUploadMetadata {
    type: 'multipart' | 'single' | 'direct';
    uploadId?: string;
    parts?: number;
    completedAt?: Date;
    fileSize?: number;
    checksum?: string;
}

export interface IJobEscrow {
    /** Solana transaction signature of the lockPayment instruction */
    txSignature: string;
    /** On-chain Escrow PDA public key (base58) */
    escrowAddress: string;
    /** The u64 job_id used on-chain, stored as string to avoid precision loss */
    escrowJobId: string;
    /** Numeric on-chain job ID for Solana program */
    onchainJobId?: number;
    /** Amount locked in tokens (human-readable, 6 decimals already applied) */
    lockedAmount: number;
    /** Current on-chain escrow lifecycle state */
    status: 'none' | 'locked' | 'released' | 'refunded';
    lockedAt: Date;

    // ── Settlement tracking (Phase 4) ──────────────────────────────
    /** Payment settlement state machine */
    paymentStatus?: 'unsettled' | 'settling' | 'partial' | 'settled' | 'failed';
    /** Tokens already released on-chain to providers */
    releasedAmount?: number;
    /** Timestamp of last successful settlement */
    settledAt?: Date;
    /** TX signatures from batch_release calls (one job may span multiple TXs) */
    settlementTxSignatures?: string[];
    /** Reason for settlement failure */
    failureReason?: string;
    /** Number of settlement retry attempts */
    retryCount?: number;
}

export interface IJob {
    _id?: Types.ObjectId;
    jobId: string;
    projectId: string;
    userId: Types.ObjectId;
    blendFileKey: string;
    blendFileUrl: string;
    blendFileName: string;
    name?: string;
    type: 'image' | 'animation';
    inputType?: 'blend' | 'archive';

    settings: IJobSettings;
    frames: IJobFrames;
    tiles?: IJobTiles;

    assignedNodes: Map<string, number[]> | Record<string, number[]>;
    frameAssignments: IFrameAssignment[];

    /** 'pending_payment' = job created but on-chain escrow not yet locked */
    status: 'pending_payment' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'cancelling' | 'paused';
    progress: number;

    /** On-chain escrow state — populated after lockPayment succeeds */
    escrow?: IJobEscrow;

    uploadMetadata?: IUploadMetadata;
    outputUrls: IJobOutput[];
    renderTime?: number;
    totalCreditsDistributed?: number;

    // Metadata
    estimatedRenderTime?: number;
    estimatedCost?: number;
    actualCost?: number;
    tags?: string[];
    description?: string;

    // Timestamps
    cancelledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    startedAt?: Date;
    pausedAt?: Date;

    // System fields
    retryCount: number;
    maxRetries: number;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    requireApproval?: boolean;
    approved?: boolean;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;
    userRerenderCount?: number;
    userRerenderMax?: number;
    rerenderedHistory?: number[];
    isAdminJob?: boolean;
}

export interface JobFilterOptions {
    userId?: Types.ObjectId | string;
    projectId?: string;
    status?: string;
    type?: 'image' | 'animation';
    priority?: string;
    tags?: string[];
    startDate?: Date;
    endDate?: Date;
    search?: string;
    approved?: boolean;
    adminView?: boolean;
}

export interface PaginationOptions {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface JobStats {
    totalJobs: number;
    activeJobs: number;
    processingJobs: number;
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    cancelledJobs: number;
    pausedJobs: number;
    completedToday: number;
    totalRenderTime: number;
    totalCreditsUsed: number;
    totalFramesRendered: number;
    avgRenderTimePerFrame: number;
    framesRenderedToday: number;
    estimatedTotalCost: number;
    actualTotalCost: number;
}

export interface UserJobStats {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    totalSpent: number;
    creditsRemaining: number;
    avgJobCompletionTime: number;
    successRate: number;
}

export interface CreateJobRequest {
    blendFile: Express.Multer.File;
    userId: string;
    projectId?: string;
    type: 'image' | 'animation';
    settings: Partial<IJobSettings>;
    startFrame?: number;
    endFrame?: number;
    selectedFrame?: number;
    name?: string;
    description?: string;
    tags?: string[];
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    requireApproval?: boolean;
    isAdminJob?: boolean;
}

export interface CreateJobResponse {
    success: boolean;
    jobId: string;
    message: string;
    type: string;
    totalFrames: number;
    selectedFrames: number[];
    blendFileUrl: string;
    settings: IJobSettings;
    estimatedCost: number;
    estimatedTime: number;
    fileStructure: {
        blendFile: string;
        uploadsFolder: string;
        rendersFolder: string;
    };
}

export interface JobListResponse {
    jobs: Partial<IJob>[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
    stats?: JobStats;
}