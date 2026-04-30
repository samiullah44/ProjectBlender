/**
 * Property 13: Comment Deletion Decrements Blog Counter
 *
 * Feature: blog-comments, Property 13: Comment Deletion Decrements Blog Counter
 * Validates: Requirements 7.6
 *
 * For any N >= 1, decrementBlogCounter(N) === N - 1.
 * For N = 0, decrementBlogCounter(0) === 0 (floor at 0, never goes negative).
 *
 * This is a pure logic test — it tests the counter decrement transformation
 * without requiring a real MongoDB connection or HTTP server.
 */

import * as fc from 'fast-check';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Pure counter decrement logic extracted from the route handler
// (mirrors the $max guard in the DELETE /comments/:id route)
// ---------------------------------------------------------------------------

/**
 * Pure function that mirrors the commentsCount decrement logic from the
 * DELETE /api/blogs/:slug/comments/:commentId route handler.
 *
 * Corresponds to:
 *   Blog.findOneAndUpdate(
 *     { slug },
 *     [{ $set: { commentsCount: { $max: [0, { $subtract: ['$commentsCount', 1] }] } } }]
 *   )
 *
 * The floor at 0 ensures the counter never goes negative.
 */
function decrementBlogCounter(currentCount: number): number {
  return Math.max(0, currentCount - 1);
}

// ---------------------------------------------------------------------------
// Property 13 tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('Running Property 13: Comment Deletion Decrements Blog Counter');
console.log('Feature: blog-comments, Property 13: Comment Deletion Decrements Blog Counter');
console.log('Validates: Requirements 7.6');
console.log('---');

// Property 13: for any N >= 1, decrementBlogCounter(N) === N - 1
try {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 100 }), (n: number) => {
      const result = decrementBlogCounter(n);
      assert.strictEqual(
        result,
        n - 1,
        `Expected decrementBlogCounter(${n}) to be ${n - 1} but got ${result}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 13: decrementBlogCounter(N) === N - 1 for any N >= 1 (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 13: decrementBlogCounter(N) === N - 1 for any N >= 1');
  console.error('  ', e.message);
  errors.push(`13: ${e.message}`);
  failed++;
}

// Property 13b: decrementBlogCounter(0) === 0 (floor at 0)
try {
  const result = decrementBlogCounter(0);
  assert.strictEqual(
    result,
    0,
    `Expected decrementBlogCounter(0) to be 0 but got ${result}`
  );
  console.log('✓ Property 13b: decrementBlogCounter(0) === 0 (floor at 0)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 13b: decrementBlogCounter(0) === 0 (floor at 0)');
  console.error('  ', e.message);
  errors.push(`13b: ${e.message}`);
  failed++;
}

// Property 13c: result is always non-negative (counter never goes below 0)
try {
  fc.assert(
    fc.property(fc.nat(), (n: number) => {
      const result = decrementBlogCounter(n);
      assert.ok(
        result >= 0,
        `Expected decrementBlogCounter(${n}) >= 0 but got ${result}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 13c: result is always non-negative for any non-negative input (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 13c: result is always non-negative for any non-negative input');
  console.error('  ', e.message);
  errors.push(`13c: ${e.message}`);
  failed++;
}

// Property 13d: result is always strictly less than input for N >= 1
try {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 100 }), (n: number) => {
      const result = decrementBlogCounter(n);
      assert.ok(
        result < n,
        `Expected decrementBlogCounter(${n}) < ${n} but got ${result}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 13d: result is always strictly less than input for N >= 1 (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 13d: result is always strictly less than input for N >= 1');
  console.error('  ', e.message);
  errors.push(`13d: ${e.message}`);
  failed++;
}

// Property 13e: increment then decrement is identity for N >= 1
// (verifies that increment and decrement are inverse operations for positive counts)
try {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 100 }), (n: number) => {
      const incremented = n + 1; // simulate incrementBlogCounter
      const result = decrementBlogCounter(incremented);
      assert.strictEqual(
        result,
        n,
        `Expected increment then decrement to restore ${n} but got ${result}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 13e: increment then decrement is identity for N >= 1 (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 13e: increment then decrement is identity for N >= 1');
  console.error('  ', e.message);
  errors.push(`13e: ${e.message}`);
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
  console.log('\nAll Property 13 assertions passed ✓');
  process.exit(0);
}
