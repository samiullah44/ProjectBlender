import { IApplication } from '../models/Application';
import { MIN_REQUIREMENTS, GPU_BLACKLIST } from './AuthService';

export class HardwareValidationService {
    /**
     * Compares the hardware detected on the physical node with what the user claimed in their application.
     * Returns a suspicion tag based on the number and severity of discrepancies.
     */
    static evaluateSuspicionLevel(application: IApplication | null | undefined, nodeHardware: any): 'none' | 'little suspicious' | 'more suspicious' | 'complete suspicious' {
        if (!application || !application.applicationData) {
            // If there's no application (e.g. legacy user or DB issue), we can't judge suspicion
            return 'none';
        }

        const claimed = application.applicationData;
        let discrepancyScore = 0;

        // ── CPU Check ─────────────────────────────
        if (nodeHardware.cpuCores !== undefined && claimed.cpuCores !== undefined) {
            // Allow minor tolerance for CPU logical cores vs physical cores reporting
            const coreDiff = Math.abs(nodeHardware.cpuCores - claimed.cpuCores);
            if (coreDiff > 4) {
                discrepancyScore += 2;
            } else if (coreDiff > 0 && nodeHardware.cpuCores < claimed.cpuCores) {
                // They lied and have *fewer* cores than claimed
                discrepancyScore += 1;
            }
        }

        // ── RAM Check ─────────────────────────────
        if (nodeHardware.ramGB !== undefined && claimed.ramSize !== undefined) {
            const claimedRam = claimed.ramSize;
            const actualRam = Math.ceil(nodeHardware.ramGB); // Node might report 15.9 instead of 16

            const ramDiff = claimedRam - actualRam;
            if (ramDiff > 8) {
                discrepancyScore += 3; // Huge difference (claimed 32GB, has 16GB)
            } else if (ramDiff > 2) {
                discrepancyScore += 1; // Minor difference
            }
        }

        // ── GPU VRAM Check ────────────────────────
        if (nodeHardware.gpuVRAM !== undefined && claimed.gpuVram !== undefined) {
            const claimedVram = claimed.gpuVram;
            const actualVram = Math.ceil(nodeHardware.gpuVRAM / 1024); // Assuming node reports MB

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

            // If we extract just the numbers (e.g., "RTX 3060" -> "3060"), at least the series should match.
            const nodeNumbers = nodeGpuLower.match(/\d{3,4}/) || [];
            const claimedNumbers = claimedGpuLower.match(/\d{3,4}/) || [];

            if (nodeNumbers.length > 0 && claimedNumbers.length > 0) {
                if (nodeNumbers[0] !== claimedNumbers[0]) {
                    discrepancyScore += 3; // Claimed RTX 4090, connected a GTX 1050
                }
            }
        }

        // ── Determine Tag ─────────────────────────
        if (discrepancyScore >= 6) {
            return 'complete suspicious';
        } else if (discrepancyScore >= 3) {
            return 'more suspicious';
        } else if (discrepancyScore >= 1) {
            return 'little suspicious';
        }

        return 'none';
    }

    /**
     * Validates if the detected hardware meets the absolute minimum requirements defined in AuthService.
     */
    static checkMinimumRequirements(nodeHardware: any): { meetsRequirements: boolean; reason?: string } {
        const errors: string[] = [];

        // 1. RAM Check
        const nodeRamGB = Math.ceil(nodeHardware.ramGB || 0);
        if (nodeRamGB < MIN_REQUIREMENTS.ramSize) {
            errors.push(`RAM: Detected ${nodeRamGB}GB (Min required: ${MIN_REQUIREMENTS.ramSize}GB)`);
        }

        // 2. VRAM Check
        const nodeVramGB = Math.ceil((nodeHardware.gpuVRAM || 0) / 1024); // Convert MB to GB
        if (nodeVramGB < MIN_REQUIREMENTS.gpuVram) {
            errors.push(`VRAM: Detected ${nodeVramGB}GB (Min required: ${MIN_REQUIREMENTS.gpuVram}GB)`);
        }

        // 3. CPU Cores Check
        if ((nodeHardware.cpuCores || 0) < MIN_REQUIREMENTS.cpuCores) {
            errors.push(`CPU Cores: Detected ${nodeHardware.cpuCores} (Min required: ${MIN_REQUIREMENTS.cpuCores} cores)`);
        }

        // 4. GPU Blacklist Check
        const gpuModelLower = (nodeHardware.gpuName || '').toLowerCase();
        let isBlacklisted = false;

        if (gpuModelLower) {
            isBlacklisted = GPU_BLACKLIST.some(blacklisted => gpuModelLower.includes(blacklisted));
            if (isBlacklisted) {
                errors.push(`GPU Model: "${nodeHardware.gpuName}" is not compatible with our rendering engine.`);
            }
        } else {
            errors.push("GPU Model: Unable to detect a compatible discrete GPU.");
        }

        if (errors.length === 0) {
            return { meetsRequirements: true };
        }

        return {
            meetsRequirements: false,
            reason: errors.join('. ')
        };
    }
}
