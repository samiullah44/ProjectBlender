import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Eye, EyeOff, Trash2, HandHeart, MessageCircle, ExternalLink } from 'lucide-react';
import { 
  useAdminComments, 
  useAllAdminComments,
  useDeleteComment, 
  useToggleCommentVisibility,
  useCommentRealtime
} from '@/hooks/useComments';
import toast from 'react-hot-toast';
import type { IComment } from '@/types/comment';

type SortOption = 'recent' | 'popular';

interface ExtendedComment extends IComment {
  blogId: any; // In global mode it's { _id, title, slug }, in per-slug it's string
}

export default function CommentsView() {
  const { slug } = useParams<{ slug: string }>();
  useCommentRealtime(slug);
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>('recent');
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isGlobal = !slug;

  // Hooks for per-slug mode
  const { data: slugData, isLoading: slugLoading, isError: slugError, refetch: slugRefetch } = useAdminComments(slug ?? '', sort, page);
  
  // Hook for global mode
  const { data: globalData, isLoading: globalLoading, isError: globalError, refetch: globalRefetch } = useAllAdminComments(sort, page);

  const isLoading = isGlobal ? globalLoading : slugLoading;
  const isError = isGlobal ? globalError : slugError;
  const refetch = isGlobal ? globalRefetch : slugRefetch;

  const comments = (isGlobal ? globalData?.comments : slugData?.comments) as ExtendedComment[] ?? [];
  const total = isGlobal ? globalData?.total : slugData?.total ?? 0;
  const blogTitle = isGlobal ? 'All Blog Comments' : (slugData?.blog?.title ?? slug);
  const totalPages = Math.ceil((total ?? 0) / 50);

  // We need to be careful with mutations since they currently expect a slug in the hook
  // I'll use a local mutation caller that finds the slug if needed
  const { mutate: deleteComment, isPending: isDeleting } = useDeleteComment(''); 
  const { mutate: toggleVisibility, isPending: isToggling } = useToggleCommentVisibility('');

  const handleDelete = (comment: ExtendedComment) => {
    const targetSlug = slug || (comment.blogId?.slug);
    if (!targetSlug) { toast.error('Could not determine blog slug'); return; }

    apiDelete(targetSlug, comment._id);
  };

  const apiDelete = async (s: string, id: string) => {
    try {
      // Use raw axios or update hook to be more flexible. 
      // For simplicity here, I'll use a direct fetch or update hook later.
      // Actually, useDeleteComment(slug) uses slug in the URL.
      // Let's just use the fetch API directly for simplicity in this mixed view or a dynamic hook.
      const res = await fetch(`/api/blogs/${s}/comments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setConfirmDeleteId(null);
        refetch();
        toast.success('Comment deleted');
      } else {
        toast.error('Failed to delete comment');
      }
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const handleToggle = async (comment: ExtendedComment) => {
    const targetSlug = slug || (comment.blogId?.slug);
    if (!targetSlug) { toast.error('Could not determine blog slug'); return; }

    try {
      const res = await fetch(`/api/blogs/${targetSlug}/comments/${comment._id}/visibility`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ hidden: !comment.hidden })
      });
      if (res.ok) {
        refetch();
        toast.success(comment.hidden ? 'Comment shown' : 'Comment hidden');
      } else {
        toast.error('Failed to update visibility');
      }
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">
            {isGlobal ? 'Global Comments' : 'Post Comments'}
          </h1>
          <p className="text-sm text-gray-400 truncate max-w-md">{blogTitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-400">
          <MessageCircle className="w-4 h-4" />
          {total} total
        </div>
      </div>

      {/* Sort + filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {(['recent', 'popular'] as SortOption[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSort(s); setPage(1); }}
              className={[
                'px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
                sort === s ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white',
              ].join(' ')}
            >
              {s === 'recent' ? 'Recent' : 'Popular'}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {isLoading && <div className="text-gray-400 text-center py-12">Loading comments…</div>}
      {isError && (
        <div className="text-red-400 text-center py-12">
          Failed to load comments.{' '}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {!isLoading && !isError && comments.length === 0 && (
        <div className="text-gray-400 text-center py-12">No comments yet.</div>
      )}

      {!isLoading && !isError && comments.length > 0 && (
        <>
          <div className="rounded-lg border border-gray-700 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Author</th>
                  <th className="px-4 py-3 text-left">Comment</th>
                  {isGlobal && <th className="px-4 py-3 text-left">Blog Post</th>}
                  <th className="px-4 py-3 text-center">
                    <HandHeart className="w-3.5 h-3.5 inline" />
                  </th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {comments.map((comment) => (
                  <tr
                    key={comment._id}
                    className={[
                      'transition-colors',
                      comment.hidden
                        ? 'bg-gray-800/40 opacity-60'
                        : 'bg-gray-900 hover:bg-gray-800',
                    ].join(' ')}
                  >
                    {/* Author */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {comment.authorId.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{comment.authorId.name}</div>
                          <div className="text-xs text-gray-500">@{comment.authorId.username}</div>
                        </div>
                      </div>
                    </td>

                    {/* Text */}
                    <td className="px-4 py-3 max-w-sm">
                      <p className="text-gray-300 text-sm line-clamp-2">{comment.text}</p>
                      {comment.editedAt && (
                        <span className="text-xs text-gray-500 italic">edited</span>
                      )}
                    </td>

                    {/* Blog Post (Global Only) */}
                    {isGlobal && (
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[150px] truncate">
                        <div className="flex items-center gap-1">
                          <span className="truncate">{comment.blogId?.title || 'Unknown'}</span>
                          <button 
                            onClick={() => window.open(`/blog/${comment.blogId?.slug}`, '_blank')}
                            className="p-1 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}

                    {/* Claps */}
                    <td className="px-4 py-3 text-center text-gray-400 tabular-nums">
                      {comment.claps}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {comment.hidden ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-600/30 text-gray-400 text-xs">
                          <EyeOff className="w-3 h-3" /> Hidden
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs">
                          <Eye className="w-3 h-3" /> Visible
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Hide / Show */}
                        <button
                          onClick={() => handleToggle(comment)}
                          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                          title={comment.hidden ? 'Show comment' : 'Hide comment'}
                        >
                          {comment.hidden
                            ? <><Eye className="w-3.5 h-3.5" /> Show</>
                            : <><EyeOff className="w-3.5 h-3.5" /> Hide</>
                          }
                        </button>

                        {/* Delete */}
                        {confirmDeleteId === comment._id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(comment)}
                              className="text-xs text-red-400 hover:text-red-300 font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-500 hover:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(comment._id)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50 hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50 hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
