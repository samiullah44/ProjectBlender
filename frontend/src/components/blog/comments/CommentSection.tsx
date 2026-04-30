import React, { forwardRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useCommentsSorted, useCommentRealtime } from '@/hooks/useComments';
import ResponseInput from './ResponseInput';
import CommentList from './CommentList';

interface CommentSectionProps {
  slug: string;
  initialCount: number;
}

interface BlogPostCache {
  success: boolean;
  blog: { commentsCount: number; [key: string]: unknown };
}

type SortOption = 'recent' | 'popular';

const CommentSection = forwardRef<HTMLDivElement, CommentSectionProps>(
  ({ slug, initialCount }, ref) => {
    useCommentRealtime(slug);
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const [sort, setSort] = useState<SortOption>('recent');

    const {
      data: comments = [],
      isLoading,
      isError,
      refetch,
    } = useCommentsSorted(slug, sort);

    const queryClient = useQueryClient();
    const blogPostData = queryClient.getQueryData<BlogPostCache>(['blogPost', slug]);
    const liveCount = blogPostData?.blog?.commentsCount ?? initialCount;

    const currentUser =
      isAuthenticated && user ? { id: user.id, name: user.name } : null;

    return (
      <section ref={ref} className="mt-16 pt-10 border-t border-gray-100">
        {/* Heading + sort controls */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-gray-900">
            Responses ({liveCount})
          </h2>

          {/* Sort tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['recent', 'popular'] as SortOption[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
                  sort === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {s === 'recent' ? 'Recent' : 'Popular'}
              </button>
            ))}
          </div>
        </div>

        {/* Response input or sign-in prompt */}
        <ResponseInput slug={slug} currentUser={currentUser} />

        {/* Comment list */}
        <div className="mt-8">
          <CommentList
            comments={comments}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            currentUserId={currentUser?.id}
            currentUserRoles={
              isAuthenticated && user ? (user.roles ?? [user.role]) : []
            }
            slug={slug}
          />
        </div>
      </section>
    );
  }
);

CommentSection.displayName = 'CommentSection';

export default CommentSection;
