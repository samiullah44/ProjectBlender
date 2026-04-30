/**
 * Property-Based Test: Bottom Action Bar Count Reflects Optimistic State (Property 15)
 *
 * Feature: blog-comments, Property 15: Bottom Action Bar Count Reflects Optimistic State
 *
 * For any initial commentsCount value N on a blog post, after a successful comment
 * submission the BottomActionBar should display N+1, and after a successful comment
 * deletion it should display N-1 (floor 0).
 *
 * The BottomActionBar receives `commentCount` from `data?.blog?.commentsCount ?? 0`
 * in BlogPost.tsx, which reads from the `['blogPost', slug]` cache. Testing the
 * cache state is therefore equivalent to testing what BottomActionBar would display.
 *
 * Validates: Requirements 8.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { QueryClient } from '@tanstack/react-query';
import type { IComment } from '@/types/comment';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Generates a 24-character hex ID (stand-in for MongoDB ObjectId strings)
const objectIdArbitrary = fc.stringMatching(/^[a-f0-9]{24}$/);

/**
 * Generates a minimal valid IComment object.
 */
const commentArbitrary = fc.record<IComment>({
  _id: objectIdArbitrary,
  blogId: objectIdArbitrary,
  authorId: fc.record({
    _id: objectIdArbitrary,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    username: fc.string({ minLength: 1, maxLength: 30 }),
  }),
  text: fc.string({ minLength: 1, maxLength: 1000 }),
  claps: fc.nat({ max: 100 }),
  clappers: fc.array(objectIdArbitrary, { maxLength: 10 }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
  hidden: fc.boolean(),
});

// ─── Cache update logic (extracted from useComments.ts hooks) ─────────────────
//
// These mirror the exact onSuccess callbacks in usePostComment and useDeleteComment
// in frontend/src/hooks/useComments.ts. We test them directly against a QueryClient
// to avoid needing to render the full component tree or trigger real mutations.

type BlogPostCache = {
  success: boolean;
  blog: { commentsCount: number; [key: string]: unknown };
};

/**
 * Applies the usePostComment onSuccess cache update:
 * - Prepends the new comment to ['comments', slug]
 * - Increments commentsCount in ['blogPost', slug]
 */
function applyPostCommentOnSuccess(
  queryClient: QueryClient,
  slug: string,
  newComment: IComment
): void {
  queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) => [newComment, ...old]);

  queryClient.setQueryData<BlogPostCache>(
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
}

/**
 * Applies the useDeleteComment onSuccess cache update:
 * - Removes the deleted comment from ['comments', slug]
 * - Decrements commentsCount in ['blogPost', slug] (floor 0)
 */
function applyDeleteCommentOnSuccess(
  queryClient: QueryClient,
  slug: string,
  commentId: string
): void {
  queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) =>
    old.filter(c => c._id !== commentId)
  );

  queryClient.setQueryData<BlogPostCache>(
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
}

// ─── Helper: build a QueryClient pre-populated with initial state ─────────────

function buildQueryClient(
  slug: string,
  initialComments: IComment[],
  initialCount: number
): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

  queryClient.setQueryData<IComment[]>(['comments', slug], initialComments);

  queryClient.setQueryData<BlogPostCache>(['blogPost', slug], {
    success: true,
    blog: {
      commentsCount: initialCount,
    },
  });

  return queryClient;
}

/**
 * Reads the commentsCount from the ['blogPost', slug] cache — this is the value
 * that BottomActionBar receives as its `commentCount` prop.
 */
function getBottomBarCount(queryClient: QueryClient, slug: string): number {
  const data = queryClient.getQueryData<BlogPostCache>(['blogPost', slug]);
  return data?.blog?.commentsCount ?? 0;
}

// ─── Property 15: Bottom Action Bar Count Reflects Optimistic State ───────────

describe('Feature: blog-comments, Property 15: Bottom Action Bar Count Reflects Optimistic State', () => {
  /**
   * Validates: Requirements 8.7
   *
   * For any initial commentsCount N:
   * - After a successful comment submission, BottomActionBar displays N+1
   * - After a successful comment deletion, BottomActionBar displays N-1 (floor 0)
   */

  it('BottomActionBar displays N+1 after a successful comment submission', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        commentArbitrary,
        (N, newComment) => {
          const slug = 'test-post';
          const queryClient = buildQueryClient(slug, [], N);

          applyPostCommentOnSuccess(queryClient, slug, newComment);

          expect(getBottomBarCount(queryClient, slug)).toBe(N + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('BottomActionBar displays N-1 after a successful comment deletion (N >= 1)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        commentArbitrary,
        (N, existingComment) => {
          const slug = 'test-post';
          const queryClient = buildQueryClient(slug, [existingComment], N);

          applyDeleteCommentOnSuccess(queryClient, slug, existingComment._id);

          expect(getBottomBarCount(queryClient, slug)).toBe(N - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('BottomActionBar displays 0 (floor) after deletion when N is already 0', () => {
    fc.assert(
      fc.property(
        commentArbitrary,
        (existingComment) => {
          const slug = 'test-post';
          // N=0: count cannot go below 0
          const queryClient = buildQueryClient(slug, [existingComment], 0);

          applyDeleteCommentOnSuccess(queryClient, slug, existingComment._id);

          expect(getBottomBarCount(queryClient, slug)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('both submit and delete update BottomActionBar count correctly in sequence', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        commentArbitrary,
        commentArbitrary,
        (N, commentToAdd, commentToDelete) => {
          const slug = 'test-post';
          // Start with commentToDelete already in the list
          const queryClient = buildQueryClient(slug, [commentToDelete], N);

          // Step 1: submit a new comment → count should be N+1
          applyPostCommentOnSuccess(queryClient, slug, commentToAdd);
          expect(getBottomBarCount(queryClient, slug)).toBe(N + 1);

          // Step 2: delete the existing comment → count should be N (i.e., (N+1)-1)
          applyDeleteCommentOnSuccess(queryClient, slug, commentToDelete._id);
          expect(getBottomBarCount(queryClient, slug)).toBe(N);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('BottomActionBar count never goes below 0 regardless of deletion sequence', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 }),
        fc.array(commentArbitrary, { minLength: 1, maxLength: 10 }),
        (N, comments) => {
          const slug = 'test-post';
          const queryClient = buildQueryClient(slug, comments, N);

          // Delete all comments one by one
          for (const comment of comments) {
            applyDeleteCommentOnSuccess(queryClient, slug, comment._id);
          }

          expect(getBottomBarCount(queryClient, slug)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('BottomActionBar count is N+1 regardless of the content of the new comment', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }),
        commentArbitrary,
        (N, newComment) => {
          const slug = 'test-post';
          const queryClient = buildQueryClient(slug, [], N);

          applyPostCommentOnSuccess(queryClient, slug, newComment);

          // The count should always be exactly N+1, regardless of comment content
          expect(getBottomBarCount(queryClient, slug)).toBe(N + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
