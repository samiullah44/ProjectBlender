// controllers/NodeSoftwareController.ts
import { Request, Response } from 'express';
import { S3Service } from '../services/S3Service';

const s3Service = new S3Service();

export class NodeSoftwareController {
    /**
     * GET /api/nodes/software/download
     *
     * Returns a fresh 24-hour pre-signed S3 URL for downloading BlendFarmNode.exe.
     * The frontend triggers an automatic download using this URL.
     *
     * Auth: node_provider | client | admin
     */
    static async getDownloadUrl(req: Request, res: Response): Promise<void> {
        try {
            const EXPIRES_IN = 86400; // 24 hours

            const downloadUrl = await s3Service.getNodeSoftwareDownloadUrl(EXPIRES_IN);

            res.json({
                success: true,
                downloadUrl,
                filename: 'BlendFarmNode.zip',
                expiresIn: EXPIRES_IN,
                expiresAt: new Date(Date.now() + EXPIRES_IN * 1000).toISOString(),
            });
        } catch (error: any) {
            console.error('[NodeSoftwareController] getDownloadUrl error:', error);

            // Distinguish "file not yet seeded" from generic S3 errors
            if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') {
                res.status(404).json({
                    success: false,
                    error: 'NODE_SOFTWARE_NOT_FOUND',
                    message:
                        'Node software has not been uploaded yet. Run the seed script first.',
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'DOWNLOAD_URL_FAILED',
                message: 'Failed to generate download URL. Please try again later.',
            });
        }
    }
}
