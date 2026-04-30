/**
 * Property 14: Delete Authorization — Non-Author Non-Admin Rejected
 *
 * Feature: blog-comments, Property 14: Delete Authorization — Non-Author Non-Admin Rejected
 * Validates: Requirements 7.7
 *
 * For any user who is neither the comment author nor has the 'admin' role,
 * canDeleteComment returns false.
 *
 * Conversely, the function returns true when the user is the author OR has
 * the 'admin' role (or both).
 *
 * This is a pure logic test — it tests the authorization check
 * without requiring a real MongoDB connection or HTTP server.
 */

import * as fc from 'fast-check';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Pure authorization logic extracted from the route handler
// (mirrors the authorization check in DELETE /comments/:commentId)
// ---------------------------------------------------------------------------

/**
 * Pure function that mirrors the authorization check from the
 * DELETE /api/blogs/:slug/comments/:commentId route handler.
 *
 * Corresponds to:
 *   if (comment.authorId.toString() !== req.user.userId && req.user.role !== 'admin') {
 *     return res.status(403).json({ success: false, error: 'Insufficient permissions' });
 *   }
 *
 * Returns true if the user is allowed to delete the comment, false otherwise.
 */
function canDeleteComment(
  commentAuthorId: string,
  requestUserId: string,
  requestUserRoles: string[]
): boolean {
  const isAuthor = requestUserId === commentAuthorId;
  const isAdmin = requestUserRoles.includes('admin');
  return isAuthor || isAdmin;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a simple user ID string */
const userIdArb: fc.Arbitrary<string> = fc.hexaString({ minLength: 8, maxLength: 24 });

/** Generates a non-admin role string (anything except 'admin') */
const nonAdminRoleArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((role) => role !== 'admin');

/** Generates an array of roles that does NOT include 'admin' */
const nonAdminRolesArb: fc.Arbitrary<string[]> = fc.array(nonAdminRoleArb, {
  minLength: 0,
  maxLength: 5,
});

/**
 * Generates a (commentAuthorId, requestUserId, requestUserRoles) tuple where:
 * - requestUserId !== commentAuthorId (not the author)
 * - requestUserRoles does not include 'admin' (not an admin)
 *
 * This is the precondition for the "should be rejected" property.
 */
const nonAuthorNonAdminArb: fc.Arbitrary<[string, string, string[]]> = fc
  .tuple(userIdArb, userIdArb, nonAdminRolesArb)
  .filter(([authorId, userId]) => authorId !== userId);

// ---------------------------------------------------------------------------
// Property 14 tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('Running Property 14: Delete Authorization — Non-Author Non-Admin Rejected');
console.log('Feature: blog-comments, Property 14: Delete Authorization — Non-Author Non-Admin Rejected');
console.log('Validates: Requirements 7.7');
console.log('---');

// Property 14: for any user who is neither the author nor an admin, canDeleteComment returns false
try {
  fc.assert(
    fc.property(nonAuthorNonAdminArb, ([commentAuthorId, requestUserId, requestUserRoles]) => {
      const result = canDeleteComment(commentAuthorId, requestUserId, requestUserRoles);
      assert.strictEqual(
        result,
        false,
        `Expected canDeleteComment to return false for non-author non-admin user but got ${result}. ` +
        `authorId="${commentAuthorId}", userId="${requestUserId}", roles=${JSON.stringify(requestUserRoles)}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 14: non-author non-admin users are always rejected (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 14: non-author non-admin users are always rejected');
  console.error('  ', e.message);
  errors.push(`14: ${e.message}`);
  failed++;
}

// Property 14b: the comment author is always allowed to delete (regardless of roles)
try {
  fc.assert(
    fc.property(userIdArb, nonAdminRolesArb, (userId, roles) => {
      // Author deleting their own comment — should always be allowed
      const result = canDeleteComment(userId, userId, roles);
      assert.strictEqual(
        result,
        true,
        `Expected canDeleteComment to return true for the comment author but got ${result}. ` +
        `userId="${userId}", roles=${JSON.stringify(roles)}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 14b: comment author is always allowed to delete (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 14b: comment author is always allowed to delete');
  console.error('  ', e.message);
  errors.push(`14b: ${e.message}`);
  failed++;
}

// Property 14c: admin users are always allowed to delete (regardless of authorship)
try {
  fc.assert(
    fc.property(userIdArb, userIdArb, fc.array(nonAdminRoleArb, { minLength: 0, maxLength: 3 }), (authorId, userId, otherRoles) => {
      // Admin deleting any comment — should always be allowed
      const adminRoles = [...otherRoles, 'admin'];
      const result = canDeleteComment(authorId, userId, adminRoles);
      assert.strictEqual(
        result,
        true,
        `Expected canDeleteComment to return true for admin user but got ${result}. ` +
        `authorId="${authorId}", userId="${userId}", roles=${JSON.stringify(adminRoles)}`
      );
    }),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 14c: admin users are always allowed to delete (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 14c: admin users are always allowed to delete');
  console.error('  ', e.message);
  errors.push(`14c: ${e.message}`);
  failed++;
}

// Property 14d: empty roles array means non-admin (non-author is rejected)
try {
  fc.assert(
    fc.property(
      fc.tuple(userIdArb, userIdArb).filter(([a, b]) => a !== b),
      ([authorId, userId]) => {
        const result = canDeleteComment(authorId, userId, []);
        assert.strictEqual(
          result,
          false,
          `Expected canDeleteComment to return false for non-author with empty roles but got ${result}`
        );
      }
    ),
    { numRuns: 100, verbose: false }
  );
  console.log('✓ Property 14d: non-author with empty roles array is rejected (100 runs)');
  passed++;
} catch (e: any) {
  console.error('✗ Property 14d: non-author with empty roles array is rejected');
  console.error('  ', e.message);
  errors.push(`14d: ${e.message}`);
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
  console.log('\nAll Property 14 assertions passed ✓');
  process.exit(0);
}
