/**
 * Property-Based Test: New Comment Prepend and Count Increment (Property 6)
 *
 * Feature: blog-comments, Property 6: New Comment Prepend and Count Increment
 *
 * For any initial comment list of length N and any new comment returned by a
 * successful POST /api/blogs/:slug/comments response, the updated comment list
 * should have length N+1, the new comment should be the first element, and the
 * commentsCount in the blogPost cache should show N+1.
 *
 * Validates: Requirements 4.2, 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { QueryClient } from '@tanstack/react-query';
import type { IComment } from '@/types/comment';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Generates a 24-character alphanumeric ID (stand-in for MongoDB ObjectId strings)
const objectIdArbitrary = fc.stringMatching(/^[a-f0-9]{24}$/);

/**
 * Generates a minimal valid IComment object.
 * All fields are required by the interface; we use fast-check primitives to
 * produce realistic-looking values without needing a real API.
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

/**
 * Generates an array of N comments (0 ≤ N ≤ 20).
 */
const commentListArbitrary = fc.array(commentArbitrary, { minLength: 0, maxLength: 20 });

// ─── Cache update logic (extracted from usePostComment onSuccess) ──────────────
//
// This is the exact same logic as in frontend/src/hooks/useComments.ts
// usePostComment onSuccess callback. We test it directly against a QueryClient
// to avoid needing to render the full component tree or trigger real mutations.

function applyPostCommentOnSuccess(
  queryClient: QueryClient,
  slug: string,
  newComment: IComment
): void {
  // Prepend new comment to the comments cache
  queryClient.setQueryData<IComment[]>(['comments', slug], (old = []) => [newComment, ...old]);

  // Increment commentsCount in the blogPost cache
  queryClient.setQueryData<{ success: boolean; blog: { commentsCount: number; [key: string]: unknown } }>(
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

  // Pre-populate ['comments', slug] with the initial comment list
  queryClient.setQueryData<IComment[]>(['comments', slug], initialComments);

  // Pre-populate ['blogPost', slug] with the initial commentsCount
  queryClient.setQueryData(['blogPost', slug], {
    success: true,
    blog: {
      commentsCount: initialCount,
    },
  });

  return queryClient;
}

// ─── Property 6: New Comment Prepend and Count Increment ─────────────────────

describe('Feature: blog-comments, Property 6: New Comment Prepend and Count Increment', () => {
  /**
   * Validates: Requirements 4.2, 4.3
   *
   * For any initial comment list of length N and any new comment:
   * - The updated list has length N+1
   * - The new comment is the first element
   * - The commentsCount in the blogPost cache shows N+1
   */

  it('updated list has length N+1 after a successful post', () => {
    fc.assert(
      fc.property(
        commentListArbitrary,
        commentArbitrary,
        (initialComments, newComment) => {
          const slug = 'test-post';
          const N = initialComments.length;
          const queryClient = buildQueryClient(slug, initialComments, N);

          // Simulate the onSuccess callback
          applyPostCommentOnSuccess(queryClient, slug, newComment);

          const updatedComments = queryClient.getQueryData<IComment[]>(['comments', slug]);
          expect(updatedComments).toBeDefined();
          expect(updatedComments!.length).toBe(N + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('new comment is the first element after a successful post', () => {
    fc.assert(
      fc.property(
        commentListArbitrary,
        commentArbitrary,
        (initialComments, newComment) => {
          const slug = 'test-post';
          const N = initialComments.length;
          const queryClient = buildQueryClient(slug, initialComments, N);

          // Simulate the onSuccess callback
          applyPostCommentOnSuccess(queryClient, slug, newComment);

          const updatedComments = queryClient.getQueryData<IComment[]>(['comments', slug]);
          expect(updatedComments).toBeDefined();
          expect(updatedComments![0]).toEqual(newComment);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('commentsCount in blogPost cache is N+1 after a successful post', () => {
    fc.assert(
      fc.property(
        commentListArbitrary,
        commentArbitrary,
        (initialComments, newComment) => {
          const slug = 'test-post';
          const N = initialComments.length;
          const queryClient = buildQueryClient(slug, initialComments, N);

          // Simulate the onSuccess callback
          applyPostCommentOnSuccess(queryClient, slug, newComment);

          const updatedBlogPost = queryClient.getQueryData<{
            success: boolean;
            blog: { commentsCount: number };
          }>(['blogPost', slug]);

          expect(updatedBlogPost).toBeDefined();
          expect(updatedBlogPost!.blog.commentsCount).toBe(N + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all three invariants hold simultaneously for any N and any new comment', () => {
    fc.assert(
      fc.property(
        commentListArbitrary,
        commentArbitrary,
        (initialComments, newComment) => {
          const slug = 'test-post';
          const N = initialComments.length;
          const queryClient = buildQueryClient(slug, initialComments, N);

          // Simulate the onSuccess callback
          applyPostCommentOnSuccess(queryClient, slug, newComment);

          const updatedComments = queryClient.getQueryData<IComment[]>(['comments', slug]);
          const updatedBlogPost = queryClient.getQueryData<{
            success: boolean;
            blog: { commentsCount: number };
          }>(['blogPost', slug]);

          // Invariant 1: list length is N+1
          expect(updatedComments!.length).toBe(N + 1);

          // Invariant 2: new comment is first element
          expect(updatedComments![0]).toEqual(newComment);

          // Invariant 3: commentsCount in blogPost cache is N+1
          expect(updatedBlogPost!.blog.commentsCount).toBe(N + 1);

          // Invariant 4: original comments are preserved (in order) after the new one
          for (let i = 0; i < initialComments.length; i++) {
            expect(updatedComments![i + 1]).toEqual(initialComments[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('works correctly when the initial list is empty (N=0)', () => {
    const slug = 'empty-post';
    const queryClient = buildQueryClient(slug, [], 0);

    const newComment: IComment = {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      blogId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      authorId: { _id: 'cccccccccccccccccccccccc', name: 'Alice', username: 'alice' },
      text: 'First comment!',
      claps: 0,
      clappers: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      hidden: false,
    };

    applyPostCommentOnSuccess(queryClient, slug, newComment);

    const updatedComments = queryClient.getQueryData<IComment[]>(['comments', slug]);
    const updatedBlogPost = queryClient.getQueryData<{ success: boolean; blog: { commentsCount: number } }>(['blogPost', slug]);

    expect(updatedComments!.length).toBe(1);
    expect(updatedComments![0]).toEqual(newComment);
    expect(updatedBlogPost!.blog.commentsCount).toBe(1);
  });

  it('commentsCount increments from any starting value, not just 0', () => {
    fc.assert(
      fc.property(
        // Use an independent nat for commentsCount (may differ from list length)
        fc.nat({ max: 1000 }),
        commentArbitrary,
        (initialCount, newComment) => {
          const slug = 'test-post';
          // Use an empty list but set commentsCount to an arbitrary value
          const queryClient = buildQueryClient(slug, [], initialCount);

          applyPostCommentOnSuccess(queryClient, slug, newComment);

          const updatedBlogPost = queryClient.getQueryData<{
            success: boolean;
            blog: { commentsCount: number };
          }>(['blogPost', slug]);

          expect(updatedBlogPost!.blog.commentsCount).toBe(initialCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
