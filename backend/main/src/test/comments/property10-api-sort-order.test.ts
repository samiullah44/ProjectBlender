/**
 * Property 10: Comment List API Sort Order
 *
 * Feature: blog-comments, Property 10: Comment List API Sort Order
 * Validates: Requirements 5.3
 *
 * For any array of comments with distinct createdAt timestamps, the sort
 * function applied by the GET /api/blogs/:slug/comments endpoint should
 * return them in descending order by createdAt (newest first), regardless
 * of the order they are provided.
 *
 * This is a pure logic test — it tests the sort transformation
 * without requiring a real MongoDB connection or HTTP server.
 */

import * as fc from 'fast-check';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Pure sort logic extracted from the route handler
// (mirrors the { sort: { createdAt: -1 } } query in GET /comments)
// ---------------------------------------------------------------------------

interface CommentWithTimestamp {
  createdAt: string;
}

/**
 * Pure function that mirrors the sort order applied by the
 * GET /api/blogs/:slug/comments route handler.
 *
 * Corresponds to:
 *   Comment.find({ blogId }).sort({ createdAt: -1 })
 *
 * Sorts an array of comments by createdAt descending (newest first).
 */
function sortCommentsByCreatedAtDesc<T extends CommentWithTimestamp>(comments: T[]): T[] {
  return [...comments].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA; // descending: newer dates first
  });
}

/**
 * Checks whether an array of comments is sorted by createdAt descending.
 */
function isSortedDescending(comments: CommentWithTimestamp[]): boolean {
  for (let i = 0; i < comments.length - 1; i++) {
    const a = comments[i];
    const b = comments[i + 1];
    if (!a || !b) continue;
    const current = new Date(a.createdAt).getTime();
    const next = new Date(b.createdAt).getTime();
    if (current < next) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates an array of comment-like objects with distinct createdAt timestamps.
 * Uses fc.uniqueArray with a date arbitrary to ensure all timestamps are distinct.
 */
const commentsWithDistinctTimestampsArb: fc.Arbitrary<Array<{ createdAt: string }>> = fc
  .uniqueArray(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
    { minLength: 2, maxLength: 20 }
  )
  .map((dates) =>
    dates.map((d) => ({ createdAt: d.toISOString() }))
  );

// ---------------------------------------------------------------------------
// Property 10 tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('Running Property 10: Comment List API Sort Order');
console.log('Feature: blog-comments, Property 10: Comment List API Sort Order');
console.log('Validates: Requirements 5.3');
console.log('---');

// Property 10: for any array of comments with distinct createdAt timestamps,
// the sorted result is in descending order
try {
  fc.assert(
    fc.property(commentsWithDistinctTimestampsArb, (comments) => {
      const sorted = sortCommentsByCreatedAtDesc(comments);

      // Result should be sorted descending
      assert.ok(
        isSortedDescending(sorted),
        `Expected sorted comments to be in descending order by createdAt`
      );

      // Result should have the same length as input
      assert.strictEqual(
        sorted.length,
        comments.length,
        `Expected sorted array to have same length as input (${comments.length}) but got ${sorted.length}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 10: sorted comments are in descending createdAt order (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 10: sorted comments are in descending createdAt order');
  console.error('  ', e.message);
  errors.push(`10: ${e.message}`);
  failed++;
}

// Property 10b: sort is a permutation — no elements are added or removed
try {
  fc.assert(
    fc.property(commentsWithDistinctTimestampsArb, (comments) => {
      const sorted = sortCommentsByCreatedAtDesc(comments);

      // Every input timestamp should appear in the output
      const inputTimestamps = new Set(comments.map((c) => c.createdAt));
      const outputTimestamps = new Set(sorted.map((c) => c.createdAt));

      assert.strictEqual(
        inputTimestamps.size,
        outputTimestamps.size,
        `Expected same number of distinct timestamps after sort`
      );

      for (const ts of inputTimestamps) {
        assert.ok(
          outputTimestamps.has(ts),
          `Expected timestamp "${ts}" to be present in sorted output`
        );
      }
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 10b: sort is a permutation — no elements added or removed (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 10b: sort is a permutation — no elements added or removed');
  console.error('  ', e.message);
  errors.push(`10b: ${e.message}`);
  failed++;
}

// Property 10c: first element has the most recent timestamp
try {
  fc.assert(
    fc.property(commentsWithDistinctTimestampsArb, (comments) => {
      const sorted = sortCommentsByCreatedAtDesc(comments);
      const maxTimestamp = Math.max(...comments.map((c) => new Date(c.createdAt).getTime()));
      const firstSorted = sorted[0];

      assert.ok(firstSorted !== undefined, 'Expected sorted array to have at least one element');
      assert.strictEqual(
        new Date(firstSorted.createdAt).getTime(),
        maxTimestamp,
        `Expected first element to have the most recent timestamp`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 10c: first element always has the most recent timestamp (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 10c: first element always has the most recent timestamp');
  console.error('  ', e.message);
  errors.push(`10c: ${e.message}`);
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
  console.log('\nAll Property 10 assertions passed ✓');
  process.exit(0);
}
