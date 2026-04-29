import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronRight, ChevronLeft, Search, ArrowUpRight, Eye, Star, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import FavoriteButton from '../../components/blog/FavoriteButton';
import Footer from '@/components/layout/Footer';

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

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-white font-bold">R</div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-gray-900">RenderOnNodes</span>
              <span className="text-[10px] text-gray-500 font-bold tracking-[0.2em] uppercase">DISTRIBUTED RENDERING</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {showSearch ? (
              <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 bg-gray-50 w-52">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => !searchQuery && setShowSearch(false)}
                  placeholder="Search articles..."
                  className="bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400 w-full"
                />
              </div>
            ) : (
              <button onClick={() => setShowSearch(true)} className="text-gray-500 hover:text-gray-900 transition-colors">
                <Search className="w-5 h-5" />
              </button>
            )}
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

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-32">

        {/* Hero Section */}
        <div className="relative text-center mb-16">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-gradient-to-r from-purple-400/20 via-blue-400/10 to-transparent blur-[100px] pointer-events-none -z-10 rounded-full" />
          <span className="text-sm font-bold tracking-widest text-purple-600 uppercase mb-4 block">Engineering &amp; Ecosystem</span>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.1]">
            Blogs on distributed <br className="hidden md:block" />compute &amp; network scale
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Technical deep dives, architecture decisions, and community updates directly from the core contributors of RenderOnNodes.
          </p>
        </div>

        {/* Featured Section */}
        {featuredPosts.length > 0 && (
          <div className="mb-24 overflow-hidden -mx-6 px-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-purple-600 fill-purple-600" />
                <h3 className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">Featured</h3>
              </div>
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 bg-white shadow-sm">
                  <ChevronLeft className="w-4 h-4" />
                </div>
                <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-900 bg-white shadow-md">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
            
            <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar scroll-smooth">
              {(featuredPosts as any[]).map((post: any, i: number) => (
                <Link key={post._id} to={`/${post.slug}`} className="snap-center shrink-0">
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                    className="w-[300px] sm:w-[600px] h-[340px] bg-white rounded-[32px] border border-gray-100 shadow-[0_4px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.1)] transition-all duration-500 flex overflow-hidden group"
                  >
                    <div className="flex-1 p-8 sm:p-12 flex flex-col justify-between">
                      <div>
                        {post.category && (
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">{post.category}</span>
                          </div>
                        )}
                        <h4 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-[1.1] group-hover:text-purple-600 transition-colors line-clamp-3">
                          {post.title}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-6 text-xs text-gray-400 font-medium">
                         <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{post.readTime}</span>
                         <div className="ml-auto w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                           <ChevronRight className="w-4 h-4" />
                         </div>
                      </div>
                    </div>
                    
                    <div className="hidden sm:block flex-1 p-4">
                      <div className="w-full h-full rounded-[24px] overflow-hidden relative">
                        <img
                          src={post.coverImage || post.seoMeta?.ogImage || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80'}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 bg-gray-50"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Category Pill Row */}
        <div className="mb-12">
          <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-5">Browse by Category</h3>
          <div className="flex flex-wrap gap-3">
            {availableCategories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveTab(cat.name)}
                className={cn(
                  "relative h-28 w-36 rounded-2xl overflow-hidden group text-left shrink-0",
                  activeTab === cat.name ? "ring-2 ring-gray-900 ring-offset-2" : "hover:shadow-lg transition-all"
                )}
              >
                <div className="absolute inset-0 bg-gray-900/40 group-hover:bg-gray-900/20 transition-colors z-10" />
                <img src={cat.image} alt={cat.name} className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-0.5">
                  <span className="px-2.5 py-1 rounded-full bg-white text-gray-900 text-xs font-bold shadow-sm inline-block leading-none">{cat.name}</span>
                  {cat.name !== 'All' && categoryCounts[cat.name] > 0 && (
                    <span className="text-white/80 text-[10px] pl-1">{categoryCounts[cat.name]} articles</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main content + Sidebar */}
        <div className="flex gap-12">

          {/* LEFT: Post List */}
          <div className="flex-1 min-w-0">

            {/* Pinned / Featured */}
            {!isLoadingPinned && pinnedPost && activeTab === 'All' && !searchQuery && (
              <div className="mb-12 space-y-6">
                <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase">Featured Case Study</h3>
                <Link to={`/${pinnedPost.slug}`} className="grid md:grid-cols-2 gap-10 items-center bg-gray-50 rounded-3xl p-8 border border-gray-100 cursor-pointer group hover:border-gray-200 transition-colors block">
                  <div className="flex flex-col h-full justify-center">
                    <span className="text-sm font-bold text-gray-400 mb-3">{new Date(pinnedPost.publishedAt).toLocaleDateString()}</span>
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-4 leading-tight group-hover:text-purple-600 transition-colors">{pinnedPost.title}</h2>
                    <p className="text-gray-600 text-lg mb-6 leading-relaxed">{pinnedPost.seoMeta?.description || 'Read more about this groundbreaking update...'}</p>
                    <div className="mt-auto flex items-center justify-between text-sm text-gray-500 font-medium">
                      <span className="text-purple-600 bg-purple-50 px-3 py-1 rounded-full">{pinnedPost.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{pinnedPost.readTime}</span>
                      </div>
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
                <div className="border-b border-gray-100" />
              </div>
            )}

            {/* Sort Controls */}
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase">
                {searchQuery ? `Results for "${searchQuery}"` : activeTab === 'All' ? 'Recent Posts' : `${activeTab} Posts`}
              </h3>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {([['recent', 'Recent'], ['popular', 'Popular']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                      sortBy === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Post List */}
            <div className="space-y-10">
              {isLoading ? (
                <div className="space-y-10">
                  {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}
                </div>
              ) : filteredSortedPosts.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
                  <Filter className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No articles found.</p>
                </div>
              ) : filteredSortedPosts.map((post: any, i: number) => (
                <div key={post._id} className="relative">
                  <Link to={`/${post.slug}`}>
                    <motion.article
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className="group cursor-pointer grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-6 items-center pb-10 border-b border-gray-100"
                    >
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight group-hover:text-purple-600 transition-colors">
                          {post.title}
                        </h3>
                        <p className="text-gray-500 line-clamp-2 leading-relaxed mb-4 text-sm">
                          {post.seoMeta?.description || 'Click to explore the details of this article...'}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 font-medium flex-wrap">
                          <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.readTime}</span>
                          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {post.category}
                          </span>
                        </div>
                      </div>

                      <div className="w-full sm:w-[200px] h-[140px] rounded-xl overflow-hidden relative order-first sm:order-last shrink-0">
                        <img
                          src={post.coverImage || post.seoMeta?.ogImage || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop'}
                          alt={post.title}
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 bg-gray-100"
                        />
                      </div>
                    </motion.article>
                  </Link>
                  {/* Favorite button sits outside the Link to avoid navigation on click */}
                  <div className="absolute bottom-12 right-0">
                    <FavoriteButton slug={post.slug} initialCount={post.favoritesCount} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <aside className="hidden lg:flex flex-col gap-8 w-64 shrink-0">

            {/* Filter by Topics */}
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Filter by Topics</h4>
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
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Popular Now</h4>
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
