import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { Blog } from '../models/Blog';
import { AuthRequest } from '../middleware/auth';
import { S3Service } from '../services/S3Service';
import { wsService } from '../app';

const s3Service = new S3Service();

// ── Multer Upload Middleware ───────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

export const uploadMiddleware = upload.single('image');

// ── Slug Utilities ────────────────────────────────────────────────────────────

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  const isSlugTaken = async (slug: string): Promise<boolean> => {
    const query: any = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Blog.findOne(query).lean();
    return !!existing;
  };

  if (!(await isSlugTaken(baseSlug))) return baseSlug;

  for (let i = 2; i <= 10; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!(await isSlugTaken(candidate))) return candidate;
  }

  // Fallback: UUID suffix
  return `${baseSlug}-${uuidv4().slice(0, 8)}`;
}

// ── createBlog ────────────────────────────────────────────────────────────────

export const createBlog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, slug: bodySlug, templateId, category, tags, contentBlocks, seoMeta, coverImage, status, isFeatured, readTime } = req.body;

    if (!title) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    const baseSlug = bodySlug ? generateSlug(bodySlug) : generateSlug(title);

    // Check slug uniqueness
    const existingWithSlug = await Blog.findOne({ slug: baseSlug }).lean();
    if (existingWithSlug) {
      const suggestedSlug = await findUniqueSlug(baseSlug);
      res.status(409).json({ success: false, error: 'Slug already exists', suggestedSlug });
      return;
    }

    const isAdmin = req.user!.roles?.includes('admin');
    let finalStatus = status || 'DRAFT';

    // Status transition enforcement to prevent non-admins from publishing
    if (!isAdmin && finalStatus === 'PUBLISHED') {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    const blog = new Blog({
      title,
      slug: baseSlug,
      authorId: req.user!.userId,   // always from token, never from body
      templateId,
      category,
      tags,
      contentBlocks,
      seoMeta,
      coverImage,
      readTime,
      status: finalStatus,
      isFeatured: isFeatured || false,
      publishedAt: finalStatus === 'PUBLISHED' ? new Date() : undefined,
    });

    await blog.save();
    res.status(201).json({ success: true, blog });
  } catch (error) {
    console.error('createBlog error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── listBlogs ─────────────────────────────────────────────────────────────────

export const listBlogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.roles?.includes('admin');
    const { status, search, page = '1', limit = '20' } = req.query as Record<string, string>;

    const filter: any = {};

    // Scope: writers see only their own posts
    if (!isAdmin) {
      filter.authorId = req.user!.userId;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [blogs, total] = await Promise.all([
      Blog.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
      Blog.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, blogs, total, page: pageNum });
  } catch (error) {
    console.error('listBlogs error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── getBlogById ───────────────────────────────────────────────────────────────

export const getBlogById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blog = await Blog.findById(req.params.id).lean();
    if (!blog) {
      res.status(404).json({ success: false, error: 'Blog post not found' });
      return;
    }
    res.status(200).json({ success: true, blog });
  } catch (error) {
    console.error('getBlogById error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── updateBlog ────────────────────────────────────────────────────────────────

export const updateBlog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      res.status(404).json({ success: false, error: 'Blog post not found' });
      return;
    }

    const isAdmin = req.user!.roles?.includes('admin');
    const isAuthor = blog.authorId.toString() === req.user!.userId;

    if (!isAdmin && !isAuthor) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    const { status: newStatus, ...rest } = req.body;

    // Status transition enforcement
    if (newStatus !== undefined) {
      if (!isAdmin && newStatus === 'PUBLISHED') {
        res.status(403).json({ success: false, error: 'Insufficient permissions' });
        return;
      }

      const previousStatus = blog.status;

      // Set publishedAt when transitioning to PUBLISHED
      if (newStatus === 'PUBLISHED' && previousStatus !== 'PUBLISHED') {
        blog.publishedAt = new Date();
      }

      // Clear publishedAt when unpublishing (PUBLISHED → DRAFT)
      if (newStatus === 'DRAFT' && previousStatus === 'PUBLISHED') {
        blog.publishedAt = undefined;
      }

      blog.status = newStatus;
    }

    // Apply remaining fields (excluding authorId to prevent hijacking)
    const { authorId: _ignored, ...safeRest } = rest;
    Object.assign(blog, safeRest);

    await blog.save();

    // Notify all connected clients when a post is published or unpublished
    if (newStatus === 'PUBLISHED' || (newStatus === 'DRAFT' && blog.status !== 'PUBLISHED')) {
      wsService.broadcastSystemUpdate({
        type: 'blog_status_changed',
        slug: blog.slug,
        status: blog.status,
      });
    }

    res.status(200).json({ success: true, blog });
  } catch (error) {
    console.error('updateBlog error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── deleteBlog ────────────────────────────────────────────────────────────────

export const deleteBlog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      res.status(404).json({ success: false, error: 'Blog post not found' });
      return;
    }

    const isAdmin = req.user!.roles?.includes('admin');
    const isAuthor = blog.authorId.toString() === req.user!.userId;

    if (!isAdmin && !isAuthor) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    await blog.deleteOne();
    res.status(200).json({ success: true, message: 'Blog post deleted' });
  } catch (error) {
    console.error('deleteBlog error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── uploadImage ───────────────────────────────────────────────────────────────

export const uploadImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ success: false, error: 'Invalid file type' });
      return;
    }

    const url = await s3Service.uploadBlogImage(req.file);
    res.status(200).json({ success: true, url });
  } catch (error: any) {
    if (error?.message === 'File too large') {
      res.status(400).json({ success: false, error: 'File too large' });
      return;
    }
    console.error('uploadImage error:', error);
    res.status(500).json({ success: false, error: 'Image upload failed' });
  }
};
