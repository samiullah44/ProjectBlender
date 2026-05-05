import React, { useRef, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Clock, Calendar, ChevronRight, 
  Share2, Twitter, Linkedin, Facebook, Link as LinkIcon,
  List
} from 'lucide-react';
import api from '@/lib/axios';
import BlockRenderer from '../../components/blog/BlockRenderer';
import type { ContentBlock } from '@/types/blog';
import SEO from '../../components/SEO';
import FavoriteButton from '../../components/blog/FavoriteButton';
import CommentSection from '@/components/blog/comments/CommentSection';
import { useBlogRealtime } from '@/hooks/useBlogRealtime';
import { toast } from 'react-hot-toast';

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
  // Force "Admin User" globally as requested for consistency
  return 'Admin User';
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
    <div className="max-w-6xl mx-auto px-6 py-16 animate-pulse">
      <div className="h-[400px] bg-gray-100 rounded-[32px] mb-12" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
        <div>
          <div className="h-4 w-32 bg-gray-100 rounded mb-6" />
          <div className="h-12 bg-gray-100 rounded mb-4 w-4/5" />
          <div className="h-20 bg-gray-100 rounded mb-8 w-full" />
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`h-4 bg-gray-100 rounded ${i % 3 === 0 ? 'w-full' : 'w-5/6'}`} />
            ))}
          </div>
        </div>
        <div className="hidden lg:block space-y-8">
          <div className="h-64 bg-gray-50 rounded-2xl" />
          <div className="h-48 bg-gray-50 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const commentSectionRef = useRef<HTMLDivElement>(null);
  const [activeHeading, setActiveHeading] = useState<string>('');

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
      const res = await api.get(`/blogs?limit=4`);
      return (res.data.blogs as BlogPostData[]).filter((p) => p.slug !== slug).slice(0, 3);
    },
    enabled: !!slug,
  });

  const blocks = data?.blog?.contentBlocks ?? [];
  const headings = blocks
    .filter((b: any) => b.type === 'heading' && (b.attrs?.level === 2 || b.attrs?.level === 3))
    .map((b: any) => {
      const text = b.content?.map((n: any) => n.text ?? '').join('') || '';
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return { text, id, level: b.attrs.level };
    });

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -70% 0px' }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const title = data?.blog?.title || '';
    
    if (platform === 'copy') {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
      return;
    }

    const shares: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    };

    window.open(shares[platform], '_blank', 'width=600,height=400');
  };

  if (isLoading) {
    return <div className="min-h-screen bg-white"><BlogPostSkeleton /></div>;
  }

  const is404 = (error as any)?.response?.status === 404 || (data && !data.success);

  if (is404 || !data?.blog) {
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

  const blog = data.blog;
  const authorName = getAuthorName(blog.authorId);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans pb-20">
      <SEO
        title={blog.seoMeta?.title || blog.title}
        description={blog.seoMeta?.description || ''}
        ogImage={blog.coverImage || blog.seoMeta?.ogImage}
        ogType="article"
      />

      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <Link to="/" className="hover:text-gray-900 transition-colors">Blog</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/?category=${blog.category}`} className="hover:text-gray-900 transition-colors truncate max-w-[150px]">{blog.category}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 truncate max-w-[200px]">{blog.title}</span>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-black text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-12">
        {/* Cover Image - Top curved */}
        {blog.coverImage && (
          <div className="w-full h-[300px] sm:h-[450px] lg:h-[550px] rounded-[32px] sm:rounded-[48px] overflow-hidden mb-12 shadow-2xl shadow-purple-500/10">
            <img 
              src={blog.coverImage} 
              alt={blog.title} 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] lg:gap-16">
          <article>
            {/* Category pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Link to={`/?category=${blog.category}`} className="text-[10px] font-black tracking-[0.2em] text-purple-600 uppercase bg-purple-50 px-3 py-1 rounded-full">
                {blog.category}
              </Link>
              {blog.tags?.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] font-black tracking-[0.2em] text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-8">
              {blog.title}
            </h1>

            {blog.seoMeta?.description && (
              <p className="text-lg sm:text-xl text-gray-500 leading-relaxed mb-10 font-medium max-w-2xl">
                {blog.seoMeta.description}
              </p>
            )}

            <div className="flex items-center justify-between gap-4 pb-8 border-b border-gray-100 mb-12">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                   <img src={`https://ui-avatars.com/api/?name=${authorName}&background=random`} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{authorName}</p>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                    {formatDate(blog.publishedAt)} • {blog.readTime}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-2">Share this article</span>
                <button onClick={() => handleShare('twitter')} className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Twitter size={14} /></button>
                <button onClick={() => handleShare('linkedin')} className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 hover:bg-blue-700 hover:text-white transition-all"><Linkedin size={14} /></button>
                <button onClick={() => handleShare('facebook')} className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-800 hover:bg-blue-800 hover:text-white transition-all"><Facebook size={14} /></button>
                <button onClick={() => handleShare('copy')} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-900 hover:text-white transition-all"><LinkIcon size={14} /></button>
              </div>
            </div>

            {/* Content */}
            <div className="
              [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-12 [&_h2]:mb-5 [&_h2]:leading-tight [&_h2]:scroll-mt-20
              [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:scroll-mt-20
              [&_p]:text-gray-600 [&_p]:leading-[1.8] [&_p]:mb-6 [&_p]:text-[17px]
              [&_blockquote]:border-l-4 [&_blockquote]:border-purple-400 [&_blockquote]:pl-6 [&_blockquote]:py-3 [&_blockquote]:my-10 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_blockquote]:bg-purple-50/50 [&_blockquote]:rounded-r-2xl
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-6 [&_ul]:space-y-3 [&_ul]:text-gray-600
              [&_img]:rounded-2xl [&_img]:my-12 [&_img]:shadow-2xl [&_img]:shadow-gray-200/50
              [&_a]:text-purple-600 [&_a]:underline [&_a]:decoration-purple-200 [&_a]:underline-offset-4 [&_a]:hover:decoration-purple-500 [&_a]:transition-all
            ">
              <BlockRenderer blocks={blocks} />
            </div>

            {/* Comment Section */}
            <div className="mt-20 border-t border-gray-100 pt-16">
               <CommentSection
                slug={blog.slug}
                initialCount={blog.commentsCount ?? 0}
                ref={commentSectionRef}
              />
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-10">
              
              {/* Table of Contents */}
              {headings.length > 0 && (
                <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-3xl">
                  <div className="flex items-center gap-2 mb-6">
                    <List size={16} className="text-purple-500" />
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Table of contents</h4>
                  </div>
                  <nav className="flex flex-col gap-3">
                    {headings.map((h, i) => (
                      <a
                        key={i}
                        href={`#${h.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`text-sm font-medium transition-all duration-300 hover:text-purple-600 ${
                          activeHeading === h.id ? 'text-purple-600 pl-4 border-l-2 border-purple-500' : 'text-gray-500 pl-4 border-l-2 border-transparent'
                        } ${h.level === 3 ? 'ml-4 scale-95 opacity-80' : ''}`}
                      >
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {/* Share Horizontal Buttons */}
              <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-3xl">
                <div className="flex items-center gap-2 mb-6">
                  <Share2 size={16} className="text-purple-500" />
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Share this article</h4>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={() => handleShare('twitter')} className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 transition-all font-bold text-xs uppercase tracking-widest">
                    <span>Twitter</span>
                    <Twitter size={14} className="text-gray-400" />
                  </button>
                  <button onClick={() => handleShare('linkedin')} className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 transition-all font-bold text-xs uppercase tracking-widest">
                    <span>LinkedIn</span>
                    <Linkedin size={14} className="text-gray-400" />
                  </button>
                  <button onClick={() => handleShare('facebook')} className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 transition-all font-bold text-xs uppercase tracking-widest">
                    <span>Facebook</span>
                    <Facebook size={14} className="text-gray-400" />
                  </button>
                  <button onClick={() => handleShare('copy')} className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 transition-all font-bold text-xs uppercase tracking-widest">
                    <span>Copy Link</span>
                    <LinkIcon size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* More Like This */}
              {morePosts.length > 0 && (
                <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-3xl">
                   <div className="flex items-center gap-2 mb-6">
                    <Star size={16} className="text-purple-500" />
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">More like this</h4>
                  </div>
                  <div className="flex flex-col gap-6">
                    {morePosts.map(post => (
                      <Link key={post._id} to={`/${post.slug}`} className="group flex gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm">
                          <img src={post.coverImage || post.seoMeta?.ogImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="flex flex-col justify-center">
                          <h5 className="text-[13px] font-bold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 leading-snug">{post.title}</h5>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                            {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-black text-purple-600 uppercase tracking-widest mt-8 hover:gap-3 transition-all duration-300">
                    View all articles <ChevronRight size={12} />
                  </Link>
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

// Simple Component helper for the star icon
const Star = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default BlogPost;
