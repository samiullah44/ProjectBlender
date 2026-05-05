import React, { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Calendar, User, Tag, ChevronRight, Eye } from 'lucide-react';
import api from '@/lib/axios';
import BlockRenderer from '../../components/blog/BlockRenderer';
import type { ContentBlock } from '@/types/blog';
import SEO from '../../components/SEO';
import FavoriteButton from '../../components/blog/FavoriteButton';
import CommentSection from '@/components/blog/comments/CommentSection';
import BottomActionBar from '@/components/blog/comments/BottomActionBar';
import { useBlogRealtime } from '@/hooks/useBlogRealtime';

interface BlogPostData {
  _id: string;
  title: string;
  slug: string;
  authorId: { name: string; username: string } | string;
  status: string;
  category: string;
  tags?: string[];
  coverImage?: string;
  contentBlocks: ContentBlock[];
  seoMeta: { title: string; description: string; ogImage: string };
  readTime: string;
  publishedAt: string;
  favoritesCount: number;
  viewsCount: number;
  commentsCount: number;
}

function getAuthorName(authorId: BlogPostData['authorId']): string {
  if (typeof authorId === 'object' && authorId !== null) {
    return authorId.name || authorId.username || 'Unknown Author';
  }
  return 'Unknown Author';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function BlogPostSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-6" />
      <div className="h-12 bg-gray-200 rounded mb-4 w-4/5" />
      <div className="h-6 bg-gray-200 rounded mb-8 w-2/3" />
      <div className="h-[400px] bg-gray-200 rounded-2xl mb-10" />
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className={`h-4 bg-gray-200 rounded ${i % 4 === 3 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

export const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const commentSectionRef = useRef<HTMLDivElement>(null);

  // Auto-refresh comments, likes, and post data via WebSocket
  useBlogRealtime({ slug });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['blogPost', slug],
    queryFn: async () => {
      const res = await api.get(`/blogs/${slug}`);
      return res.data as { success: boolean; blog: BlogPostData };
    },
    enabled: !!slug,
    retry: false,
  });

  // Fetch more posts for the "More Posts" section
  const { data: morePosts = [] } = useQuery({
    queryKey: ['morePosts', slug],
    queryFn: async () => {
      const res = await api.get(`/blogs?limit=3`);
      return (res.data.blogs as BlogPostData[]).filter((p) => p.slug !== slug).slice(0, 3);
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return <div className="min-h-screen bg-white"><BlogPostSkeleton /></div>;
  }

  const is404 = (error as any)?.response?.status === 404 || (data && !data.success);

  if (is404) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-8xl font-black text-gray-100 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Post not found</h2>
        <p className="text-gray-500 mb-8 max-w-md">The article you're looking for doesn't exist or has been removed.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white font-semibold hover:bg-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Something went wrong</h2>
        <p className="text-gray-500 mb-8">We couldn't load this article. Please try again later.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white font-semibold hover:bg-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>
    );
  }

  const blog = data!.blog;
  const authorName = getAuthorName(blog.authorId);
  const blocks = Array.isArray(blog.contentBlocks)
    ? blog.contentBlocks
    : (blog.contentBlocks as any)?.content ?? [];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <SEO
        title={blog.seoMeta?.title || blog.title}
        description={blog.seoMeta?.description || ''}
        ogImage={blog.coverImage || blog.seoMeta?.ogImage}
        ogType="article"
      />

      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            {blog.category && (
              <>
                <span className="hover:text-gray-900 transition-colors cursor-pointer">{blog.category}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
            <span className="text-gray-900 font-medium truncate max-w-[200px]">{blog.title}</span>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-12">

        {/* Category pill */}
        {blog.category && (
          <div className="mb-5">
            <span className="text-xs font-bold tracking-widest text-purple-600 uppercase bg-purple-50 px-3 py-1.5 rounded-full">
              {blog.category}
            </span>
          </div>
        )}

        {/* Date */}
        <p className="text-sm text-gray-400 mb-4 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(blog.publishedAt)}
        </p>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
          {blog.title}
        </h1>

        {/* SEO description as subtitle */}
        {blog.seoMeta?.description && (
          <p className="text-xl text-gray-500 leading-relaxed mb-8 font-light">
            {blog.seoMeta.description}
          </p>
        )}

        {/* Author + meta row */}
        <div className="flex items-center justify-between gap-4 py-5 border-y border-gray-100 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{authorName}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                {blog.readTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {blog.readTime}
                  </span>
                )}
                {blog.publishedAt && (
                  <span>{formatDate(blog.publishedAt)}</span>
                )}
              </div>
            </div>
          </div>
          <FavoriteButton slug={blog.slug} initialCount={blog.favoritesCount} />
        </div>

        {/* Content */}
        <div className="
          [&_h1]:text-4xl [&_h1]:font-extrabold [&_h1]:text-gray-900 [&_h1]:mt-12 [&_h1]:mb-5 [&_h1]:leading-tight
          [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:leading-tight
          [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-8 [&_h3]:mb-3
          [&_h4]:text-xl [&_h4]:font-semibold [&_h4]:text-gray-800 [&_h4]:mt-6 [&_h4]:mb-2
          [&_p]:text-gray-700 [&_p]:leading-[1.85] [&_p]:mb-5 [&_p]:text-[17px]
          [&_blockquote]:border-l-4 [&_blockquote]:border-purple-400 [&_blockquote]:pl-6 [&_blockquote]:py-2 [&_blockquote]:my-8 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:bg-purple-50/50 [&_blockquote]:rounded-r-xl
          [&_pre]:bg-gray-950 [&_pre]:text-gray-100 [&_pre]:rounded-xl [&_pre]:p-6 [&_pre]:my-8 [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre]:leading-relaxed
          [&_code]:bg-gray-100 [&_code]:text-purple-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
          [&_pre_code]:bg-transparent [&_pre_code]:text-gray-100 [&_pre_code]:p-0
          [&_ul]:list-disc [&_ul]:pl-7 [&_ul]:my-5 [&_ul]:space-y-2 [&_ul]:text-gray-700 [&_ul]:text-[17px]
          [&_ol]:list-decimal [&_ol]:pl-7 [&_ol]:my-5 [&_ol]:space-y-2 [&_ol]:text-gray-700 [&_ol]:text-[17px]
          [&_li]:leading-relaxed
          [&_img]:rounded-xl [&_img]:my-8 [&_img]:max-w-full [&_img]:shadow-md
          [&_figure]:my-8
          [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-gray-400 [&_figcaption]:mt-2 [&_figcaption]:italic
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-8 [&_table]:text-sm
          [&_th]:bg-gray-50 [&_th]:border [&_th]:border-gray-200 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-900
          [&_td]:border [&_td]:border-gray-200 [&_td]:px-4 [&_td]:py-3 [&_td]:text-gray-700
          [&_tr:nth-child(even)_td]:bg-gray-50
          [&_a]:text-purple-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-purple-800
          [&_strong]:font-bold [&_strong]:text-gray-900
          [&_em]:italic
        ">
          <BlockRenderer blocks={blocks} />
        </div>

        {/* Tags */}
        {blog.tags && blog.tags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {blog.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer">
                  <Tag className="w-3 h-3" />
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action bar — comment count, share, report */}
        <BottomActionBar
          commentCount={data?.blog?.commentsCount ?? 0}
          postTitle={blog.title}
          blogId={blog._id}
          commentSectionRef={commentSectionRef}
        />

        {/* Author card */}
        <div className="mt-12 p-6 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Written by</p>
              <p className="font-bold text-gray-900 text-lg">{authorName}</p>
              <p className="text-gray-500 text-sm mt-1">Content writer at RenderOnNodes</p>
            </div>
          </div>
        </div>

        {/* Comment section */}
        <CommentSection
          slug={blog.slug}
          initialCount={blog.commentsCount ?? 0}
          ref={commentSectionRef}
        />

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>
          <FavoriteButton slug={blog.slug} initialCount={blog.favoritesCount} />
        </div>

        {/* More posts */}
        {morePosts.length > 0 && (
          <div className="mt-16">
            <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-8">
              More Posts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {morePosts.map((post) => (
                <Link key={post._id} to={`/${post.slug}`} className="group block">
                  {(post.coverImage || post.seoMeta?.ogImage) && (
                    <div className="h-40 rounded-xl overflow-hidden mb-3">
                      <img
                        src={post.coverImage || post.seoMeta?.ogImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  {post.category && (
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                      {post.category}
                    </span>
                  )}
                  <h4 className="font-bold text-gray-900 mt-1 mb-2 leading-snug group-hover:text-purple-600 transition-colors line-clamp-2">
                    {post.title}
                  </h4>
                  <p className="text-xs text-gray-400 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                    <span>·</span>
                    {formatDate(post.publishedAt)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};

export default BlogPost;
