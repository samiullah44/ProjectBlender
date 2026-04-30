import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { IComment } from '@/types/comment';
import CommentItem from './CommentItem';

interface CommentListProps {
  comments: IComment[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  currentUserId?: string;
  currentUserRoles?: string[];
  slug: string;
}

// Skeleton placeholder row for loading state
function CommentSkeleton() {
  return (
    <div className="flex gap-3 py-5 border-b border-gray-100 animate-pulse">
      {/* Avatar circle */}
      <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />

      {/* Content lines */}
      <div className="flex-1 min-w-0 space-y-2 pt-1">
        <div className="flex items-center gap-3">
          <div className="h-3.5 w-24 rounded bg-gray-200" />
          <div className="h-3 w-16 rounded bg-gray-100" />
        </div>
        <div className="h-3.5 w-full rounded bg-gray-200" />
        <div className="h-3.5 w-4/5 rounded bg-gray-200" />
        <div className="h-3.5 w-2/3 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function CommentList({
  comments,
  isLoading,
  isError,
  onRetry,
  currentUserId,
  currentUserRoles,
  slug,
}: CommentListProps) {
  // Loading state — 3 skeleton rows
  if (isLoading) {
    return (
      <div aria-label="Loading comments" aria-busy="true">
        <CommentSkeleton />
        <CommentSkeleton />
        <CommentSkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" aria-hidden="true" />
        <p className="text-sm text-gray-500">
          Failed to load comments. Please try again.
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (comments.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        No responses yet. Be the first to share your thoughts!
      </p>
    );
  }

  // Comment list — already sorted newest-first from the API
  return (
    <ul className="divide-y divide-gray-100" aria-label="Comments">
      {comments.map((comment) => (
        <li key={comment._id}>
          <CommentItem
            comment={comment}
            slug={slug}
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
            isAuthenticated={!!currentUserId}
          />
        </li>
      ))}
    </ul>
  );
}
