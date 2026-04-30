/**
 * useBlogRealtime
 *
 * Subscribes to WebSocket system_update events and invalidates the relevant
 * TanStack Query caches so the UI updates automatically without a page refresh.
 *
 * Events handled:
 *  - blog_status_changed  → invalidate blog list + the specific blog post
 *  - comment_added        → invalidate comments list + blog post (commentsCount)
 *  - comment_deleted      → invalidate comments list + blog post (commentsCount)
 *  - blog_favorited       → invalidate the specific blog post (favoritesCount)
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocketService } from '@/services/websocketService';

interface BlogRealtimeOptions {
  /** Current blog slug — when provided, only events for this slug trigger refetches */
  slug?: string;
}

export function useBlogRealtime({ slug }: BlogRealtimeOptions = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = websocketService.subscribeToSystem((data: any) => {
      switch (data.type) {
        case 'blog_status_changed': {
          // A blog was published or unpublished — refresh the public blog list
          queryClient.invalidateQueries({ queryKey: ['blogs'] });
          queryClient.invalidateQueries({ queryKey: ['featuredBlogs'] });
          // If we're on the affected post page, refresh it too
          if (data.slug && (!slug || slug === data.slug)) {
            queryClient.invalidateQueries({ queryKey: ['blogPost', data.slug] });
          }
          break;
        }

        case 'comment_added':
        case 'comment_deleted': {
          const eventSlug: string | undefined = data.slug;
          if (!eventSlug) break;
          // Only update if we're on the matching post (or no slug filter set)
          if (!slug || slug === eventSlug) {
            queryClient.invalidateQueries({ queryKey: ['comments', eventSlug] });
            queryClient.invalidateQueries({ queryKey: ['blogPost', eventSlug] });
          }
          break;
        }

        case 'blog_favorited': {
          const eventSlug: string | undefined = data.slug;
          if (!eventSlug) break;
          if (!slug || slug === eventSlug) {
            queryClient.invalidateQueries({ queryKey: ['blogPost', eventSlug] });
          }
          break;
        }

        default:
          break;
      }
    });

    return unsubscribe;
  }, [queryClient, slug]);
}
