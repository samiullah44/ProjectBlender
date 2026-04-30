/**
 * Property-Based Test: Comment Heading Count Format (Property 1)
 *
 * Feature: blog-comments, Property 1: Comment Heading Count Format
 *
 * For any non-negative integer N representing the number of comments for a
 * blog post, the CommentSection heading should render as exactly "Responses (N)".
 *
 * Validates: Requirements 1.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ─── Mock useAuthStore ────────────────────────────────────────────────────────
// CommentSection reads useAuthStore to decide whether to show ResponseInput.
// We mock it to return an unauthenticated state so the component renders
// without needing a full auth context.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: null; isAuthenticated: boolean }) => unknown) =>
    selector({ user: null, isAuthenticated: false }),
}));

// ─── Mock useComments (and all other exports from the module) ─────────────────
// useComments is the ['comments', slug] query hook. We mock it to return an
// empty array so the CommentList renders without needing real data.
// The heading count comes from the ['blogPost', slug] cache, not from this hook.
// We also mock the mutation hooks so ResponseInput and other sub-components
// don't fail when they call them at the top level.
vi.mock('@/hooks/useComments', () => ({
  useComments: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  usePostComment: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteComment: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useClapComment: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUnClapComment: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Import CommentSection after mocks are set up
import CommentSection from '@/components/blog/comments/CommentSection';

// ─── Helper: build a QueryClient pre-populated with blogPost cache ────────────

function buildQueryClient(slug: string, commentsCount: number): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries so tests don't hang on failed queries
        retry: false,
        // Disable garbage collection during the test
        gcTime: Infinity,
      },
    },
  });

  // Pre-populate the ['blogPost', slug] cache with the shape CommentSection expects:
  // { success: true, blog: { commentsCount: N } }
  queryClient.setQueryData(['blogPost', slug], {
    success: true,
    blog: {
      commentsCount,
    },
  });

  return queryClient;
}

// ─── Helper: render CommentSection with a pre-populated QueryClient ───────────

function renderCommentSection(slug: string, commentsCount: number) {
  const queryClient = buildQueryClient(slug, commentsCount);

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CommentSection slug={slug} initialCount={commentsCount} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── Property 1: Comment Heading Count Format ─────────────────────────────────

describe('Feature: blog-comments, Property 1: Comment Heading Count Format', () => {
  /**
   * Validates: Requirements 1.2
   *
   * For any non-negative integer N, the CommentSection heading must render
   * as exactly "Responses (N)".
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heading as "Responses (N)" for any non-negative integer N', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary non-negative integers
        fc.nat(),
        // Use a fixed slug so the query key is deterministic per run
        (n) => {
          const slug = 'test-post';

          const { unmount } = renderCommentSection(slug, n);

          // The heading must be exactly "Responses (N)"
          const heading = screen.getByRole('heading', { level: 2 });
          expect(heading.textContent).toBe(`Responses (${n})`);

          // Clean up between iterations
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('renders "Responses (0)" for zero comments', () => {
    renderCommentSection('zero-post', 0);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Responses (0)');
  });

  it('renders "Responses (1)" for a single comment', () => {
    renderCommentSection('single-post', 1);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Responses (1)');
  });

  it('renders "Responses (N)" for a large N', () => {
    renderCommentSection('large-post', 9999);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Responses (9999)');
  });
});
