import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import StatusBadge from './StatusBadge';
import TemplateSelectModal from './TemplateSelectModal';

type BlogStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';

interface BlogAuthor {
  _id: string;
  name: string;
  username: string;
}

interface Blog {
  _id: string;
  title: string;
  status: BlogStatus;
  category: string;
  authorId: BlogAuthor | string;
  updatedAt: string;
}

interface BlogsResponse {
  success: boolean;
  blogs: Blog[];
  total: number;
  page: number;
}

type FilterTab = 'ALL' | BlogStatus;

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Published', value: 'PUBLISHED' },
];

function getAuthorName(authorId: BlogAuthor | string): string {
  if (typeof authorId === 'object' && authorId !== null) {
    return authorId.name || authorId.username || 'Unknown';
  }
  return 'Unknown';
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
  });

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

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  const blogs = data?.blogs ?? [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Content Studio</h1>
        <button
          onClick={() => setShowTemplateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Create New Post
        </button>
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

      {/* Content */}
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
                  {isAdmin && <th className="px-4 py-3 text-left">Author</th>}
                  <th className="px-4 py-3 text-left">Last Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {blogs.map((blog) => (
                  <tr key={blog._id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 font-medium text-white max-w-xs truncate">
                      {blog.title}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={blog.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-300">{blog.category || '—'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-300">{getAuthorName(blog.authorId)}</td>
                    )}
                    <td className="px-4 py-3 text-gray-400">{formatDate(blog.updatedAt)}</td>
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack */}
          <div className="md:hidden space-y-3">
            {blogs.map((blog) => (
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
                  {isAdmin && <div>Author: {getAuthorName(blog.authorId)}</div>}
                  <div>Updated: {formatDate(blog.updatedAt)}</div>
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
            ))}
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
