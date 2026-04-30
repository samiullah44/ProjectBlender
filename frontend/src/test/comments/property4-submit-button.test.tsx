/**
 * Property-Based Test: Submit Button Validity Gate (Property 4)
 *
 * Feature: blog-comments, Property 4: Submit Button Validity Gate
 *
 * For any string input in the ResponseInput, the "Respond" button should be
 * enabled if and only if the string contains at least one non-whitespace
 * character. Equivalently:
 * - For any string composed entirely of whitespace (including the empty
 *   string), the button should be disabled.
 * - For any string containing at least one non-whitespace character, the
 *   button should be enabled.
 *
 * Validates: Requirements 3.7, 3.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent } from '@testing-library/react';
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

// ─── Helper: get the "Respond" button from the rendered output ────────────────

function getRespondButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /respond/i }) as HTMLButtonElement;
}

// ─── Helper: get the textarea from the rendered output ───────────────────────

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

// ─── Property 4: Submit Button Validity Gate ──────────────────────────────────

describe('Feature: blog-comments, Property 4: Submit Button Validity Gate', () => {
  /**
   * Validates: Requirements 3.7, 3.8
   *
   * The "Respond" button must be:
   * - ENABLED  when text.trim().length > 0  (at least one non-whitespace char)
   * - DISABLED when text.trim().length === 0 (empty or whitespace-only)
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('button is disabled iff text.trim().length === 0 for any arbitrary string', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary strings — includes empty, whitespace-only, and
        // strings with non-whitespace characters
        fc.string(),
        (text) => {
          const { unmount } = renderResponseInput();

          const textarea = getTextarea();

          // Type the generated string into the textarea
          fireEvent.change(textarea, { target: { value: text } });

          const button = getRespondButton();
          const isDisabled = button.disabled;
          const shouldBeDisabled = text.trim().length === 0;

          // The button's disabled state must match the expected state
          expect(isDisabled).toBe(shouldBeDisabled);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('button is disabled when input is empty', () => {
    renderResponseInput();
    const button = getRespondButton();
    // Initial state: textarea is empty, button should be disabled
    expect(button.disabled).toBe(true);
  });

  it('button is disabled when input contains only spaces', () => {
    renderResponseInput();
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(getRespondButton().disabled).toBe(true);
  });

  it('button is disabled when input contains only tabs and newlines', () => {
    renderResponseInput();
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: '\t\n\r\n\t' } });
    expect(getRespondButton().disabled).toBe(true);
  });

  it('button is enabled when input contains at least one non-whitespace character', () => {
    renderResponseInput();
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(getRespondButton().disabled).toBe(false);
  });

  it('button is enabled when input is a single non-whitespace character', () => {
    renderResponseInput();
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: 'x' } });
    expect(getRespondButton().disabled).toBe(false);
  });

  it('button is enabled when input has leading/trailing whitespace but non-whitespace content', () => {
    renderResponseInput();
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: '  hello  ' } });
    expect(getRespondButton().disabled).toBe(false);
  });

  it('button transitions from disabled to enabled when non-whitespace text is typed', () => {
    renderResponseInput();
    const textarea = getTextarea();

    // Initially disabled
    expect(getRespondButton().disabled).toBe(true);

    // Type a non-whitespace character
    fireEvent.change(textarea, { target: { value: 'a' } });
    expect(getRespondButton().disabled).toBe(false);

    // Clear the input — should be disabled again
    fireEvent.change(textarea, { target: { value: '' } });
    expect(getRespondButton().disabled).toBe(true);
  });

  it('button is disabled for whitespace-only strings across many examples', () => {
    fc.assert(
      fc.property(
        // Generate strings composed only of whitespace characters
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r')).map((chars) => chars.join('')),
        (whitespaceText) => {
          const { unmount } = renderResponseInput();

          const textarea = getTextarea();
          fireEvent.change(textarea, { target: { value: whitespaceText } });

          expect(getRespondButton().disabled).toBe(true);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('button is enabled for strings with at least one non-whitespace character', () => {
    fc.assert(
      fc.property(
        // Generate strings that contain at least one non-whitespace character
        fc.string().filter((s) => s.trim().length > 0),
        (nonEmptyText) => {
          const { unmount } = renderResponseInput();

          const textarea = getTextarea();
          fireEvent.change(textarea, { target: { value: nonEmptyText } });

          expect(getRespondButton().disabled).toBe(false);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
