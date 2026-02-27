import { IApplication } from '../models/Application';
import { MIN_REQUIREMENTS, GPU_BLACKLIST } from './AuthService';

// ── Disk space thresholds ─────────────────────────────────────────────────────
export const DISK_THRESHOLDS = {
    /** Absolute minimum — below this, registration and job assignment are blocked */
    BLOCK_GB: 50,
    /** Warning zone — node is allowed but the owner receives a low-disk notification */
    WARN_GB: 100,
} as const;

export class HardwareValidationService {
    /**
     * Compares the hardware detected on the physical node with what the user claimed in their application.
     * Returns a suspicion tag based on the number and severity of discrepancies.
     */
    static evaluateSuspicionLevel(application: IApplication | null | undefined, nodeHardware: any): 'none' | 'little suspicious' | 'more suspicious' | 'complete suspicious' {
        if (!application || !application.applicationData) {
            return 'none';
        }

        const claimed = application.applicationData;
        let discrepancyScore = 0;

        // ── CPU Check ─────────────────────────────
        if (nodeHardware.cpuCores !== undefined && claimed.cpuCores !== undefined) {
            const coreDiff = Math.abs(nodeHardware.cpuCores - claimed.cpuCores);
            if (coreDiff > 4) {
                discrepancyScore += 2;
            } else if (coreDiff > 0 && nodeHardware.cpuCores < claimed.cpuCores) {
                discrepancyScore += 1;
            }
        }

        // ── RAM Check ─────────────────────────────
        if (nodeHardware.ramGB !== undefined && claimed.ramSize !== undefined) {
            const claimedRam = claimed.ramSize;
            const actualRam = Math.ceil(nodeHardware.ramGB);
            const ramDiff = claimedRam - actualRam;
            if (ramDiff > 8) {
                discrepancyScore += 3;
            } else if (ramDiff > 2) {
                discrepancyScore += 1;
            }
        }

        // ── GPU VRAM Check ────────────────────────
        if (nodeHardware.gpuVRAM !== undefined && claimed.gpuVram !== undefined) {
            const claimedVram = claimed.gpuVram;
            const actualVram = Math.ceil(nodeHardware.gpuVRAM / 1024);
            const vramDiff = claimedVram - actualVram;
            if (vramDiff > 4) {
                discrepancyScore += 3;
            } else if (vramDiff >= 1) {
                discrepancyScore += 1;
            }
        }

        // ── GPU Model Spoofing Check ──────────────
        if (nodeHardware.gpuName && claimed.gpuModel) {
            const nodeGpuLower = nodeHardware.gpuName.toLowerCase();
            const claimedGpuLower = claimed.gpuModel.toLowerCase();
            const nodeNumbers = nodeGpuLower.match(/\d{3,4}/) || [];
            const claimedNumbers = claimedGpuLower.match(/\d{3,4}/) || [];
            if (nodeNumbers.length > 0 && claimedNumbers.length > 0) {
                if (nodeNumbers[0] !== claimedNumbers[0]) {
                    discrepancyScore += 3;
                }
            }
        }

        if (discrepancyScore >= 6) return 'complete suspicious';
        if (discrepancyScore >= 3) return 'more suspicious';
        if (discrepancyScore >= 1) return 'little suspicious';
        return 'none';
    }

    /**
     * Validates if the detected hardware meets the absolute minimum requirements defined in AuthService.
     */
    static checkMinimumRequirements(nodeHardware: any): { meetsRequirements: boolean; reason?: string } {
        const errors: string[] = [];

        const nodeRamGB = Math.ceil(nodeHardware.ramGB || 0);
        if (nodeRamGB < MIN_REQUIREMENTS.ramSize) {
            errors.push(`RAM: Detected ${nodeRamGB}GB (Min required: ${MIN_REQUIREMENTS.ramSize}GB)`);
        }

        const nodeVramGB = Math.ceil((nodeHardware.gpuVRAM || 0) / 1024);
        if (nodeVramGB < MIN_REQUIREMENTS.gpuVram) {
            errors.push(`VRAM: Detected ${nodeVramGB}GB (Min required: ${MIN_REQUIREMENTS.gpuVram}GB)`);
        }

        if ((nodeHardware.cpuCores || 0) < MIN_REQUIREMENTS.cpuCores) {
            errors.push(`CPU Cores: Detected ${nodeHardware.cpuCores} (Min required: ${MIN_REQUIREMENTS.cpuCores} cores)`);
        }

        const gpuModelLower = (nodeHardware.gpuName || '').toLowerCase();
        if (gpuModelLower) {
            const isBlacklisted = GPU_BLACKLIST.some(b => gpuModelLower.includes(b));
            if (isBlacklisted) {
                errors.push(`GPU Model: "${nodeHardware.gpuName}" is not compatible with our rendering engine.`);
            }
        } else {
            errors.push('GPU Model: Unable to detect a compatible discrete GPU.');
        }

        if (errors.length === 0) return { meetsRequirements: true };
        return { meetsRequirements: false, reason: errors.join('. ') };
    }

    /**
     * Checks free disk space against the two thresholds:
     *   < BLOCK_GB  → { allowed: false, warn: false } — block registration / job assignment
     *   < WARN_GB   → { allowed: true,  warn: true  } — allow but notify node owner
     *   >= WARN_GB  → { allowed: true,  warn: false } — all good
     */
    static checkFreeDisk(freeDiskGB: number): {
        allowed: boolean;
        warn: boolean;
        message: string;
    } {
        if (freeDiskGB < DISK_THRESHOLDS.BLOCK_GB) {
            return {
                allowed: false,
                warn: false,
                message: `Node does not meet minimum storage requirements (50GB). This node has been revoked.`
            };
        }
        if (freeDiskGB < DISK_THRESHOLDS.WARN_GB) {
            return {
                allowed: true,
                warn: true,
                message: `Please increase your free storage for a smoother rendering experience. ${freeDiskGB.toFixed(1)} GB free.`
            };
        }
        return {
            allowed: true,
            warn: false,
            message: `Disk space OK: ${freeDiskGB.toFixed(1)} GB free.`
        };
    }
}
