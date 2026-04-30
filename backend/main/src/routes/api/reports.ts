import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { Report, ReportReason } from '../../models/Report';
import { Blog } from '../../models/Blog';
import { Comment } from '../../models/Comment';
import mongoose from 'mongoose';
import { wsService } from '../../app';

const router = Router();

const VALID_REASONS: ReportReason[] = [
  'spam',
  'misinformation',
  'hate_speech',
  'harassment',
  'inappropriate_content',
  'other',
];

/**
 * POST /api/reports
 * Submit a report for a blog post or comment.
 * Requires authentication.
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetType, targetId, reason, details } = req.body;
    const userId = req.user.userId;

    // Validate targetType
    if (!['blog', 'comment'].includes(targetType)) {
      res.status(400).json({ success: false, error: 'Invalid target type' });
      return;
    }

    // Validate targetId format
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, error: 'Invalid target ID' });
      return;
    }

    // Validate reason
    if (!VALID_REASONS.includes(reason)) {
      res.status(400).json({
        success: false,
        error: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}`,
      });
      return;
    }

    // Verify the target actually exists
    if (targetType === 'blog') {
      const blog = await Blog.findById(targetId);
      if (!blog) {
        res.status(404).json({ success: false, error: 'Blog post not found' });
        return;
      }
    } else {
      const comment = await Comment.findById(targetId);
      if (!comment) {
        res.status(404).json({ success: false, error: 'Comment not found' });
        return;
      }
    }

    // Create report — unique index prevents duplicate reports from same user
    const report = await Report.create({
      targetType,
      targetId,
      reportedBy: userId,
      reason,
      details: details?.trim() || undefined,
    });

    // Notify admin clients in real time
    wsService.broadcastSystemUpdate({ type: 'report_submitted', targetType, targetId });

    res.status(201).json({ success: true, report });
  } catch (error: any) {
    // Duplicate key error = user already reported this target
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        error: 'You have already reported this content',
      });
      return;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

import { authorize } from '../../middleware/auth';

/**
 * GET /api/reports
 * Admin only — list all reports with pagination and status filter.
 */
router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query: any = {};
    if (status && ['pending', 'reviewed', 'dismissed'].includes(status as string)) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('reportedBy', 'name email username'),
      Report.countDocuments(query),
    ]);

    res.json({
      success: true,
      reports,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/reports/:id
 * Admin only — update report status (reviewed / dismissed).
 */
router.patch('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['reviewed', 'dismissed'].includes(status)) {
      res.status(400).json({ success: false, error: 'Status must be "reviewed" or "dismissed"' });
      return;
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }

    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
