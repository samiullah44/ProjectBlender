import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronRight, ChevronLeft, Search, ArrowUpRight, Eye, Star, Filter, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import FavoriteButton from '../../components/blog/FavoriteButton';
import Footer from '@/components/layout/Footer';
import { useBlogRealtime } from '@/hooks/useBlogRealtime';
import { CryptoWidget } from '@/components/blog/CryptoWidget';
import NewsletterBox from '@/components/blog/NewsletterBox';
import SocialLinksBox from '@/components/blog/SocialLinksBox';
import ShareSidebar from '@/components/blog/ShareSidebar';

const ALL_CATEGORIES = [
  { name: 'All', color: 'from-purple-500 to-indigo-600', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' },
  { name: 'Tutorials', color: 'from-blue-500 to-cyan-600', image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80' },
  { name: 'Updates', color: 'from-green-500 to-emerald-600', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80' },
  { name: 'Architecture', color: 'from-orange-500 to-rose-600', image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80' },
  { name: 'Deep Dive', color: 'from-pink-500 to-purple-600', image: 'https://images.unsplash.com/photo-1624953901718-b674a65b4a5a?w=800&q=80' },
  { name: 'Community', color: 'from-yellow-500 to-amber-600', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80' },
];

export const BlogHome = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Auto-refresh when a blog is published/unpublished
  useBlogRealtime();

  const { data: allPosts = [], isLoading } = useQuery({
    queryKey: ['publicBlogs', activeTab],
    queryFn: async () => {
      const res = await api.get(`/blogs?category=${activeTab}&pinned=false&limit=50`);
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

  const { data: featuredPosts = [] } = useQuery({
    queryKey: ['featuredBlogs'],
    queryFn: async () => {
      const res = await api.get(`/blogs?featured=true&limit=6`);
      return res.data.blogs;
    }
  });

  const pinnedPost = pinnedPosts[0];

  // Compute category counts from allPosts (across all categories, not filtered)
  const { data: allPostsForCounts = [] } = useQuery({
    queryKey: ['allBlogsForCounts'],
    queryFn: async () => {
      const res = await api.get(`/blogs?limit=100`);
      return res.data.blogs;
    }
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (allPostsForCounts as any[]).forEach((p: any) => {
      const cat = p.category || 'Uncategorized';
      counts[cat] = (counts[cat] ?? 0) + 1;
    });
    return counts;
  }, [allPostsForCounts]);

  // Sort and filter posts
  const filteredSortedPosts = useMemo(() => {
    let posts = [...allPosts] as any[];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      posts = posts.filter((p: any) =>
        p.title?.toLowerCase().includes(q) || p.seoMeta?.description?.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'popular') posts.sort((a, b) => (b.favoritesCount ?? 0) - (a.favoritesCount ?? 0));
    else posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return posts;
  }, [allPosts, searchQuery, sortBy]);

  const availableCategories = ALL_CATEGORIES.slice(0, 4);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-purple-200 selection:text-purple-900">

      {/* Navbar - Ultra-slim and refined */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <img
              src="/assets/images/logo_blog.png"
              alt="RenderOnNodes"
              className="h-10 w-auto object-contain"
            />
          </Link>

          {/* Central space empty as requested */}
          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-4">
            <a
              href="https://www.renderonnodes.com"
              className="bg-gray-900 text-white px-5 py-2 rounded-xl font-bold text-[12px] tracking-wide uppercase transition-all hover:bg-black hover:shadow-lg hover:shadow-gray-200 active:scale-95"
            >
              Main App
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-10 pb-10">

        <div className="grid lg:grid-cols-2 gap-0 lg:gap-12 items-center mt-[-50px] pt-0 pb-0 relative min-h-[400px]">
          <div className="relative z-[60] text-left py-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-[2px] bg-[#7C3AED]" />
                <span className="text-[11px] font-black tracking-[0.4em] text-[#7C3AED] uppercase">
                  Engineering &amp; Ecosystem
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[58px] font-black tracking-[-0.04em] text-gray-900 mb-6 leading-tight sm:leading-[1.05]">
                <span className="block whitespace-nowrap">Distributed Compute</span>
                <span className="block text-transparent bg-clip-text bg-linear-to-r from-[#7C3AED] to-[#4F46E5] pb-2 sm:pb-4 whitespace-nowrap">
                  Intelligence Hub
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-500 max-w-xl leading-relaxed font-medium mb-10">
                Real-time insights, architecture breakdowns, and ecosystem updates from the RenderOnNodes network.
              </p>

              {/* Action Buttons
              <div className="flex flex-wrap items-center gap-4 mb-14">
                <button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_8px_20px_rgba(124,58,237,0.3)] hover:-translate-y-0.5 whitespace-nowrap">
                  Explore Architecture
                </button>
                <button className="bg-white border border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50 px-8 py-3.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap">
                  View Live Network
                </button>
              </div> */}


            </motion.div>
          </div>

          <div className="relative z-[1] h-[400px] lg:h-[600px] flex items-center justify-center lg:justify-end pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full h-full lg:-mr-24"
            >
              <img
                src="/assets/images/blog-hero-graphic.png"
                alt="Distributed Compute Network"
                className="w-full h-full object-contain scale-100 lg:scale-[1.2] transform transition-transform duration-1000 origin-center lg:origin-right"
              />
            </motion.div>
          </div>
        </div>

        {/* Crypto Market Snapshot Widget */}
        <CryptoWidget />

        {/* Featured Content Section - New Layout matching image */}
        {featuredPosts.length > 0 && (
          <div className="mb-24">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center shadow-sm">
                <Star className="w-4 h-4 text-[#7C3AED] fill-[#7C3AED]" />
              </div>
              <h3 className="text-[12px] font-black tracking-[0.3em] text-[#7C3AED] uppercase">FEATURED ARTICLE</h3>
            </div>

            <div className="flex flex-col lg:flex-row gap-10">
              {/* Left Column: Featured Card + Share Sidebar */}
              <div className="flex-1 flex flex-col md:flex-row gap-8 lg:gap-12 min-w-0">
                {/* Main Featured Card */}
                <div className="flex-1 min-w-0">
                  {featuredPosts[0] && (
                    <Link to={`/${featuredPosts[0].slug}`} className="group block">
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="bg-white rounded-[40px] border border-gray-200/60 shadow-[0_12px_60px_rgba(0,0,0,0.02)] hover:shadow-[0_40px_100px_rgba(0,0,0,0.06)] hover:-translate-y-2 transition-all duration-700 overflow-hidden flex flex-col"
                      >
                        <div className="aspect-[21/10] overflow-hidden relative">
                          <img
                            src={featuredPosts[0].coverImage || featuredPosts[0].seoMeta?.ogImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80'}
                            alt={featuredPosts[0].title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                          />
                          <div className="absolute top-6 left-6 flex items-center gap-2">
                            <span className="px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-sm text-[10px] font-black text-purple-600 uppercase tracking-widest">
                              {featuredPosts[0].category || 'ENGINEERING'}
                            </span>
                          </div>
                        </div>

                        <div className="p-10 flex flex-col">
                          <h4 className="text-3xl lg:text-[40px] font-bold text-gray-900 leading-[1.1] group-hover:text-purple-600 transition-colors mb-6 line-clamp-2">
                            {featuredPosts[0].title}
                          </h4>

                          <p className="text-gray-500 text-base leading-relaxed mb-10 line-clamp-2 max-w-2xl font-medium">
                            {featuredPosts[0].seoMeta?.description || featuredPosts[0].excerpt || 'Discover the latest developments in decentralized GPU rendering and how they are shaping the future of 3D art.'}
                          </p>

                          <div className="mt-auto flex items-center justify-between pt-8 border-t border-gray-50">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden ring-2 ring-gray-50">
                                <img src={`https://ui-avatars.com/api/?name=${featuredPosts[0].authorName || featuredPosts[0].author?.name || 'Admin'}&background=random`} alt="Author" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[13px] font-bold text-gray-900 leading-tight">{featuredPosts[0].authorName || featuredPosts[0].author?.name || 'Akash Kumar'}</span>
                                <span className="text-[11px] font-bold text-gray-400">Lead Engineer</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                              <span>{new Date(featuredPosts[0].publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{featuredPosts[0].readTime || '8 MIN READ'}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  )}
                </div>

                {/* Share Sidebar Integration */}
                <ShareSidebar url={featuredPosts[0] ? `${window.location.origin}/${featuredPosts[0].slug}` : window.location.href} />
              </div>

              {/* Right Column: Newsletter + Social */}
              <aside className="w-full lg:w-[380px] flex flex-col gap-8 shrink-0">
                <NewsletterBox />
                <SocialLinksBox />
              </aside>
            </div>
          </div>
        )}


        {/* Category Browsing Row - High Fidelity Pills */}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[12px] font-black tracking-[0.3em] text-[#7C3AED] uppercase">Browse by Category</h3>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white w-56 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-300 transition-all shadow-sm">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="bg-transparent text-[13px] outline-none text-gray-700 placeholder-gray-400 w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {availableCategories.map((cat, i) => (
              <button
                key={cat.name}
                onClick={() => setActiveTab(cat.name)}
                className={cn(
                  "px-8 py-4 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-95 border-2",
                  activeTab === cat.name
                    ? "bg-[#7C3AED] border-[#7C3AED] text-white shadow-[0_12px_24px_rgba(124,58,237,0.3)]"
                    : "bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:text-gray-900 shadow-sm"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main content + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-16">

          {/* LEFT: Post List */}
          <div className="flex-1 min-w-0">
            {/* Sort Controls + View Toggle */}
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-gray-100">
              <h3 className="text-[12px] font-black tracking-[0.3em] text-gray-400 uppercase">
                {searchQuery ? `Results for "${searchQuery}"` : activeTab === 'All' ? 'Latest Insights' : `${activeTab} Feed`}
              </h3>
              <div className="flex items-center gap-2">
                {/* Sort toggle */}
                <div className="flex items-center gap-1 bg-gray-100/50 rounded-xl p-1">
                  {([['recent', 'RECENT'], ['popular', 'POPULAR']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setSortBy(val)}
                      className={cn(
                        "text-[10px] px-4 py-2 rounded-lg font-black tracking-widest transition-all",
                        sortBy === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* View mode toggle */}
                <div className="flex items-center gap-1 bg-gray-100/50 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'grid' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="List view"
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Post Grid / List — animated layout switch */}
            {isLoading ? (
              <div className={cn(
                viewMode === 'grid'
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-6"
                  : "space-y-12"
              )}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-40 bg-gray-50 animate-pulse rounded-[32px]" />
                ))}
              </div>
            ) : filteredSortedPosts.length === 0 ? (
              <div className="text-center py-24 bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
                <Filter className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400 font-bold tracking-tight">No articles found in this category.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {viewMode === 'grid' ? (
                  /* ── GRID VIEW ── */
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                  >
                    {filteredSortedPosts.map((post: any, i: number) => (
                      <motion.div
                        key={post._id}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04, duration: 0.22, ease: 'easeOut' }}
                        className="relative group/card"
                      >
                        <Link to={`/${post.slug}`}>
                          <article className="group bg-white rounded-[28px] border border-gray-100 hover:border-gray-200 hover:shadow-[0_20px_60px_rgba(0,0,0,0.07)] transition-all duration-500 overflow-hidden flex flex-col h-full">
                            {/* Cover image */}
                            <div className="w-full h-[180px] overflow-hidden relative shrink-0">
                              <img
                                src={post.coverImage || post.seoMeta?.ogImage || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80'}
                                alt={post.title}
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 bg-gray-100"
                              />
                              <div className="absolute top-3 left-3">
                                <span className="text-[10px] font-black text-[#7C3AED] uppercase tracking-widest bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
                                  {post.category}
                                </span>
                              </div>
                            </div>
                            {/* Content */}
                            <div className="p-5 flex flex-col flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-gray-200" />
                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  <Clock className="w-3 h-3" />{post.readTime}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug group-hover:text-purple-600 transition-colors line-clamp-2">
                                {post.title}
                              </h3>
                              <p className="text-gray-500 line-clamp-2 text-sm leading-relaxed font-medium flex-1">
                                {post.seoMeta?.description || 'Explore the technical details and innovative approaches behind this update...'}
                              </p>
                            </div>
                          </article>
                        </Link>
                        <div className="absolute top-[188px] right-4">
                          <FavoriteButton slug={post.slug} initialCount={post.favoritesCount} />
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  /* ── LIST VIEW ── */
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="space-y-12"
                  >
                    {filteredSortedPosts.map((post: any, i: number) => (
                      <motion.div
                        key={post._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.22, ease: 'easeOut' }}
                        className="relative group/card bg-white rounded-[40px] border border-gray-50 hover:bg-gray-50/50 transition-all p-2 pr-6"
                      >
                        <Link to={`/${post.slug}`}>
                          <article className="group cursor-pointer grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-8 items-center">
                            <div className="pl-6 py-6">
                              <div className="flex items-center gap-3 mb-4">
                                <span className="text-[10px] font-black text-[#7C3AED] uppercase tracking-widest bg-purple-50 px-2.5 py-0.5 rounded-full">{post.category}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-200" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                              <h3 className="text-2xl font-bold text-gray-900 mb-4 leading-tight group-hover:text-purple-600 transition-colors">
                                {post.title}
                              </h3>
                              <p className="text-gray-500 line-clamp-2 leading-relaxed mb-6 text-sm font-medium">
                                {post.seoMeta?.description || 'Explore the technical details and innovative approaches behind this update...'}
                              </p>
                              <div className="flex items-center gap-6 text-[10px] text-gray-400 font-extrabold tracking-widest">
                                <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{post.readTime}</span>
                                <span className="flex items-center gap-2"><Eye className="w-4 h-4" /> 1.2K VIEWS</span>
                              </div>
                            </div>
                            <div className="w-full sm:w-[280px] h-[200px] rounded-[32px] overflow-hidden relative order-first sm:order-last shrink-0 shadow-sm group-hover:shadow-xl transition-all duration-700">
                              <img
                                src={post.coverImage || post.seoMeta?.ogImage || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80'}
                                alt={post.title}
                                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000 bg-gray-100"
                              />
                            </div>
                          </article>
                        </Link>
                        <div className="absolute top-8 right-8">
                          <FavoriteButton slug={post.slug} initialCount={post.favoritesCount} />
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <aside className="hidden lg:flex flex-col gap-8 w-64 shrink-0">

            {/* Filter by Topics */}
            <div>
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-[0.1em] mb-4">Filter by Topics</h4>
              <div className="flex flex-col divide-y divide-gray-100">
                {Object.entries(categoryCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count], i) => {
                    const colorClass = ALL_CATEGORIES.find(c => c.name === cat)?.color ?? 'from-gray-400 to-gray-600';
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={cn(
                          "flex items-center justify-between py-3 group text-left transition-colors",
                          activeTab === cat ? "text-purple-700" : "text-gray-700 hover:text-purple-600"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full bg-gradient-to-br shrink-0", colorClass)} />
                          <span className="text-xs font-bold uppercase tracking-wider">{cat}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="text-xs font-medium">{count}</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Popular Now */}
            {featuredPosts.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-[0.1em] mb-4">Popular Now</h4>
                <div className="flex flex-col gap-4">
                  {(featuredPosts as any[]).map((post: any, i: number) => (
                    <Link key={post._id} to={`/${post.slug}`} className="group">
                      <div className="flex gap-3 items-start">
                        <span className="text-2xl font-black text-gray-100 leading-none shrink-0 w-6">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-purple-600 transition-colors leading-snug line-clamp-2">{post.title}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Put standard Footer from layout here */}
      <Footer />
    </div>
  );
};

export default BlogHome;
