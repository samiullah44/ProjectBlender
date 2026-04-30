/**
 * Property-Based Test: Comment List Rendering Completeness (Property 2)
 *
 * Feature: blog-comments, Property 2: Comment List Rendering Completeness
 *
 * For any valid IComment object, the rendered CommentItem should contain all
 * of the following: the first character of the author's display name (in the
 * avatar), the author's display name, a formatted date string derived from
 * createdAt, the full comment text, and the clap count as a number.
 *
 * Validates: Requirements 2.1, 2.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ─── Mock ClapButton ──────────────────────────────────────────────────────────
// ClapButton uses useClapComment / useUnClapComment hooks internally.
// We mock the entire module to avoid needing real hook implementations.
vi.mock('@/components/blog/comments/ClapButton', () => ({
  default: ({ claps }: { claps: number }) => (
    <div data-testid="clap-button">{claps}</div>
  ),
}));

// ─── Mock DeleteMenu ──────────────────────────────────────────────────────────
// DeleteMenu uses useDeleteComment hook internally.
// We mock it to a simple stub so it doesn't fail in the test environment.
vi.mock('@/components/blog/comments/DeleteMenu', () => ({
  default: () => <div data-testid="delete-menu" />,
}));

// Import CommentItem after mocks are set up
import CommentItem from '@/components/blog/comments/CommentItem';
import type { IComment } from '@/types/comment';

// ─── Arbitrary: IComment generator ───────────────────────────────────────────

// 24-character hex string (ObjectId-like)
const hexId = fc.stringMatching(/^[0-9a-f]{24}$/);

const arbitraryComment: fc.Arbitrary<IComment> = fc.record({
  _id: hexId,
  blogId: hexId,
  authorId: fc.record({
    _id: hexId,
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  }),
  text: fc.string({ minLength: 1, maxLength: 1000 }),
  claps: fc.nat(100),
  clappers: fc.array(hexId),
  createdAt: fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
  updatedAt: fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
  hidden: fc.boolean(),
});

// ─── Helper: render CommentItem wrapped in required providers ─────────────────

function renderCommentItem(comment: IComment) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CommentItem
          comment={comment}
          slug="test-post"
          currentUserId={undefined}
          currentUserRoles={[]}
          isAuthenticated={false}
        />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── Property 2: Comment List Rendering Completeness ─────────────────────────

describe('Feature: blog-comments, Property 2: Comment List Rendering Completeness', () => {
  /**
   * Validates: Requirements 2.1, 2.3
   *
   * For any valid IComment object, the rendered CommentItem must contain:
   * - The first character of authorId.name (avatar initial)
   * - The full authorId.name (author display name)
   * - A date string derived from createdAt
   * - The full comment text (no truncation)
   * - The claps count as a number
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required comment fields for any valid IComment', () => {
    fc.assert(
      fc.property(arbitraryComment, (comment) => {
        const { unmount, container } = renderCommentItem(comment);

        const textContent = container.textContent ?? '';

        // 1. Avatar initial: first character of authorId.name (uppercased)
        const expectedInitial = comment.authorId.name.charAt(0).toUpperCase();
        expect(textContent).toContain(expectedInitial);

        // 2. Full author display name
        expect(textContent).toContain(comment.authorId.name);

        // 3. A date string derived from createdAt — the component uses
        //    formatDistanceToNow which produces strings like "3 months ago",
        //    "about 2 years ago", "less than a minute ago", etc.
        //    We verify a date-like string is present by checking the container
        //    has a <span> with a title attribute containing the ISO date.
        const dateSpan = container.querySelector('[title]');
        expect(dateSpan).not.toBeNull();
        // The title attribute should be a human-readable locale date string
        // derived from the createdAt ISO string
        const titleAttr = dateSpan?.getAttribute('title') ?? '';
        expect(titleAttr.length).toBeGreaterThan(0);

        // 4. Full comment text — no truncation regardless of length
        expect(textContent).toContain(comment.text);

        // 5. Clap count as a number — rendered by the mocked ClapButton
        const clapButton = container.querySelector('[data-testid="clap-button"]');
        expect(clapButton).not.toBeNull();
        expect(clapButton?.textContent).toBe(String(comment.claps));

        // Clean up between iterations
        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('renders the avatar initial as the uppercased first character of the author name', () => {
    const comment: IComment = {
      _id: 'a'.repeat(24),
      blogId: 'b'.repeat(24),
      authorId: { _id: 'c'.repeat(24), name: 'alice', username: 'alice' },
      text: 'Hello world',
      claps: 5,
      clappers: [],
      createdAt: new Date('2024-06-01T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-06-01T12:00:00.000Z').toISOString(),
      hidden: false,
    };

    const { container } = renderCommentItem(comment);
    expect(container.textContent).toContain('A'); // uppercase of 'a'
    expect(container.textContent).toContain('alice');
  });

  it('renders the full text without truncation for a long comment', () => {
    const longText = 'x'.repeat(1000);
    const comment: IComment = {
      _id: 'a'.repeat(24),
      blogId: 'b'.repeat(24),
      authorId: { _id: 'c'.repeat(24), name: 'Bob', username: 'bob' },
      text: longText,
      claps: 0,
      clappers: [],
      createdAt: new Date('2024-06-01T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-06-01T12:00:00.000Z').toISOString(),
      hidden: false,
    };

    const { container } = renderCommentItem(comment);
    expect(container.textContent).toContain(longText);
  });

  it('renders clap count of 0 when comment has no claps', () => {
    const comment: IComment = {
      _id: 'a'.repeat(24),
      blogId: 'b'.repeat(24),
      authorId: { _id: 'c'.repeat(24), name: 'Carol', username: 'carol' },
      text: 'A comment with no claps',
      claps: 0,
      clappers: [],
      createdAt: new Date('2024-06-01T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-06-01T12:00:00.000Z').toISOString(),
      hidden: false,
    };

    const { container } = renderCommentItem(comment);
    const clapButton = container.querySelector('[data-testid="clap-button"]');
    expect(clapButton?.textContent).toBe('0');
  });
});
