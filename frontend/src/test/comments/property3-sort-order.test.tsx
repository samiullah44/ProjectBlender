/**
 * Property-Based Test: Comment List Sort Order (Property 3)
 *
 * Feature: blog-comments, Property 3: Comment List Sort Order
 *
 * For any array of comments with distinct createdAt timestamps, when the
 * comments are sorted newest-first (as the API would return them) and passed
 * to CommentList, the rendered order should match the sorted order.
 *
 * The CommentList component renders comments in the order they are given —
 * sorting is the API's responsibility. This property verifies that the
 * component faithfully preserves the newest-first order it receives.
 *
 * Validates: Requirements 2.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ─── Mock CommentItem ─────────────────────────────────────────────────────────
// We mock CommentItem to render a simple element with a data-testid containing
// the comment's _id. This lets us check the rendered order without needing
// the full CommentItem implementation (which depends on ClapButton, DeleteMenu,
// date-fns, etc.).
vi.mock('@/components/blog/comments/CommentItem', () => ({
  default: ({ comment }: { comment: { _id: string } }) => (
    <div data-testid={`comment-${comment._id}`} data-comment-id={comment._id} />
  ),
}));

// Import CommentList after mocks are set up
import CommentList from '@/components/blog/comments/CommentList';
import type { IComment } from '@/types/comment';

// ─── Arbitrary: IComment generator ───────────────────────────────────────────

// 24-character hex string (ObjectId-like)
const hexId = fc.stringMatching(/^[0-9a-f]{24}$/);

const arbitraryComment = (id: string, createdAt: Date): IComment => ({
  _id: id,
  blogId: 'b'.repeat(24),
  authorId: {
    _id: 'c'.repeat(24),
    name: 'Test Author',
    username: 'testauthor',
  },
  text: 'Test comment text',
  claps: 0,
  clappers: [],
  createdAt: createdAt.toISOString(),
  updatedAt: createdAt.toISOString(),
  hidden: false,
});

// ─── Helper: render CommentList wrapped in required providers ─────────────────

function renderCommentList(comments: IComment[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CommentList
          comments={comments}
          isLoading={false}
          isError={false}
          onRetry={vi.fn()}
          currentUserId={undefined}
          currentUserRoles={[]}
          slug="test-post"
        />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── Helper: shuffle an array (Fisher-Yates) ─────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── Property 3: Comment List Sort Order ─────────────────────────────────────

describe('Feature: blog-comments, Property 3: Comment List Sort Order', () => {
  /**
   * Validates: Requirements 2.2
   *
   * For any array of comments with distinct createdAt timestamps:
   * 1. Sort them newest-first (as the API would)
   * 2. Pass them to CommentList
   * 3. Assert the rendered order matches the sorted (newest-first) order
   *
   * The CommentList component renders comments in the order they are given.
   * The API is responsible for sorting. This test verifies the component
   * preserves the order it receives.
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders comments in the order they are passed (newest-first when pre-sorted)', () => {
    fc.assert(
      fc.property(
        // Generate an array of at least 2 distinct timestamps
        fc.array(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
            .filter((d) => !isNaN(d.getTime())),
          { minLength: 2, maxLength: 10 }
        ).filter((dates) => {
          // Ensure all timestamps are distinct (no duplicates)
          const times = dates.map((d) => d.getTime());
          return new Set(times).size === times.length;
        }),
        (dates) => {
          // Build IComment objects with distinct _ids and the generated timestamps
          const comments: IComment[] = dates.map((date, index) => {
            // Generate a unique 24-char hex id based on index
            const id = index.toString(16).padStart(24, '0');
            return arbitraryComment(id, date);
          });

          // Sort newest-first (as the API would return them)
          const sortedNewestFirst = [...comments].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          // Shuffle the array to simulate arbitrary input order
          const shuffled = shuffle(sortedNewestFirst);

          // Pass the shuffled array to CommentList — the component renders
          // them in the order given (no re-sorting)
          const { container, unmount } = renderCommentList(shuffled);

          // Get all rendered comment elements in DOM order
          const renderedItems = container.querySelectorAll('[data-comment-id]');
          const renderedIds = Array.from(renderedItems).map(
            (el) => el.getAttribute('data-comment-id') ?? ''
          );

          // The rendered order should match the shuffled order (not re-sorted)
          const shuffledIds = shuffled.map((c) => c._id);
          expect(renderedIds).toEqual(shuffledIds);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('renders comments in newest-first order when pre-sorted by the caller', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
            .filter((d) => !isNaN(d.getTime())),
          { minLength: 2, maxLength: 10 }
        ).filter((dates) => {
          const times = dates.map((d) => d.getTime());
          return new Set(times).size === times.length;
        }),
        (dates) => {
          const comments: IComment[] = dates.map((date, index) => {
            const id = index.toString(16).padStart(24, '0');
            return arbitraryComment(id, date);
          });

          // Sort newest-first (as the API would return them)
          const sortedNewestFirst = [...comments].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          // Pass the pre-sorted array to CommentList
          const { container, unmount } = renderCommentList(sortedNewestFirst);

          // Get all rendered comment elements in DOM order
          const renderedItems = container.querySelectorAll('[data-comment-id]');
          const renderedIds = Array.from(renderedItems).map(
            (el) => el.getAttribute('data-comment-id') ?? ''
          );

          // The rendered order should match the newest-first sorted order
          const expectedIds = sortedNewestFirst.map((c) => c._id);
          expect(renderedIds).toEqual(expectedIds);

          // Additionally verify the rendered order is actually newest-first
          const renderedComments = renderedIds.map((id) =>
            sortedNewestFirst.find((c) => c._id === id)!
          );
          for (let i = 0; i < renderedComments.length - 1; i++) {
            const currentTime = new Date(renderedComments[i].createdAt).getTime();
            const nextTime = new Date(renderedComments[i + 1].createdAt).getTime();
            expect(currentTime).toBeGreaterThan(nextTime);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('renders a single comment without error', () => {
    const comment = arbitraryComment('a'.repeat(24), new Date('2024-06-01T12:00:00.000Z'));
    const { container } = renderCommentList([comment]);
    const renderedItems = container.querySelectorAll('[data-comment-id]');
    expect(renderedItems).toHaveLength(1);
    expect(renderedItems[0].getAttribute('data-comment-id')).toBe(comment._id);
  });

  it('renders two comments in the order given (newest first when pre-sorted)', () => {
    const older = arbitraryComment('a'.repeat(24), new Date('2024-01-01T00:00:00.000Z'));
    const newer = arbitraryComment('b'.repeat(24), new Date('2024-06-01T00:00:00.000Z'));

    // Pass newest-first (as the API would)
    const { container } = renderCommentList([newer, older]);

    const renderedItems = container.querySelectorAll('[data-comment-id]');
    expect(renderedItems).toHaveLength(2);
    expect(renderedItems[0].getAttribute('data-comment-id')).toBe(newer._id);
    expect(renderedItems[1].getAttribute('data-comment-id')).toBe(older._id);
  });
});
