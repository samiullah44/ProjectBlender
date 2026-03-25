import express from 'express';
import { NodeController } from '../../controllers/node';
import { NodeSoftwareController } from '../../controllers/NodeSoftwareController';
import { authenticate, authorize } from '../../middleware/auth';
import { tokenVerifyLimiter, tokenGenerateLimiter } from '../../middleware/rateLimiter';
import { validateNodeSecret } from '../../middleware/nodeAuth';

const router = express.Router();

// Start offline checker when routes are loaded
NodeController.startOfflineNodeChecker();

// Cleanup on shutdown
process.on('SIGINT', () => {
  NodeController.stopOfflineNodeChecker();
  process.exit(0);
});

process.on('SIGTERM', () => {
  NodeController.stopOfflineNodeChecker();
  process.exit(0);
});

// ── Token-based secure registration (new flow) ──────────────────────────────

// Generate a one-time pairing token (dashboard → node provider)
router.post(
  '/tokens/generate',
  authenticate,
  authorize('node_provider', 'admin'),
  tokenGenerateLimiter,
  NodeController.generateToken
);

// List active tokens for the authenticated node_provider
router.get(
  '/tokens',
  authenticate,
  authorize('node_provider', 'admin'),
  NodeController.listTokens
);

// Node registers itself using the one-time token (rate-limited against brute-force)
router.post('/register-with-token', tokenVerifyLimiter, NodeController.registerWithToken);

// Revoke a node (node provider or admin)
router.post('/revoke', authenticate, authorize('node_provider', 'admin'), NodeController.revokeNode);

// ── Legacy node endpoints (maintain backward compat) ─────────────────────────

router.post('/register', NodeController.registerNode);
// validateNodeSecret enforces ENFORCE_NODE_SECRET (default: strict).
// Add X-Node-Id and X-Node-Secret headers from the C# node for these endpoints.
router.post('/:nodeId/heartbeat', validateNodeSecret, NodeController.heartbeat);
router.post('/:nodeId/assign', validateNodeSecret, NodeController.assignJob);
router.post('/complete-frame/:nodeId', validateNodeSecret, NodeController.frameCompleted);

// Node information - Protected
router.get('/', authenticate, NodeController.getAllNodes);
router.get('/statistics', authenticate, NodeController.getNodeStatistics);

// ── Node Software Download ────────────────────────────────────────────────────
// Must be declared before /:nodeId to avoid being captured as a node ID lookup
router.get(
  '/software/download',
  authenticate,
  authorize('node_provider', 'client', 'admin'),
  NodeSoftwareController.getDownloadUrl
);

router.get('/:nodeId', authenticate, NodeController.getNode);
router.get('/:nodeId/history', authenticate, NodeController.getNodeHistory);

// Job distribution reporting
router.get('/job-distribution/:jobId', NodeController.getJobDistributionReport);

export default router;