/**
 * Property-Based Test: Character Count Display (Property 5)
 *
 * Feature: blog-comments, Property 5: Character Count Display
 *
 * For any string of length N where 0 ≤ N ≤ 1000, the ResponseInput character
 * count display should show "N / 1000" (where N is the current character count).
 *
 * Validates: Requirements 3.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ─── Mock usePostComment ──────────────────────────────────────────────────────
// ResponseInput calls usePostComment(slug) at the top level of the component.
// We mock it to return a stable { mutate, isPending } object so the component
// renders without needing a real QueryClient mutation setup.
vi.mock('@/hooks/useComments', () => ({
  usePostComment: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  // Provide stubs for other exports in case they are imported transitively
  useComments: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
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

// Import ResponseInput after mocks are set up
import ResponseInput from '@/components/blog/comments/ResponseInput';

// ─── Mock authenticated user ──────────────────────────────────────────────────

const mockUser = { id: 'user-123', name: 'Alice' };

// ─── Helper: render ResponseInput with a mock authenticated user ──────────────

function renderResponseInput() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ResponseInput slug="test-post" currentUser={mockUser} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── Helper: get the textarea from the rendered output ───────────────────────

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

// ─── Property 5: Character Count Display ─────────────────────────────────────

describe('Feature: blog-comments, Property 5: Character Count Display', () => {
  /**
   * Validates: Requirements 3.6
   *
   * The character count display must show "${text.length} / 1000" for any
   * string of length 0–1000 typed into the textarea.
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('character count display shows "${text.length} / 1000" for any string of length 0–1000', () => {
    fc.assert(
      fc.property(
        // Generate strings of length 0–1000
        fc.string({ maxLength: 1000 }),
        (text) => {
          cleanup();
          const { container } = renderResponseInput();

          const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

          // Simulate typing the generated string into the textarea
          fireEvent.change(textarea, { target: { value: text } });

          // The character count display should show "${text.length} / 1000"
          const countSpan = container.querySelector('span.tabular-nums');
          expect(countSpan?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${text.length} / 1000`);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shows "0 / 1000" when the textarea is empty (initial state)', () => {
    renderResponseInput();
    expect(screen.getByText('0 / 1000')).toBeTruthy();
  });

  it('shows "1 / 1000" when a single character is typed', () => {
    renderResponseInput();
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: 'a' } });
    expect(screen.getByText('1 / 1000')).toBeTruthy();
  });

  it('shows "1000 / 1000" when exactly 1000 characters are typed', () => {
    renderResponseInput();
    const textarea = getTextarea();
    const maxText = 'a'.repeat(1000);
    fireEvent.change(textarea, { target: { value: maxText } });
    expect(screen.getByText('1000 / 1000')).toBeTruthy();
  });

  it('updates the count display as text changes', () => {
    renderResponseInput();
    const textarea = getTextarea();

    // Start empty
    expect(screen.getByText('0 / 1000')).toBeTruthy();

    // Type some text
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByText('5 / 1000')).toBeTruthy();

    // Add more text
    fireEvent.change(textarea, { target: { value: 'Hello, world!' } });
    expect(screen.getByText('13 / 1000')).toBeTruthy();

    // Clear the text
    fireEvent.change(textarea, { target: { value: '' } });
    expect(screen.getByText('0 / 1000')).toBeTruthy();
  });

  it('count display reflects exact length for whitespace-only strings', () => {
    fc.assert(
      fc.property(
        // Generate whitespace-only strings of length 0–1000.
        // Exclude '\r' because browsers normalize '\r\n' → '\n' in textarea
        // values, which would cause a mismatch between the JS string length
        // and the displayed count.
        fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 1000 })
          .map((chars) => chars.join('')),
        (whitespaceText) => {
          cleanup();
          const { container } = renderResponseInput();

          const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
          fireEvent.change(textarea, { target: { value: whitespaceText } });

          const countSpan = container.querySelector('span.tabular-nums');
          expect(countSpan?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${whitespaceText.length} / 1000`);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
