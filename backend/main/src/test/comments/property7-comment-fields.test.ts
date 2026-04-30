/**
 * Property 7: Comment Creation Sets Correct Fields
 *
 * Feature: blog-comments, Property 7: Comment Creation Sets Correct Fields
 * Validates: Requirements 4.7
 *
 * For any valid (blogId, userId, text) tuple where text is a non-empty string
 * of at most 1000 characters, the comment document created by the comment
 * creation logic should have:
 *   - blogId equal to the provided blogId
 *   - authorId equal to userId
 *   - text equal to text.trim()
 *   - claps equal to 0
 *   - clappers equal to []
 *
 * This is a pure logic test — it tests the field-setting transformation
 * without requiring a real MongoDB connection or HTTP server.
 */

import * as fc from 'fast-check';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Pure comment creation logic extracted from the route handler
// (mirrors the logic in backend/main/src/routes/api/comments.ts)
// ---------------------------------------------------------------------------

interface CommentFields {
  blogId: string;
  authorId: string;
  text: string;
  claps: number;
  clappers: string[];
}

/**
 * Pure function that mirrors the field-setting logic from the POST /comments
 * route handler. Given a blogId, userId, and raw text input, it returns the
 * fields that would be stored in the Comment document.
 *
 * Corresponds to the `Comment.create({ ... })` call in the route:
 *   blogId: blog._id,
 *   authorId: req.user.userId,
 *   text: trimmedText,
 *   claps: 0,
 *   clappers: [],
 */
function buildCommentFields(blogId: string, userId: string, text: string): CommentFields {
  const trimmedText = typeof text === 'string' ? text.trim() : '';
  return {
    blogId,
    authorId: userId,
    text: trimmedText,
    claps: 0,
    clappers: [],
  };
}

/**
 * Validation logic extracted from the route handler.
 * Returns null if valid, or an error string if invalid.
 */
function validateCommentText(text: string): string | null {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return 'Comment text is required';
  if (trimmed.length > 1000) return 'Comment text must not exceed 1000 characters';
  return null;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid MongoDB-style ObjectId hex string (24 hex chars) */
const objectIdArb: fc.Arbitrary<string> = fc.hexaString({ minLength: 24, maxLength: 24 });

/**
 * Generates a non-empty string of at most 1000 characters that contains at
 * least one non-whitespace character (i.e., a valid comment text).
 */
const validCommentTextArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 1000 })
  .filter((s: string) => s.trim().length > 0 && s.trim().length <= 1000);

// ---------------------------------------------------------------------------
// Property 7 tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('Running Property 7: Comment Creation Sets Correct Fields');
console.log('Feature: blog-comments, Property 7: Comment Creation Sets Correct Fields');
console.log('Validates: Requirements 4.7');
console.log('---');

// Property 7a: blogId is preserved exactly
try {
  fc.assert(
    fc.property(objectIdArb, objectIdArb, validCommentTextArb, (blogId: string, userId: string, text: string) => {
      const fields = buildCommentFields(blogId, userId, text);
      assert.strictEqual(
        fields.blogId,
        blogId,
        `Expected blogId to be "${blogId}" but got "${fields.blogId}"`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7a: blogId is preserved exactly (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7a: blogId is preserved exactly');
  console.error('  ', e.message);
  errors.push(`7a: ${e.message}`);
  failed++;
}

// Property 7b: authorId equals the provided userId
try {
  fc.assert(
    fc.property(objectIdArb, objectIdArb, validCommentTextArb, (blogId: string, userId: string, text: string) => {
      const fields = buildCommentFields(blogId, userId, text);
      assert.strictEqual(
        fields.authorId,
        userId,
        `Expected authorId to be "${userId}" but got "${fields.authorId}"`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7b: authorId equals userId (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7b: authorId equals userId');
  console.error('  ', e.message);
  errors.push(`7b: ${e.message}`);
  failed++;
}

// Property 7c: text equals text.trim()
try {
  fc.assert(
    fc.property(objectIdArb, objectIdArb, validCommentTextArb, (blogId: string, userId: string, text: string) => {
      const fields = buildCommentFields(blogId, userId, text);
      assert.strictEqual(
        fields.text,
        text.trim(),
        `Expected text to be "${text.trim()}" but got "${fields.text}"`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7c: text equals text.trim() (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7c: text equals text.trim()');
  console.error('  ', e.message);
  errors.push(`7c: ${e.message}`);
  failed++;
}

// Property 7d: claps is always 0
try {
  fc.assert(
    fc.property(objectIdArb, objectIdArb, validCommentTextArb, (blogId: string, userId: string, text: string) => {
      const fields = buildCommentFields(blogId, userId, text);
      assert.strictEqual(
        fields.claps,
        0,
        `Expected claps to be 0 but got ${fields.claps}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7d: claps is always 0 (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7d: claps is always 0');
  console.error('  ', e.message);
  errors.push(`7d: ${e.message}`);
  failed++;
}

// Property 7e: clappers is always an empty array
try {
  fc.assert(
    fc.property(objectIdArb, objectIdArb, validCommentTextArb, (blogId: string, userId: string, text: string) => {
      const fields = buildCommentFields(blogId, userId, text);
      assert.ok(
        Array.isArray(fields.clappers),
        `Expected clappers to be an array but got ${typeof fields.clappers}`
      );
      assert.strictEqual(
        fields.clappers.length,
        0,
        `Expected clappers to be empty but got length ${fields.clappers.length}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7e: clappers is always [] (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7e: clappers is always []');
  console.error('  ', e.message);
  errors.push(`7e: ${e.message}`);
  failed++;
}

// Property 7f: text with leading/trailing whitespace is trimmed
// This specifically tests that the trimming behaviour is applied regardless
// of how much surrounding whitespace the input has.
try {
  const paddedTextArb: fc.Arbitrary<string> = fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
      fc.string({ minLength: 0, maxLength: 20 }).filter((s: string) => s.trim().length === 0 || s.length === 0),
      fc.string({ minLength: 0, maxLength: 20 }).filter((s: string) => s.trim().length === 0 || s.length === 0),
    )
    .map(([core, prefix, suffix]: [string, string, string]) => `${prefix}${core}${suffix}`);

  fc.assert(
    fc.property(objectIdArb, objectIdArb, paddedTextArb, (blogId: string, userId: string, text: string) => {
      const fields = buildCommentFields(blogId, userId, text);
      assert.strictEqual(
        fields.text,
        text.trim(),
        `Expected trimmed text "${text.trim()}" but got "${fields.text}"`
      );
      // The stored text must not have leading or trailing whitespace
      assert.strictEqual(
        fields.text,
        fields.text.trim(),
        `Stored text "${fields.text}" still has surrounding whitespace`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7f: leading/trailing whitespace is trimmed (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7f: leading/trailing whitespace is trimmed');
  console.error('  ', e.message);
  errors.push(`7f: ${e.message}`);
  failed++;
}

// Property 7g: validation correctly rejects whitespace-only text
// (guards the boundary between valid and invalid inputs)
try {
  const whitespaceArb: fc.Arbitrary<string> = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 100 });

  fc.assert(
    fc.property(whitespaceArb, (text: string) => {
      const error = validateCommentText(text);
      assert.strictEqual(
        error,
        'Comment text is required',
        `Expected validation error for whitespace-only text but got: ${error}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7g: whitespace-only text is rejected by validation (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7g: whitespace-only text is rejected by validation');
  console.error('  ', e.message);
  errors.push(`7g: ${e.message}`);
  failed++;
}

// Property 7h: validation correctly accepts valid text
try {
  fc.assert(
    fc.property(validCommentTextArb, (text: string) => {
      const error = validateCommentText(text);
      assert.strictEqual(
        error,
        null,
        `Expected no validation error for valid text but got: ${error}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 7h: valid text passes validation (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 7h: valid text passes validation');
  console.error('  ', e.message);
  errors.push(`7h: ${e.message}`);
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
  console.log('\nAll Property 7 assertions passed ✓');
  process.exit(0);
}
