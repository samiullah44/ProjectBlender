import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/axios';
import type { IComment } from '../types/comment';

export const useComments = (slug: string) =>
  useQuery({
    queryKey: ['comments', slug],
    queryFn: () => api.get(`/blogs/${slug}/comments`).then(r => r.data.comments as IComment[]),
    enabled: !!slug,
  });

export const usePostComment = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) =>
      api.post(`/blogs/${slug}/comments`, { text }).then(r => r.data.comment as IComment),
    onSuccess: (newComment) => {
      // Prepend new comment to the comments cache
      queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) => [newComment, ...old]);

      // Increment commentsCount in the blogPost cache
      // Cache shape: { success: boolean, blog: BlogPostData }
      queryClient.setQueryData<{ success: boolean; blog: { commentsCount: number; [key: string]: any } }>(
        ['blogPost', slug],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            blog: {
              ...old.blog,
              commentsCount: (old.blog.commentsCount ?? 0) + 1,
            },
          };
        }
      );
    },
  });
};

export const useDeleteComment = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/blogs/${slug}/comments/${commentId}`),
    onSuccess: (_, commentId) => {
      // Remove the deleted comment from the comments cache
      queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) =>
        old.filter(c => c._id !== commentId)
      );

      // Decrement commentsCount in the blogPost cache (floor 0)
      // Cache shape: { success: boolean, blog: BlogPostData }
      queryClient.setQueryData<{ success: boolean; blog: { commentsCount: number; [key: string]: any } }>(
        ['blogPost', slug],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            blog: {
              ...old.blog,
              commentsCount: Math.max(0, (old.blog.commentsCount ?? 1) - 1),
            },
          };
        }
      );
    },
  });
};

export const useClapComment = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId }: { commentId: string }) =>
      api.post(`/blogs/${slug}/comments/${commentId}/clap`),
    onMutate: async ({ commentId }) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['comments', slug] });

      // Snapshot the current cache value for rollback on error
      const previous = queryClient.getQueryData<IComment[]>(['comments', slug]);

      // Optimistically increment claps on the target comment
      queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) =>
        old.map(c => c._id === commentId ? { ...c, claps: c.claps + 1 } : c)
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the snapshot saved in onMutate
      if (context?.previous) {
        queryClient.setQueryData<IComment[]>(['comments', slug], context.previous);
      }
    },
  });
};

export const useUnClapComment = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId }: { commentId: string }) =>
      api.delete(`/blogs/${slug}/comments/${commentId}/clap`),
    onMutate: async ({ commentId }) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['comments', slug] });

      // Snapshot the current cache value for rollback on error
      const previous = queryClient.getQueryData<IComment[]>(['comments', slug]);

      // Optimistically decrement claps on the target comment (floor 0)
      queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) =>
        old.map(c => c._id === commentId ? { ...c, claps: Math.max(0, c.claps - 1) } : c)
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the snapshot saved in onMutate
      if (context?.previous) {
        queryClient.setQueryData<IComment[]>(['comments', slug], context.previous);
      }
    },
  });
};

/** Edit a comment (author only, within 20-min window) */
export const useEditComment = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) =>
      api.patch(`/blogs/${slug}/comments/${commentId}`, { text }).then(r => r.data.comment as IComment),
    onSuccess: (updated) => {
      queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) =>
        old.map(c => c._id === updated._id ? updated : c)
      );
    },
  });
};

/** Admin: toggle comment visibility */
export const useToggleCommentVisibility = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, hidden }: { commentId: string; hidden: boolean }) =>
      api.patch(`/blogs/${slug}/comments/${commentId}/visibility`, { hidden }).then(r => r.data.comment as IComment),
    onSuccess: (updated) => {
      // Update in public comments cache
      queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) =>
        old.map(c => c._id === updated._id ? updated : c)
      );
      // Also update in admin comments cache if present
      queryClient.invalidateQueries({ queryKey: ['admin-comments', slug] });
    },
  });
};

/** Fetch comments with sort (recent | popular) */
export const useCommentsSorted = (slug: string, sort: 'recent' | 'popular') =>
  useQuery({
    queryKey: ['comments', slug, sort],
    queryFn: () =>
      api.get(`/blogs/${slug}/comments`, { params: { sort } }).then(r => r.data.comments as IComment[]),
    enabled: !!slug,
  });

/** Admin: fetch all comments for a blog (includes hidden) */
export const useAdminComments = (slug: string, sort: 'recent' | 'popular' = 'recent', page = 1) =>
  useQuery({
    queryKey: ['admin-comments', slug, sort, page],
    queryFn: () =>
      api.get(`/blogs/${slug}/comments/admin`, { params: { sort, page, limit: 50 } })
        .then(r => r.data as { comments: IComment[]; total: number; blog: { title: string; slug: string } }),
    enabled: !!slug,
  });

/** Admin: fetch all comments across all blogs */
export const useAllAdminComments = (sort: 'recent' | 'popular' = 'recent', page = 1) =>
  useQuery({
    queryKey: ['admin-comments-all', sort, page],
    queryFn: () =>
      api.get('/blogs/admin/all', { params: { sort, page, limit: 50 } })
        .then(r => r.data as { comments: (IComment & { blogId: { title: string; slug: string } })[]; total: number }),
  });

/**
 * Hook to enable real-time updates for comments via WebSockets
 */
export const useCommentRealtime = (slug?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleUpdate = (event: any) => {
      const { type, slug: eventSlug } = event.detail;
      
      // If slug is provided, only invalidate for that slug
      if (slug && slug !== eventSlug) return;

      console.log('🔄 Invalidating comment queries for:', eventSlug || 'all');
      
      // Invalidate both public and admin views
      if (eventSlug) {
        queryClient.invalidateQueries({ queryKey: ['comments', eventSlug] });
        queryClient.invalidateQueries({ queryKey: ['admin-comments', eventSlug] });
      } else {
        // Fallback for global updates
        queryClient.invalidateQueries({ queryKey: ['comments'] });
        queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      }
      
      queryClient.invalidateQueries({ queryKey: ['admin-comments-all'] });
      
      // Also update the blog count if it was an add/delete
      if (type === 'comment_added' || type === 'comment_deleted') {
        queryClient.invalidateQueries({ queryKey: ['blogPost', eventSlug || slug] });
      }
    };

    window.addEventListener('comment_update', handleUpdate);
    return () => window.removeEventListener('comment_update', handleUpdate);
  }, [slug, queryClient]);
};
