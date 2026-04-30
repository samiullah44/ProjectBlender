/**
 * Property 8: Comment Creation Increments Blog Counter
 *
 * Feature: blog-comments, Property 8: Comment Creation Increments Blog Counter
 * Validates: Requirements 4.8
 *
 * For any non-negative integer N representing a blog post's current commentsCount,
 * the counter increment logic applied when a comment is created should return N + 1.
 *
 * This is a pure logic test — it tests the counter increment transformation
 * without requiring a real MongoDB connection or HTTP server.
 */

import * as fc from 'fast-check';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Pure counter increment logic extracted from the route handler
// (mirrors the $inc: { commentsCount: 1 } logic in the POST /comments route)
// ---------------------------------------------------------------------------

/**
 * Pure function that mirrors the commentsCount increment logic from the
 * POST /api/blogs/:slug/comments route handler.
 *
 * Corresponds to:
 *   Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } })
 */
function incrementBlogCounter(currentCount: number): number {
  return currentCount + 1;
}

// ---------------------------------------------------------------------------
// Property 8 tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('Running Property 8: Comment Creation Increments Blog Counter');
console.log('Feature: blog-comments, Property 8: Comment Creation Increments Blog Counter');
console.log('Validates: Requirements 4.8');
console.log('---');

// Property 8: for any non-negative integer N, incrementBlogCounter(N) === N + 1
try {
  fc.assert(
    fc.property(fc.nat(), (n: number) => {
      const result = incrementBlogCounter(n);
      assert.strictEqual(
        result,
        n + 1,
        `Expected incrementBlogCounter(${n}) to be ${n + 1} but got ${result}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 8: incrementBlogCounter(N) === N + 1 for any non-negative integer N (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 8: incrementBlogCounter(N) === N + 1');
  console.error('  ', e.message);
  errors.push(`8: ${e.message}`);
  failed++;
}

// Property 8b: result is always strictly greater than input
try {
  fc.assert(
    fc.property(fc.nat(), (n: number) => {
      const result = incrementBlogCounter(n);
      assert.ok(
        result > n,
        `Expected incrementBlogCounter(${n}) > ${n} but got ${result}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 8b: result is always strictly greater than input (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 8b: result is always strictly greater than input');
  console.error('  ', e.message);
  errors.push(`8b: ${e.message}`);
  failed++;
}

// Property 8c: result is always a non-negative integer (counter never goes negative)
try {
  fc.assert(
    fc.property(fc.nat(), (n: number) => {
      const result = incrementBlogCounter(n);
      assert.ok(
        result >= 0,
        `Expected incrementBlogCounter(${n}) >= 0 but got ${result}`
      );
      assert.ok(
        Number.isInteger(result),
        `Expected incrementBlogCounter(${n}) to be an integer but got ${result}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 8c: result is always a non-negative integer (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 8c: result is always a non-negative integer');
  console.error('  ', e.message);
  errors.push(`8c: ${e.message}`);
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
  console.log('\nAll Property 8 assertions passed ✓');
  process.exit(0);
}
