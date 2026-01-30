import express from 'express';
import { NodeController } from '../../controllers/node';

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

router.post('/register', NodeController.registerNode);
router.post('/:nodeId/heartbeat', NodeController.heartbeat);
router.post('/:nodeId/assign', NodeController.assignJob);
router.post('/complete-frame/:nodeId', NodeController.frameCompleted);

// Node information
router.get('/', NodeController.getAllNodes);
router.get('/statistics', NodeController.getNodeStatistics);
router.get('/:nodeId', NodeController.getNode);

// Job distribution reporting
router.get('/job-distribution/:jobId', NodeController.getJobDistributionReport);


export default router;