import { Router, Request, Response } from 'express';
import { Blog } from '../../models/Blog';
import { Comment } from '../../models/Comment';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { wsService } from '../../app';

const router = Router({ mergeParams: true });

const EDIT_WINDOW_MS = 20 * 60 * 1000; // 20 minutes

// ─── POST a new comment ───────────────────────────────────────────────────────
router.post('/:slug/comments', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { text } = req.body;

    const blog = await Blog.findOne({ slug, status: 'PUBLISHED' });
    if (!blog) { res.status(404).json({ success: false, error: 'Blog post not found' }); return; }

    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!trimmedText) { res.status(400).json({ success: false, error: 'Comment text is required' }); return; }
    if (trimmedText.length > 1000) { res.status(400).json({ success: false, error: 'Comment text must not exceed 1000 characters' }); return; }

    const comment = await Comment.create({
      blogId: blog._id,
      authorId: req.user.userId,
      text: trimmedText,
      claps: 0,
      clappers: [],
      hidden: false,
    });

    await Blog.findByIdAndUpdate(blog._id, { $inc: { commentsCount: 1 } });
    await comment.populate('authorId', 'name username');

    wsService.broadcastSystemUpdate({ type: 'comment_added', slug, commentsCount: (blog.commentsCount ?? 0) + 1 });

    res.status(201).json({ success: true, comment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PATCH edit a comment (author only, within 20 min) ────────────────────────
router.patch('/:slug/comments/:commentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }

    // Only the author can edit
    if (comment.authorId.toString() !== req.user.userId) {
      res.status(403).json({ success: false, error: 'Only the comment author can edit' });
      return;
    }

    // Enforce 20-minute edit window
    const ageMs = Date.now() - new Date(comment.createdAt).getTime();
    if (ageMs > EDIT_WINDOW_MS) {
      res.status(403).json({ success: false, error: 'Edit window has expired (20 minutes)' });
      return;
    }

    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!trimmedText) { res.status(400).json({ success: false, error: 'Comment text is required' }); return; }
    if (trimmedText.length > 1000) { res.status(400).json({ success: false, error: 'Comment text must not exceed 1000 characters' }); return; }

    comment.text = trimmedText;
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate('authorId', 'name username');

    const { slug } = req.params;
    wsService.broadcastSystemUpdate({ type: 'comment_updated', slug, comment });

    res.json({ success: true, comment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DELETE a comment (author or admin) ──────────────────────────────────────
router.delete('/:slug/comments/:commentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug, commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }

    const userRoles: string[] = req.user.roles || (req.user.role ? [req.user.role] : []);
    const isAuthor = comment.authorId.toString() === req.user.userId;
    const isAdmin = userRoles.includes('admin');

    if (!isAuthor && !isAdmin) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    await Comment.findByIdAndDelete(commentId);
    await Blog.findOneAndUpdate(
      { slug },
      [{ $set: { commentsCount: { $max: [0, { $subtract: ['$commentsCount', 1] }] } } }]
    );

    wsService.broadcastSystemUpdate({ type: 'comment_deleted', slug });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PATCH hide/show a comment (admin only) ───────────────────────────────────
router.patch('/:slug/comments/:commentId/visibility', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { commentId, slug } = req.params;
    const { hidden } = req.body;

    if (typeof hidden !== 'boolean') {
      res.status(400).json({ success: false, error: '"hidden" must be a boolean' });
      return;
    }

    const comment = await Comment.findByIdAndUpdate(commentId, { hidden }, { new: true });
    if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }

    wsService.broadcastSystemUpdate({ type: 'comment_visibility_changed', slug, commentId, hidden });

    res.json({ success: true, comment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST clap ────────────────────────────────────────────────────────────────
router.post('/:slug/comments/:commentId/clap', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await Comment.findOneAndUpdate(
      { _id: commentId, clappers: { $ne: userId } },
      { $addToSet: { clappers: userId }, $inc: { claps: 1 } },
      { new: true }
    );

    if (!comment) {
      const existing = await Comment.findById(commentId);
      if (!existing) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }
      res.status(409).json({ success: false, error: 'Already clapped' });
      return;
    }

    const { slug } = req.params;
    wsService.broadcastSystemUpdate({ type: 'comment_claps_updated', slug, commentId, claps: comment.claps });

    res.json({ success: true, claps: comment.claps, hasClapped: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DELETE clap ──────────────────────────────────────────────────────────────
router.delete('/:slug/comments/:commentId/clap', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await Comment.findOneAndUpdate(
      { _id: commentId, clappers: userId },
      { $pull: { clappers: userId }, $inc: { claps: -1 } },
      { new: true }
    );

    if (!comment) {
      const existing = await Comment.findById(commentId);
      if (!existing) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }
      res.status(409).json({ success: false, error: 'Not clapped yet' });
      return;
    }

    const { slug } = req.params;
    wsService.broadcastSystemUpdate({ type: 'comment_claps_updated', slug, commentId, claps: comment.claps });

    res.json({ success: true, claps: comment.claps, hasClapped: false });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET comments (public — hidden comments filtered out for non-admins) ──────
router.get('/:slug/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug, sort = 'recent' } = { ...req.params, ...(req.query as any) };

    const blog = await Blog.findOne({ slug });
    if (!blog) { res.status(404).json({ success: false, error: 'Blog post not found' }); return; }

    const sortOrder: any = sort === 'popular' ? { claps: -1, createdAt: -1 } : { createdAt: -1 };

    // Public endpoint — exclude hidden comments
    const comments = await Comment.find({ blogId: blog._id, hidden: false })
      .sort(sortOrder)
      .populate('authorId', 'name username');

    res.json({ success: true, comments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET all comments across all blogs (admin) ──────────────────────────────
router.get('/admin/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sort = 'recent', page = '1', limit = '50', authorId, search } = req.query as Record<string, string>;

    const sortOrder: any = sort === 'popular' ? { claps: -1, createdAt: -1 } : { createdAt: -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query: any = {};
    if (authorId) query.authorId = authorId;
    if (search) query.text = { $regex: search, $options: 'i' };

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('authorId', 'name username email')
        .populate('blogId', 'title slug'),
      Comment.countDocuments(query),
    ]);

    res.json({ success: true, comments, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET all comments for a blog (admin — includes hidden) ───────────────────
router.get('/:slug/comments/admin', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { sort = 'recent', page = '1', limit = '50' } = req.query as Record<string, string>;

    const blog = await Blog.findOne({ slug });
    if (!blog) { res.status(404).json({ success: false, error: 'Blog post not found' }); return; }

    const sortOrder: any = sort === 'popular' ? { claps: -1, createdAt: -1 } : { createdAt: -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [comments, total] = await Promise.all([
      Comment.find({ blogId: blog._id })
        .sort(sortOrder)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('authorId', 'name username email'),
      Comment.countDocuments({ blogId: blog._id }),
    ]);

    res.json({ success: true, comments, total, blog: { title: blog.title, slug: blog.slug } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
