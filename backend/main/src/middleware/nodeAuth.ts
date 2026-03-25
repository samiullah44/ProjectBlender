// backend/src/middleware/nodeAuth.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';

/**
 * Middleware: Validates the X-Node-Secret header on node-facing endpoints.
 *
 * Enforcement mode:
 *   - If ENFORCE_NODE_SECRET=true (default) → reject requests with missing/wrong secret.
 *   - If ENFORCE_NODE_SECRET=false → warn in log but allow through (soft/migration mode).
 *
 * The node must include the header:
 *   X-Node-Id: <nodeId>
 *   X-Node-Secret: <plain text secret>
 *
 * The secret is bcrypt-compared against Node.nodeSecretHash (which is excluded from
 * normal queries, so we do a targeted select here).
 */

const ENFORCE = process.env.ENFORCE_NODE_SECRET !== 'false'; // strict by default

export const validateNodeSecret = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const nodeId = req.headers['x-node-id'] as string || req.params?.nodeId;
        const secret = req.headers['x-node-secret'] as string;

        if (!nodeId) {
            if (ENFORCE) {
                res.status(401).json({ success: false, error: 'NODE_IDENTITY_MISSING', message: 'X-Node-Id header required' });
                return;
            }
            return next();
        }

        // Dynamically import to avoid circular deps
        const { Node } = await import('../models/Node');

        // Include nodeSecretHash (normally excluded with select: false)
        const node = await Node.findOne({ nodeId }).select('+nodeSecretHash +isRevoked');

        if (!node) {
            if (ENFORCE) {
                res.status(401).json({ success: false, error: 'NODE_NOT_FOUND', message: 'Node not registered. Use register-with-token first.' });
                return;
            }
            return next(); // Legacy node with no DB record — allow through in soft mode
        }

        // Reject revoked nodes always, regardless of enforce mode
        if (node.isRevoked) {
            res.status(403).json({
                success: false,
                error: 'NODE_REVOKED',
                message: 'This node has been revoked by its owner. Please contact your account administrator.',
            });
            return;
        }

        // If node has no secret stored (legacy node registered before this system)
        if (!node.nodeSecretHash) {
            if (ENFORCE) {
                res.status(401).json({
                    success: false,
                    error: 'NODE_SECRET_REQUIRED',
                    message: 'This node was registered without a secret. Please re-register using a token from the dashboard.',
                });
                return;
            }
            // Soft mode: allow legacy nodes
            console.warn(`⚠️ [SOFT] Node ${nodeId} has no secret — would be rejected with ENFORCE_NODE_SECRET=true`);
            return next();
        }

        if (!secret) {
            if (ENFORCE) {
                res.status(401).json({
                    success: false,
                    error: 'NODE_SECRET_MISSING',
                    message: 'X-Node-Secret header required.',
                });
                return;
            }
            console.warn(`⚠️ [SOFT] Node ${nodeId} sent no secret — would be rejected with ENFORCE_NODE_SECRET=true`);
            return next();
        }

        const isValid = await bcrypt.compare(secret, node.nodeSecretHash);
        if (!isValid) {
            console.warn(`🚫 Invalid node secret from nodeId: ${nodeId}`);
            if (ENFORCE) {
                res.status(401).json({ success: false, error: 'NODE_SECRET_INVALID', message: 'Invalid node secret.' });
                return;
            }
        }

        return next();
    } catch (error) {
        console.error('nodeAuth middleware error:', error);
        if (!ENFORCE) return next();
        res.status(500).json({ success: false, error: 'Auth check failed' });
    }
};
