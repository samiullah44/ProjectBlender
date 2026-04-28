import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Bookmark, ChevronRight, Search, ArrowUpRight, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';

const VISUAL_CATEGORIES = [
  { name: 'All', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' },
  { name: 'Tutorials', image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80' },
  { name: 'Updates', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80' },
  { name: 'Architecture', image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80' },
];

export const BlogHome = () => {
  const [activeTab, setActiveTab] = useState('All');
  const { user } = useAuthStore();
  const localFavorites = React.useMemo(
    () => JSON.parse(localStorage.getItem('blogFavorites') || '[]') as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { data: mainPosts = [], isLoading } = useQuery({
    queryKey: ['publicBlogs', activeTab],
    queryFn: async () => {
      const res = await api.get(`/blogs?category=${activeTab}&pinned=false`);
      return res.data.blogs;
    }
  });

  const { data: pinnedPosts = [], isLoading: isLoadingPinned } = useQuery({
    queryKey: ['pinnedBlogs'],
    queryFn: async () => {
      const res = await api.get(`/blogs?pinned=true&limit=1`);
      return res.data.blogs;
    }
  });

  const pinnedPost = pinnedPosts[0];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-purple-200 selection:text-purple-900">

      {/* Navbar (Light Mode) */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-white font-bold">
              R
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-gray-900">
                RenderOnNodes
              </span>
              <span className="text-[10px] text-gray-500 font-bold tracking-[0.2em] uppercase">
                DISTRIBUTED RENDERING
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <button className="text-gray-500 hover:text-gray-900 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <a
              href="https://www.renderonnodes.com/"
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-all group shadow-md hover:shadow-xl"
            >
              Main Application
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors" />
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pt-24 pb-32">

        {/* Centered Hero Section */}
        <div className="relative text-center mb-24">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-linear-to-r from-purple-400/20 via-blue-400/10 to-transparent blur-[100px] pointer-events-none -z-10 rounded-full" />

          <span className="text-sm font-bold tracking-widest text-purple-600 uppercase mb-4 block">
            Engineering & Ecosystem
          </span>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.1]">
            Blogs on distributed <br className="hidden md:block" />
            compute & network scale
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Technical deep dives, architecture decisions, and community updates directly from the core contributors of RenderOnNodes.
          </p>
        </div>

        {/* Read by Category Visual Row */}
        <div className="mb-20">
          <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-6">
            Read by Category
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {VISUAL_CATEGORIES.map((cat, i) => (
              <motion.button
                key={cat.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setActiveTab(cat.name)}
                className={cn(
                  "relative h-32 rounded-2xl overflow-hidden group text-left",
                  activeTab === cat.name ? "ring-2 ring-gray-900 ring-offset-2" : "hover:shadow-lg transition-all"
                )}
              >
                <div className="absolute inset-0 bg-gray-900/40 group-hover:bg-gray-900/20 transition-colors z-10" />
                <img src={cat.image} alt={cat.name} className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute bottom-4 left-4 z-20">
                  <span className="px-3 py-1.5 rounded-full bg-white text-gray-900 text-xs font-bold shadow-sm inline-block">
                    {cat.name}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Featured / Pinned Post Section (If Active) */}
        {isLoadingPinned ? (
          <div className="h-[400px] bg-gray-100 animate-pulse rounded-3xl mb-20" />
        ) : pinnedPost && activeTab === 'All' && (
          <div className="mb-20 space-y-6">
            <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase">
              Featured Case Study
            </h3>
            <Link to={`/${pinnedPost.slug}`} className="grid md:grid-cols-2 gap-10 items-center bg-gray-50 rounded-3xl p-8 border border-gray-100 cursor-pointer group hover:border-gray-200 transition-colors">
              <div className="flex flex-col h-full justify-center">
                <span className="text-sm font-bold text-gray-400 mb-3">{new Date(pinnedPost.publishedAt).toLocaleDateString()}</span>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-4 leading-tight group-hover:text-purple-600 transition-colors">
                  {pinnedPost.title}
                </h2>
                <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                  {pinnedPost.seoMeta?.description || 'Read more about this groundbreaking update...'}
                </p>
                <div className="mt-auto flex items-center justify-between text-sm text-gray-500 font-medium">
                  <span className="text-purple-600 bg-purple-50 px-3 py-1 rounded-full">{pinnedPost.category}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {pinnedPost.readTime}</span>
                </div>
              </div>
              <div className="h-[300px] rounded-2xl overflow-hidden relative shadow-sm">
                <img
                  src={pinnedPost.coverImage || pinnedPost.seoMeta?.ogImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'}
                  alt={pinnedPost.title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </Link>
            <div className="border-b border-gray-100 py-4" />
          </div>
        )}

        {/* Medium-style Recent Posts */}
        <div>
          <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-8">
            {activeTab === 'All' ? 'Recent Posts' : `${activeTab} Posts`}
          </h3>

          <div className="space-y-12 max-w-4xl">
            {isLoading ? (
              <div className="space-y-12">
                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}
              </div>
            ) : mainPosts.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-gray-500 font-medium">No published articles yet in this section.</p>
              </div>
            ) : mainPosts.map((post: any, i: number) => (
              <Link key={post._id} to={`/${post.slug}`}>
              <motion.article
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group cursor-pointer grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-8 items-center"
              >
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 leading-tight group-hover:text-purple-600 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-gray-500 line-clamp-2 leading-relaxed mb-4 text-sm sm:text-base">
                    {post.seoMeta?.description || 'Click to explore the details of this article...'}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-400 font-medium">
                    <div className="flex items-center gap-4">
                      <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {post.readTime}</span>
                      <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
                        {post.category}
                      </span>
                      {post.favoritesCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Heart
                            size={14}
                            className={cn(
                              localFavorites.includes(post.slug) ? 'fill-red-500 text-red-500' : 'text-gray-400'
                            )}
                          />
                          <span className="text-xs">{post.favoritesCount}</span>
                        </span>
                      )}
                    </div>
                    <button className="hover:text-gray-900 transition-colors p-2 -mr-2">
                      <Bookmark className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="w-full sm:w-[220px] h-[200px] sm:h-[140px] rounded-xl overflow-hidden relative order-first sm:order-last">
                  <img
                    src={post.coverImage || post.seoMeta?.ogImage || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop'}
                    alt={post.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 bg-gray-100"
                  />
                </div>
              </motion.article>
              </Link>
            ))}
          </div>
        </div>

        {/* Load More */}
        {mainPosts.length > 0 && (
          <div className="mt-16 flex justify-center">
            <button className="px-6 py-3 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-900 font-semibold transition-all border border-gray-200 flex items-center gap-2 group">
              View More Stories
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

      </main>
    </div>
  );
};

export default BlogHome;
