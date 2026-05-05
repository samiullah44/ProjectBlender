import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Eye, MessageCircle, Flag } from 'lucide-react';
import StatusBadge from './StatusBadge';
import TemplateSelectModal from './TemplateSelectModal';
import { websocketService } from '@/services/websocketService';

type BlogStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';

interface BlogAuthor {
  _id: string;
  name: string;
  username: string;
}

interface Blog {
  _id: string;
  title: string;
  slug: string;
  status: BlogStatus;
  category: string;
  authorId: BlogAuthor | string;
  updatedAt: string;
  viewsCount: number;
  commentsCount: number;
}

interface BlogsResponse {
  success: boolean;
  blogs: Blog[];
  total: number;
  page: number;
}

// Map of blogId → report count
type ReportCounts = Record<string, number>;

type FilterTab = 'ALL' | BlogStatus;

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Published', value: 'PUBLISHED' },
];

function getAuthorName(authorId: BlogAuthor | string): string {
  if (typeof authorId === 'object' && authorId !== null) {
    const name = authorId.name || authorId.username;
    if (!name || name === 'Akash Kumar') return 'Admin User';
    return name;
  }
  return 'Admin User';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function fetchBlogs(status: FilterTab, search: string): Promise<BlogsResponse> {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (status !== 'ALL') params.set('status', status);
  if (search.trim()) params.set('search', search.trim());

  const res = await fetch(`/api/cms/blogs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

async function deleteBlog(id: string): Promise<void> {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/cms/blogs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete post');
}

// Fetch all pending reports and group by targetId
async function fetchReportCounts(): Promise<ReportCounts> {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/reports?status=pending&limit=200', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return {};
  const data = await res.json();
  const counts: ReportCounts = {};
  for (const report of data.reports ?? []) {
    if (report.targetType === 'blog') {
      counts[report.targetId] = (counts[report.targetId] ?? 0) + 1;
    }
  }
  return counts;
}

const PostListView = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [search, setSearch] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cms-blogs', activeTab, search],
    queryFn: () => fetchBlogs(activeTab, search),
    // Refetch every 30s as a fallback
    refetchInterval: 30_000,
  });

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const isWriter = user?.roles?.includes('writer');
  const canManageAll = isAdmin || isWriter;

  // Only managers see report counts
  const { data: reportCounts = {} } = useQuery<ReportCounts>({
    queryKey: ['cms-report-counts'],
    queryFn: fetchReportCounts,
    enabled: canManageAll,
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  // Live updates via WebSocket — invalidate on any blog/comment/report change
  useEffect(() => {
    const unsubscribe = websocketService.subscribeToSystem((data: any) => {
      if (
        data.type === 'blog_status_changed' ||
        data.type === 'comment_added' ||
        data.type === 'comment_deleted' ||
        data.type === 'blog_favorited' ||
        data.type === 'report_submitted'
      ) {
        queryClient.invalidateQueries({ queryKey: ['cms-blogs'] });
        queryClient.invalidateQueries({ queryKey: ['cms-report-counts'] });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: deleteBlog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-blogs'] });
    },
  });

  const handleDelete = (blog: Blog) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this blog post? This action cannot be undone.'
    );
    if (confirmed) {
      deleteMutation.mutate(blog._id);
    }
  };

  const blogs = data?.blogs ?? [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Content Studio</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('comments')}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Manage Comments
          </button>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Create New Post
          </button>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 sm:w-64"
        />
      </div>

      {/* States */}
      {isLoading && (
        <div className="text-gray-400 text-center py-12">Loading posts...</div>
      )}
      {isError && (
        <div className="text-red-400 text-center py-12">Failed to load posts. Please try again.</div>
      )}
      {!isLoading && !isError && blogs.length === 0 && (
        <div className="text-gray-400 text-center py-12">
          No posts found. Create your first post to get started.
        </div>
      )}

      {!isLoading && !isError && blogs.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  {canManageAll && <th className="px-4 py-3 text-left">Author</th>}
                  <th className="px-4 py-3 text-left">Last Updated</th>
                  <th className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Views
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> Comments
                    </span>
                  </th>
                  {canManageAll && (
                    <th className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Flag className="w-3.5 h-3.5" /> Reports
                      </span>
                    </th>
                  )}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {blogs.map((blog) => {
                  const pendingReports = reportCounts[blog._id] ?? 0;
                  return (
                    <tr key={blog._id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 font-medium text-white max-w-xs truncate">
                        {blog.title}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={blog.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-300">{blog.category || '—'}</td>
                      {canManageAll && (
                        <td className="px-4 py-3 text-gray-300">{getAuthorName(blog.authorId)}</td>
                      )}
                      <td className="px-4 py-3 text-gray-400">{formatDate(blog.updatedAt)}</td>

                      {/* Views */}
                      <td className="px-4 py-3 text-center text-gray-300 tabular-nums">
                        {(blog.viewsCount ?? 0).toLocaleString()}
                      </td>

                      {/* Comments */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-300 tabular-nums">
                            {blog.commentsCount ?? 0}
                          </span>
                          <button
                            onClick={() => navigate(`${blog.slug}/comments`)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors mt-0.5"
                          >
                            Manage
                          </button>
                        </div>
                      </td>

                      {/* Reports (admin/writer) */}
                      {canManageAll && (
                        <td className="px-4 py-3 text-center">
                          {pendingReports > 0 ? (
                            <button
                              onClick={() => navigate('/admin/reports')}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors"
                              title="View pending reports"
                            >
                              <Flag className="w-3 h-3" />
                              {pendingReports}
                            </button>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`${blog._id}/edit`)}
                            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(blog)}
                            disabled={deleteMutation.isPending}
                            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack */}
          <div className="md:hidden space-y-3">
            {blogs.map((blog) => {
              const pendingReports = reportCounts[blog._id] ?? 0;
              return (
                <div
                  key={blog._id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-white text-sm leading-snug">{blog.title}</h3>
                    <StatusBadge status={blog.status} />
                  </div>
                  <div className="text-xs text-gray-400 space-y-1 mb-3">
                    {blog.category && <div>Category: {blog.category}</div>}
                    {canManageAll && <div>Author: {getAuthorName(blog.authorId)}</div>}
                    <div>Updated: {formatDate(blog.updatedAt)}</div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {(blog.viewsCount ?? 0).toLocaleString()} views
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> {blog.commentsCount ?? 0} comments
                      </span>
                      {canManageAll && pendingReports > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <Flag className="w-3 h-3" /> {pendingReports} reports
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate(`${blog._id}/edit`)}
                      className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(blog)}
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showTemplateModal && (
        <TemplateSelectModal onClose={() => setShowTemplateModal(false)} />
      )}
    </div>
  );
};

export default PostListView;
