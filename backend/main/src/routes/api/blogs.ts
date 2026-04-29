import { Router, Request, Response } from 'express';
import { Blog } from '../../models/Blog';
import { User } from '../../models/User';
import { authenticate, optionalAuthenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

// PUBLIC: Get published blogs
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, limit = 10, pinned, featured } = req.query;
    const query: any = { status: 'PUBLISHED' };
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (pinned === 'true') {
      query.pinned = true;
    } else if (pinned === 'false') {
      query.pinned = false;
    }

    if (featured === 'true') {
      query.isFeatured = true;
    } else if (featured === 'false') {
      query.isFeatured = false;
    }

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1 })
      .limit(Number(limit))
      .populate('authorId', 'name username');

    res.json({ success: true, blogs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AUTHENTICATED: Get user's favorited published blogs (must be before /:slug)
router.get('/favorites', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user.userId).populate('favoriteBlogPosts');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const publishedFavorites = (user.favoriteBlogPosts as any[]).filter(
      (post: any) => post.status === 'PUBLISHED'
    );

    res.json({ success: true, blogs: publishedFavorites });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AUTHENTICATED OR ANONYMOUS: Add blog to favorites
router.post('/:slug/favorite', optionalAuthenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });
    if (!blog) {
      res.status(404).json({ success: false, error: 'Blog post not found' });
      return;
    }

    if (req.user?.userId) {
      // Authenticated: persist to user's favorites list
      const user = await User.findById(req.user.userId);
      if (user) {
        const alreadyFavorited = user.favoriteBlogPosts.some(
          (id) => id.toString() === blog._id.toString()
        );
        if (!alreadyFavorited) {
          await User.findByIdAndUpdate(req.user.userId, {
            $addToSet: { favoriteBlogPosts: blog._id }
          });
          await Blog.findByIdAndUpdate(blog._id, { $inc: { favoritesCount: 1 } });
        }
      }
    } else {
      // Anonymous: just increment the counter
      await Blog.findByIdAndUpdate(blog._id, { $inc: { favoritesCount: 1 } });
    }

    res.json({ success: true, favorited: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AUTHENTICATED OR ANONYMOUS: Remove blog from favorites
router.delete('/:slug/favorite', optionalAuthenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });
    if (!blog) {
      res.status(404).json({ success: false, error: 'Blog post not found' });
      return;
    }

    if (req.user?.userId) {
      const user = await User.findById(req.user.userId);
      if (user) {
        const wasFavorited = user.favoriteBlogPosts.some(
          (id) => id.toString() === blog._id.toString()
        );
        await User.findByIdAndUpdate(req.user.userId, { $pull: { favoriteBlogPosts: blog._id } });
        if (wasFavorited && blog.favoritesCount > 0) {
          await Blog.findByIdAndUpdate(blog._id, { $inc: { favoritesCount: -1 } });
        }
      }
    } else {
      // Anonymous: decrement if count > 0
      if (blog.favoritesCount > 0) {
        await Blog.findByIdAndUpdate(blog._id, { $inc: { favoritesCount: -1 } });
      }
    }

    res.json({ success: true, favorited: false });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get single blog by slug (increments view count)
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOneAndUpdate(
      { slug, status: 'PUBLISHED' },
      { $inc: { viewsCount: 1 } },
      { new: true }
    ).populate('authorId', 'name username');
    
    if (!blog) {
      res.status(404).json({ success: false, error: 'Blog post not found' });
      return;
    }
    
    res.json({ success: true, blog });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
