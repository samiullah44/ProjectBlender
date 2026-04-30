/**
 * Property 12: Clap/Unclap Round Trip
 *
 * Feature: blog-comments, Property 12: Clap/Unclap Round Trip
 * Validates: Requirements 6.7, 6.9
 *
 * For any comment and any user who is not currently in the comment's clappers
 * array, performing a clap followed by an unclap should restore the comment
 * to its original state: the user is not in clappers and claps equals the
 * original value.
 *
 * This is a pure logic test — it tests the round-trip property of the
 * clap/unclap transformation without requiring a real MongoDB connection
 * or HTTP server.
 */

import * as fc from 'fast-check';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Pure clap/unclap logic (same as property11)
// ---------------------------------------------------------------------------

interface CommentClapState {
  claps: number;
  clappers: string[];
}

/**
 * Pure function that mirrors the clap logic from the
 * POST /api/blogs/:slug/comments/:commentId/clap route handler.
 *
 * Returns the updated comment state, or null if the user already clapped.
 */
function applyClap(comment: CommentClapState, userId: string): CommentClapState | null {
  if (comment.clappers.includes(userId)) {
    return null; // user already clapped — would return 409 in the API
  }
  return {
    claps: comment.claps + 1,
    clappers: [...comment.clappers, userId],
  };
}

/**
 * Pure function that mirrors the unclap logic from the
 * DELETE /api/blogs/:slug/comments/:commentId/clap route handler.
 *
 * Returns the updated comment state, or null if the user had not clapped.
 */
function applyUnclap(comment: CommentClapState, userId: string): CommentClapState | null {
  if (!comment.clappers.includes(userId)) {
    return null; // user had not clapped — would return 409 in the API
  }
  return {
    claps: comment.claps - 1,
    clappers: comment.clappers.filter((id) => id !== userId),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a simple user ID string */
const userIdArb: fc.Arbitrary<string> = fc.hexaString({ minLength: 8, maxLength: 24 });

/** Generates a set of distinct user IDs for existing clappers */
const existingClappersArb: fc.Arbitrary<string[]> = fc.uniqueArray(
  fc.hexaString({ minLength: 8, maxLength: 24 }),
  { minLength: 0, maxLength: 5 }
);

/**
 * Generates a (comment, userId) pair where userId is NOT in comment.clappers.
 * This is the precondition for the round-trip property.
 */
const commentAndNewUserArb: fc.Arbitrary<[CommentClapState, string]> = fc
  .tuple(existingClappersArb, userIdArb)
  .filter(([clappers, userId]) => !clappers.includes(userId))
  .map(([clappers, userId]) => [
    { claps: clappers.length, clappers },
    userId,
  ]);

// ---------------------------------------------------------------------------
// Property 12 tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('Running Property 12: Clap/Unclap Round Trip');
console.log('Feature: blog-comments, Property 12: Clap/Unclap Round Trip');
console.log('Validates: Requirements 6.7, 6.9');
console.log('---');

// Property 12: for any comment and user not in clappers, clap then unclap restores original state
try {
  fc.assert(
    fc.property(commentAndNewUserArb, ([originalComment, userId]) => {
      // Step 1: clap
      const afterClap = applyClap(originalComment, userId);
      assert.ok(
        afterClap !== null,
        `Expected applyClap to succeed for user "${userId}" not in clappers`
      );

      // Step 2: unclap
      const afterUnclap = applyUnclap(afterClap!, userId);
      assert.ok(
        afterUnclap !== null,
        `Expected applyUnclap to succeed after clapping`
      );

      // Verify round-trip: claps restored to original value
      assert.strictEqual(
        afterUnclap!.claps,
        originalComment.claps,
        `Expected claps to be restored to ${originalComment.claps} after round trip but got ${afterUnclap!.claps}`
      );

      // Verify round-trip: user not in clappers
      assert.ok(
        !afterUnclap!.clappers.includes(userId),
        `Expected user "${userId}" to not be in clappers after unclap`
      );

      // Verify round-trip: clappers.length restored to original value
      assert.strictEqual(
        afterUnclap!.clappers.length,
        originalComment.clappers.length,
        `Expected clappers.length to be restored to ${originalComment.clappers.length} after round trip but got ${afterUnclap!.clappers.length}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 12: clap then unclap restores original state (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 12: clap then unclap restores original state');
  console.error('  ', e.message);
  errors.push(`12: ${e.message}`);
  failed++;
}

// Property 12b: other clappers are unaffected by the round trip
try {
  fc.assert(
    fc.property(commentAndNewUserArb, ([originalComment, userId]) => {
      const afterClap = applyClap(originalComment, userId);
      assert.ok(afterClap !== null);

      const afterUnclap = applyUnclap(afterClap!, userId);
      assert.ok(afterUnclap !== null);

      // All original clappers should still be present
      for (const originalClapper of originalComment.clappers) {
        assert.ok(
          afterUnclap!.clappers.includes(originalClapper),
          `Expected original clapper "${originalClapper}" to still be in clappers after round trip`
        );
      }
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 12b: other clappers are unaffected by the round trip (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 12b: other clappers are unaffected by the round trip');
  console.error('  ', e.message);
  errors.push(`12b: ${e.message}`);
  failed++;
}

// Property 12c: double clap is rejected (idempotency guard)
try {
  fc.assert(
    fc.property(commentAndNewUserArb, ([originalComment, userId]) => {
      const afterFirstClap = applyClap(originalComment, userId);
      assert.ok(afterFirstClap !== null, 'First clap should succeed');

      // Second clap by the same user should be rejected
      const afterSecondClap = applyClap(afterFirstClap!, userId);
      assert.strictEqual(
        afterSecondClap,
        null,
        `Expected second clap by same user to be rejected (return null)`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 12c: double clap by same user is rejected (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 12c: double clap by same user is rejected');
  console.error('  ', e.message);
  errors.push(`12c: ${e.message}`);
  failed++;
}

// Property 12d: unclap without prior clap is rejected
try {
  fc.assert(
    fc.property(commentAndNewUserArb, ([originalComment, userId]) => {
      // userId is not in clappers, so unclap should be rejected
      const result = applyUnclap(originalComment, userId);
      assert.strictEqual(
        result,
        null,
        `Expected unclap without prior clap to be rejected (return null)`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 12d: unclap without prior clap is rejected (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 12d: unclap without prior clap is rejected');
  console.error('  ', e.message);
  errors.push(`12d: ${e.message}`);
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
  console.log('\nAll Property 12 assertions passed ✓');
  process.exit(0);
}
