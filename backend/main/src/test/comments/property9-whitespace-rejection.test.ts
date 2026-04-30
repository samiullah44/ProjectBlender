/**
 * Property 9: Whitespace Comment Rejection
 *
 * Feature: blog-comments, Property 9: Whitespace Comment Rejection
 * Validates: Requirements 4.9
 *
 * For any string composed entirely of whitespace characters (spaces, tabs,
 * newlines, carriage returns), the comment text validation logic should return
 * { valid: false, error: 'Comment text is required' }.
 *
 * This is a pure logic test — it tests the validation transformation
 * without requiring a real MongoDB connection or HTTP server.
 */

import * as fc from 'fast-check';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Pure validation logic extracted from the route handler
// (mirrors the validation in backend/main/src/routes/api/comments.ts)
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Pure function that mirrors the comment text validation logic from the
 * POST /api/blogs/:slug/comments route handler.
 *
 * Corresponds to:
 *   const trimmed = text.trim();
 *   if (!trimmed) return res.status(400).json({ success: false, error: 'Comment text is required' });
 *   if (trimmed.length > 1000) return res.status(400).json({ success: false, error: 'Comment text must not exceed 1000 characters' });
 */
function validateCommentText(text: string): ValidationResult {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'Comment text is required' };
  }
  if (trimmed.length > 1000) {
    return { valid: false, error: 'Comment text must not exceed 1000 characters' };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates strings composed entirely of whitespace characters.
 * Uses fc.stringOf with constantFrom to ensure only whitespace chars are used.
 * minLength: 1 ensures we always have at least one whitespace character.
 */
const whitespaceStringArb: fc.Arbitrary<string> = fc.stringOf(
  fc.constantFrom(' ', '\t', '\n', '\r'),
  { minLength: 1, maxLength: 100 }
);

// ---------------------------------------------------------------------------
// Property 9 tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('Running Property 9: Whitespace Comment Rejection');
console.log('Feature: blog-comments, Property 9: Whitespace Comment Rejection');
console.log('Validates: Requirements 4.9');
console.log('---');

// Property 9: for any whitespace-only string, validation returns { valid: false, error: 'Comment text is required' }
try {
  fc.assert(
    fc.property(whitespaceStringArb, (text: string) => {
      const result = validateCommentText(text);
      assert.strictEqual(
        result.valid,
        false,
        `Expected validation to fail for whitespace-only text "${JSON.stringify(text)}" but got valid: ${result.valid}`
      );
      assert.strictEqual(
        result.error,
        'Comment text is required',
        `Expected error "Comment text is required" for whitespace-only text but got: "${result.error}"`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 9: whitespace-only strings are rejected with correct error (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 9: whitespace-only strings are rejected with correct error');
  console.error('  ', e.message);
  errors.push(`9: ${e.message}`);
  failed++;
}

// Property 9b: empty string is also rejected with the same error
try {
  const result = validateCommentText('');
  assert.strictEqual(result.valid, false, 'Expected empty string to fail validation');
  assert.strictEqual(result.error, 'Comment text is required', 'Expected correct error for empty string');
  console.log('✓ Property 9b: empty string is rejected with correct error');
  passed++;
} catch (e: any) {
  console.error('✗ Property 9b: empty string is rejected with correct error');
  console.error('  ', e.message);
  errors.push(`9b: ${e.message}`);
  failed++;
}

// Property 9c: result always has valid: false (never valid: true) for whitespace-only input
try {
  fc.assert(
    fc.property(whitespaceStringArb, (text: string) => {
      const result = validateCommentText(text);
      assert.ok(
        !result.valid,
        `Expected valid to be false for whitespace-only text but got: ${result.valid}`
      );
      assert.ok(
        typeof result.error === 'string' && result.error.length > 0,
        `Expected a non-empty error string for whitespace-only text but got: ${result.error}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 9c: result always has valid: false and a non-empty error for whitespace-only input (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 9c: result always has valid: false and a non-empty error for whitespace-only input');
  console.error('  ', e.message);
  errors.push(`9c: ${e.message}`);
  failed++;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('---');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\nFailed properties:');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
} else {
  console.log('\nAll Property 9 assertions passed ✓');
  process.exit(0);
}
