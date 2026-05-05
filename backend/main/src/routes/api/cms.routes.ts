import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import {
  listBlogs,
  createBlog,
  getBlogById,
  updateBlog,
  deleteBlog,
  uploadImage,
  uploadMiddleware,
} from '../../controllers/cmsController';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../../controllers/templateController';

const router = Router();

// Apply authentication + role guard to all CMS routes
router.use(authenticate, authorize('writer', 'admin'));

// Blog routes
router.get('/blogs', listBlogs);
router.post('/blogs', createBlog);
router.get('/blogs/:id', getBlogById);
router.patch('/blogs/:id', updateBlog);
router.delete('/blogs/:id', deleteBlog);

// Image upload
router.post('/upload', uploadMiddleware, uploadImage);

// Template routes — list is accessible to writer + admin (router-level guard covers it)
router.get('/templates', listTemplates);

// Template mutations — admin + writer
router.post('/templates', createTemplate);
router.patch('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

export default router;
