// backend/src/routes/api/analytics.ts
import { Router } from 'express';
import {
  trackBatch,
  getDashboard,
  getUsers,
  getUserActivity,
  getRealtime,
  getPageFlow,
  getReportData,
} from '../../controllers/AnalyticsController';

const router = Router();

// ── Public tracking endpoint (no auth – called by frontend SDK) ──
// Rate-limited by IP on the nginx / API gateway level in production
router.post('/track', trackBatch);

// ── Admin-only endpoints ─────────────────────────────────────────
// Note: add your existing `requireAuth` + `requireAdmin` middleware
// once you have verified the feature works end-to-end

// GET /api/analytics/dashboard?range=7d&country=PK&group_by=day
router.get('/dashboard', getDashboard);

// GET /api/analytics/realtime
router.get('/realtime', getRealtime);

// GET /api/analytics/page-flow?range=7d
router.get('/page-flow', getPageFlow);

// GET /api/analytics/reports?type=engagement&range=7d&os=windows
router.get('/reports', getReportData);

// GET /api/analytics/users?range=7d&country=PK&search=john&page=1&limit=50
router.get('/users', getUsers);

// GET /api/analytics/users/:userId/activity?range=30d
router.get('/users/:userId/activity', getUserActivity);

export default router;
