import mongoose, { Schema, Document } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  authorId: mongoose.Types.ObjectId;
  templateId?: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
  category: string;
  contentBlocks: any[];
  seoMeta: {
    title: string;
    description: string;
    ogImage: string;
  };
  tags: string[];
  coverImage?: string;
  favoritesCount: number;
  readTime: string;
  pinned: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const blogSchema = new Schema<IBlog>({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  templateId: { type: String },
  status: { type: String, enum: ['DRAFT', 'IN_REVIEW', 'PUBLISHED'], default: 'DRAFT' },
  category: { type: String, default: 'Uncategorized' },
  contentBlocks: { type: Schema.Types.Mixed, default: [] },
  seoMeta: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    ogImage: { type: String, default: '' }
  },
  tags: { type: [String], default: [] },
  coverImage: { type: String },
  favoritesCount: { type: Number, default: 0 },
  readTime: { type: String, default: '5 min read' },
  pinned: { type: Boolean, default: false },
  publishedAt: { type: Date }
}, {
  timestamps: true
});

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ slug: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ pinned: 1 });
blogSchema.index({ authorId: 1, updatedAt: -1 });
blogSchema.index({ status: 1, slug: 1 });

export const Blog = mongoose.model<IBlog>('Blog', blogSchema);
