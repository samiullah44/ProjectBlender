# Implementation Plan: Blog Comments

## Overview

Implement the Blog Comments feature in four phases: backend data layer and API (Comment model, Blog model update, comment routes), frontend state layer (TanStack Query hooks and types), frontend UI components (CommentSection, CommentList, CommentItem, ResponseInput, ClapButton, DeleteMenu, BottomActionBar), and property-based tests with fast-check. The stack is TypeScript throughout — Express + Mongoose on the backend, React + Tailwind on the frontend.

---

## Tasks

- [x] 1. Backend data layer — Comment model and Blog model update
  - [x] 1.1 Create `Comment.ts` Mongoose model
    - Create `backend/main/src/models/Comment.ts`
    - Define `IComment` interface with fields: `blogId` (ObjectId, ref: `Blog`), `authorId` (ObjectId, ref: `User`), `text` (String, max 1000, trim), `claps` (Number, default 0), `clappers` (ObjectId[], ref: `User`, default [])
    - Implement `commentSchema` with `timestamps: true`
    - Add compound index `{ blogId: 1, createdAt: -1 }` and single index `{ authorId: 1 }`
    - Export `Comment` model
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 1.2 Add `commentsCount` field to `Blog.ts` model
    - Add `commentsCount: number` to the `IBlog` interface (default 0)
    - Add `commentsCount: { type: Number, default: 0, min: 0 }` to `blogSchema`
    - _Requirements: 9.4, 10.1_

- [x] 2. Backend API — comment routes
  - [x] 2.1 Create `comments.ts` route file with `GET /api/blogs/:slug/comments`
    - Create `backend/main/src/routes/api/comments.ts` using `express.Router({ mergeParams: true })`
    - Implement `GET /:slug/comments`: find blog by slug (any status for lookup, but return 404 if not found), fetch all comments for that `blogId` sorted by `createdAt: -1`, populate `authorId` with `name username` fields only, return `{ success: true, comments }`
    - No authentication required for this endpoint
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 2.2 Implement `POST /api/blogs/:slug/comments` in `comments.ts`
    - Apply `authenticate` middleware to this route
    - Validate: find blog by `{ slug, status: 'PUBLISHED' }` — return 404 if not found
    - Validate text: trim, reject empty/whitespace (400), reject > 1000 chars (400)
    - Create `Comment` document with `blogId`, `authorId: req.user.userId`, `text: text.trim()`, `claps: 0`, `clappers: []`
    - Atomically increment `blog.commentsCount` using `Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } })`
    - Populate `authorId` on the new comment and return `{ success: true, comment }` with status 201
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 11.1_

  - [x] 2.3 Implement `DELETE /api/blogs/:slug/comments/:commentId` in `comments.ts`
    - Apply `authenticate` middleware
    - Find comment by `_id: commentId` — return 404 if not found
    - Authorization check: if `comment.authorId.toString() !== req.user.userId` AND `req.user.role !== 'admin'`, return 403
    - Delete the comment document
    - Atomically decrement `blog.commentsCount` (floor 0): `Blog.findOneAndUpdate({ slug }, [{ $set: { commentsCount: { $max: [0, { $subtract: ['$commentsCount', 1] }] } } }])`
    - Return `{ success: true, message: 'Comment deleted' }`
    - _Requirements: 7.5, 7.6, 7.7, 7.8, 7.9, 11.2_

  - [x] 2.4 Implement `POST /api/blogs/:slug/comments/:commentId/clap` in `comments.ts`
    - Apply `authenticate` middleware
    - Use atomic update: `Comment.findOneAndUpdate({ _id: commentId, clappers: { $ne: userId } }, { $addToSet: { clappers: userId }, $inc: { claps: 1 } }, { new: true })`
    - If result is null: check if comment exists at all — if not, return 404; if it exists but user already clapped, return 409 `{ "success": false, "error": "Already clapped" }`
    - Return `{ success: true, claps: comment.claps, hasClapped: true }`
    - _Requirements: 6.7, 6.8, 11.3_

  - [x] 2.5 Implement `DELETE /api/blogs/:slug/comments/:commentId/clap` in `comments.ts`
    - Apply `authenticate` middleware
    - Use atomic update: `Comment.findOneAndUpdate({ _id: commentId, clappers: userId }, { $pull: { clappers: userId }, $inc: { claps: -1 } }, { new: true })`
    - If result is null: check if comment exists — if not, return 404; if it exists but user had not clapped, return 409 `{ "success": false, "error": "Not clapped yet" }`
    - Return `{ success: true, claps: comment.claps, hasClapped: false }`
    - _Requirements: 6.9, 6.10, 11.4_

  - [x] 2.6 Mount comment routes in `app.ts`
    - Import `commentsRouter` from `./routes/api/comments`
    - In the `routePrefixes.forEach` loop, add: `app.use(\`\${prefix}/blogs\`, commentsRouter)`
    - This mounts comment endpoints at both `/api/blogs/:slug/comments` and `/blogs/:slug/comments`, consistent with the existing dual-prefix pattern
    - _Requirements: 5.2, 4.6, 7.5_

- [x] 3. Checkpoint — backend complete
  - Ensure all backend TypeScript compiles without errors (`tsc --noEmit` in `backend/main`)
  - Verify all 5 comment endpoints are reachable and the `Comment` model is registered
  - Ask the user if questions arise before proceeding to frontend.

- [x] 4. Frontend types and API hooks
  - [x] 4.1 Add `IComment` type and extend `BlogPostData` interface
    - Create `frontend/src/types/comment.ts` with the `IComment` interface matching the API response shape (populated `authorId` with `_id`, `name`, `username`)
    - In `frontend/src/pages/blog/BlogPost.tsx`, add `commentsCount: number` to the `BlogPostData` interface
    - _Requirements: 9.1, 10.1_

  - [x] 4.2 Create `useComments` query hook
    - Create `frontend/src/hooks/useComments.ts`
    - Implement `useComments(slug: string)` using `useQuery` with key `['comments', slug]`
    - Fetch from `GET /api/blogs/${slug}/comments`, return `r.data.comments as IComment[]`
    - _Requirements: 5.1, 5.2_

  - [x] 4.3 Create `usePostComment` mutation hook
    - In `frontend/src/hooks/useComments.ts`, implement `usePostComment(slug: string)`
    - On success: prepend new comment to `['comments', slug]` cache; increment `commentsCount` in `['blogPost', slug]` cache optimistically
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.4 Create `useDeleteComment` mutation hook
    - In `frontend/src/hooks/useComments.ts`, implement `useDeleteComment(slug: string)`
    - On success: filter deleted comment from `['comments', slug]` cache; decrement `commentsCount` (floor 0) in `['blogPost', slug]` cache
    - _Requirements: 7.3, 7.4_

  - [x] 4.5 Create `useClapComment` and `useUnClapComment` mutation hooks
    - In `frontend/src/hooks/useComments.ts`, implement both hooks with optimistic updates using `onMutate` / `onError` rollback pattern
    - `useClapComment`: optimistically increment `claps` on the target comment in `['comments', slug]` cache
    - `useUnClapComment`: optimistically decrement `claps` on the target comment in `['comments', slug]` cache
    - Both hooks roll back on error via `context.previous`
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [x] 5. Frontend UI — CommentSection and ResponseInput
  - [x] 5.1 Create `CommentSection` component
    - Create `frontend/src/components/blog/comments/CommentSection.tsx`
    - Accept props: `slug: string`, `initialCount: number`
    - Use `useComments(slug)` to fetch comments; derive live count from `useQuery(['blogPost', slug])` cache (falls back to `initialCount`)
    - Render "Responses (N)" heading using the live count
    - Render `ResponseInput` (when authenticated) or sign-in prompt (when not)
    - Render `CommentList` with loading skeleton, error state with Retry button, and empty state message
    - Attach a `ref` (forwarded from `BlogPost`) to the section wrapper `<div>` for scroll targeting
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.5, 5.6_

  - [x] 5.2 Create `ResponseInput` component
    - Create `frontend/src/components/blog/comments/ResponseInput.tsx`
    - Accept props: `slug: string`, `currentUser: { id: string; name: string } | null`
    - When `currentUser` is null: render sign-in prompt with text "Sign in to leave a response" and a `<Link to="/login">` (or the main app login URL)
    - When authenticated: render avatar initial circle, `<textarea>` with placeholder "What are your thoughts?", live character count display `"N / 1000"`, and "Respond" submit button
    - "Respond" button is disabled when input is empty or whitespace-only, and while submission is in flight (show loading spinner)
    - On submit: call `usePostComment` mutation; on success clear input; on error display error message below input and preserve typed text
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.4, 4.5_

- [x] 6. Frontend UI — CommentList and CommentItem
  - [x] 6.1 Create `CommentList` component
    - Create `frontend/src/components/blog/comments/CommentList.tsx`
    - Accept props: `comments: IComment[]`, `isLoading: boolean`, `isError: boolean`, `onRetry: () => void`, `currentUserId?: string`, `currentUserRoles?: string[]`, `slug: string`
    - Render skeleton loading state (3 placeholder rows) while `isLoading`
    - Render error message + "Retry" button when `isError`
    - Render empty state message ("No responses yet. Be the first to share your thoughts!") when `comments.length === 0`
    - Map `comments` to `CommentItem` components; comments are already sorted newest-first from the API
    - _Requirements: 2.1, 2.2, 5.5, 5.6_

  - [x] 6.2 Create `CommentItem` component
    - Create `frontend/src/components/blog/comments/CommentItem.tsx`
    - Accept props: `comment: IComment`, `slug: string`, `currentUserId?: string`, `currentUserRoles?: string[]`, `isAuthenticated: boolean`
    - Render: author avatar circle (first letter of `authorId.name`), author display name, formatted `createdAt` date, full comment text (no truncation), `ClapButton`, and `DeleteMenu` (only when `currentUserId === comment.authorId._id` or `currentUserRoles` includes `'admin'`)
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 6.1, 6.2, 7.1_

- [x] 7. Frontend UI — ClapButton and DeleteMenu
  - [x] 7.1 Create `ClapButton` component
    - Create `frontend/src/components/blog/comments/ClapButton.tsx`
    - Accept props: `commentId: string`, `slug: string`, `claps: number`, `hasClapped: boolean`, `isAuthenticated: boolean`
    - Derive `hasClapped` from `comment.clappers.includes(currentUserId)` in the parent (`CommentItem`)
    - When `isAuthenticated`: render interactive button; clicking calls `useClapComment` (if not clapped) or `useUnClapComment` (if already clapped)
    - When not authenticated: render clap count display only (no interactive button)
    - Apply "clapped" visual state (filled icon, accent color) when `hasClapped` is true
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.11_

  - [x] 7.2 Create `DeleteMenu` component
    - Create `frontend/src/components/blog/comments/DeleteMenu.tsx`
    - Accept props: `commentId: string`, `slug: string`
    - Render a "..." (ellipsis) button that opens a small dropdown menu with a "Delete" option
    - On "Delete" click: show an inline confirmation prompt ("Are you sure?") before calling `useDeleteComment` mutation
    - While deletion is in flight: disable the button
    - On error: show a toast notification and restore the comment (TanStack Query rollback handles this automatically)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8. Frontend UI — BottomActionBar
  - [x] 8.1 Create `BottomActionBar` component
    - Create `frontend/src/components/blog/comments/BottomActionBar.tsx`
    - Accept props: `commentCount: number`, `postTitle: string`, `commentSectionRef: React.RefObject<HTMLElement>`
    - Render a fixed bar at the bottom of the viewport (`position: fixed; bottom: 0`)
    - Left side: speech-bubble icon + `commentCount` number; clicking scrolls to `commentSectionRef` via `commentSectionRef.current?.scrollIntoView({ behavior: 'smooth' })`
    - Right side: share button
    - Share button behavior: if `navigator.share` is available, call `navigator.share({ title: postTitle, url: window.location.href })`; otherwise copy URL to clipboard via `navigator.clipboard.writeText`; show "Link copied!" confirmation toast for 2 seconds in both cases
    - `commentCount` is sourced from the `['blogPost', slug]` TanStack Query cache (passed down from `BlogPost`) so it updates optimistically
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 9. Frontend — BlogPost page integration
  - [x] 9.1 Integrate `CommentSection` and `BottomActionBar` into `BlogPost.tsx`
    - Add `commentSectionRef = useRef<HTMLDivElement>(null)` to the `BlogPost` component
    - After the author card section and before the "More Posts" section, insert `<CommentSection slug={slug} initialCount={blog.commentsCount ?? 0} ref={commentSectionRef} />`
    - After the closing `</article>` tag (but inside the page `<div>`), insert `<BottomActionBar commentCount={blog.commentsCount ?? 0} postTitle={blog.title} commentSectionRef={commentSectionRef} />`
    - Pass `commentCount` from the live `['blogPost', slug]` query data so it reflects optimistic updates
    - Add bottom padding to the page to prevent the fixed `BottomActionBar` from overlapping content
    - _Requirements: 1.1, 8.1, 8.7, 10.1_

- [x] 10. Checkpoint — full integration
  - Verify end-to-end: load a blog post → comments load → authenticated user can post a comment → comment appears at top of list → count increments in heading and bottom bar → user can clap → user can delete their own comment → count decrements
  - Verify unauthenticated state: comment list is visible, sign-in prompt shown, clap counts shown but not interactive
  - Ask the user if questions arise before proceeding to property tests.

- [x] 11. Property-based tests with fast-check
  - [x] 11.1 Set up fast-check test infrastructure
    - Verify `fast-check` is available in `frontend/package.json` devDependencies; if not, add it
    - Create `frontend/src/test/comments/` directory for comment PBT files
    - Create `backend/main/src/test/comments/` directory for backend PBT files (or use existing test directory)
    - _Requirements: 9.1_

  - [x] 11.2 Write property test for Comment Heading Count Format (Property 1)
    - Generate arbitrary non-negative integers with `fc.nat()`
    - Render `<CommentSection>` with a mocked query returning N comments
    - Assert the heading text matches exactly `"Responses (N)"`
    - **Property 1: Comment Heading Count Format**
    - **Validates: Requirements 1.2**

  - [x] 11.3 Write property test for Comment List Rendering Completeness (Property 2)
    - Generate random `IComment` objects with `fc.record({ ... })` covering all required fields
    - Render `<CommentItem>` for each generated comment
    - Assert rendered output contains: first char of `authorId.name`, full `authorId.name`, a date string, full `text`, and `claps` as a number
    - **Property 2: Comment List Rendering Completeness**
    - **Validates: Requirements 2.1, 2.3**

  - [x] 11.4 Write property test for Comment List Sort Order (Property 3)
    - Generate arrays of `IComment` objects with distinct `createdAt` timestamps using `fc.array(fc.record({ createdAt: fc.date(), ... }), { minLength: 2 })`
    - Shuffle the array before passing to `<CommentList>`
    - Assert rendered comments appear in descending `createdAt` order
    - **Property 3: Comment List Sort Order**
    - **Validates: Requirements 2.2**

  - [x] 11.5 Write property test for Submit Button Validity Gate (Property 4)
    - Generate arbitrary strings with `fc.string()`
    - Render `<ResponseInput>` with a mock authenticated user
    - Assert: button is disabled iff `text.trim().length === 0`
    - **Property 4: Submit Button Validity Gate**
    - **Validates: Requirements 3.7, 3.8**

  - [x] 11.6 Write property test for Character Count Display (Property 5)
    - Generate strings of length 0–1000 with `fc.string({ maxLength: 1000 })`
    - Render `<ResponseInput>` and simulate typing the generated string
    - Assert the character count display shows `"${text.length} / 1000"`
    - **Property 5: Character Count Display**
    - **Validates: Requirements 3.6**

  - [x] 11.7 Write property test for New Comment Prepend and Count Increment (Property 6)
    - Generate an initial comment list of length N and a new comment object
    - Simulate a successful `usePostComment` mutation response
    - Assert: updated list has length N+1, new comment is first element, heading count shows N+1
    - **Property 6: New Comment Prepend and Count Increment**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 11.8 Write property test for Comment Creation Sets Correct Fields (Property 7)
    - Backend test: generate valid `(slug, userId, text)` tuples where slug matches a seeded PUBLISHED blog
    - Call `POST /api/blogs/:slug/comments` and assert the created document has: correct `blogId`, `authorId === userId`, `text === text.trim()`, `claps === 0`, `clappers === []`
    - **Property 7: Comment Creation Sets Correct Fields**
    - **Validates: Requirements 4.7**

  - [x] 11.9 Write property test for Comment Creation Increments Blog Counter (Property 8)
    - Backend test: seed a blog with a random `commentsCount` N using `fc.nat()`
    - Call `POST /api/blogs/:slug/comments` and assert `blog.commentsCount === N + 1`
    - **Property 8: Comment Creation Increments Blog Counter**
    - **Validates: Requirements 4.8**

  - [x] 11.10 Write property test for Whitespace Comment Rejection (Property 9)
    - Backend test: generate whitespace-only strings with `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))`
    - Call `POST /api/blogs/:slug/comments` with each generated string
    - Assert response is 400 with `{ "success": false, "error": "Comment text is required" }`
    - **Property 9: Whitespace Comment Rejection**
    - **Validates: Requirements 4.9**

  - [x] 11.11 Write property test for Comment List API Sort Order (Property 10)
    - Backend test: insert N comments with random `createdAt` values in arbitrary order
    - Call `GET /api/blogs/:slug/comments` and assert returned array is sorted by `createdAt` descending
    - **Property 10: Comment List API Sort Order**
    - **Validates: Requirements 5.3**

  - [x] 11.12 Write property test for Clap Invariant — claps Equals clappers.length (Property 11)
    - Backend test: generate sequences of clap/unclap operations for a set of users on a single comment
    - After each operation, fetch the comment and assert `comment.claps === comment.clappers.length`
    - **Property 11: Clap Invariant — claps Equals clappers.length**
    - **Validates: Requirements 6.7, 6.9, 9.5**

  - [x] 11.13 Write property test for Clap/Unclap Round Trip (Property 12)
    - Backend test: for any comment and any user not in `clappers`, call `POST /clap` then `DELETE /clap`
    - Assert the comment returns to its original state: user not in `clappers`, `claps` equals original value
    - **Property 12: Clap/Unclap Round Trip**
    - **Validates: Requirements 6.7, 6.9**

  - [x] 11.14 Write property test for Comment Deletion Decrements Blog Counter (Property 13)
    - Backend test: seed a blog with `commentsCount` N (N ≥ 1) using `fc.integer({ min: 1, max: 100 })`
    - Create a comment, then delete it as the comment author
    - Assert `blog.commentsCount === N - 1`
    - **Property 13: Comment Deletion Decrements Blog Counter**
    - **Validates: Requirements 7.6**

  - [x] 11.15 Write property test for Delete Authorization — Non-Author Non-Admin Rejected (Property 14)
    - Backend test: generate comments and users who are neither the comment's `authorId` nor have `admin` role
    - Call `DELETE /api/blogs/:slug/comments/:commentId` as each generated user
    - Assert response is always 403 with `{ "success": false, "error": "Insufficient permissions" }`
    - **Property 14: Delete Authorization — Non-Author Non-Admin Rejected**
    - **Validates: Requirements 7.7**

  - [x] 11.16 Write property test for Bottom Action Bar Count Reflects Optimistic State (Property 15)
    - Frontend test: generate an initial `commentsCount` N using `fc.nat()`
    - Simulate a successful comment submission and assert `BottomActionBar` displays N+1
    - Simulate a successful comment deletion and assert `BottomActionBar` displays N-1 (floor 0)
    - **Property 15: Bottom Action Bar Count Reflects Optimistic State**
    - **Validates: Requirements 8.7**

- [x] 12. Final checkpoint — all tests pass
  - Ensure all TypeScript compiles without errors in both `backend/main` and `frontend`
  - Ensure all non-optional tests pass
  - Ask the user if questions arise.

---

## Notes

- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP
- All frontend components use Tailwind CSS with mobile-first responsive classes
- The `BottomActionBar` uses `position: fixed; bottom: 0` — add `pb-16` (or equivalent) to the page wrapper to prevent content overlap
- Auth state on the blog subdomain is read directly from `useAuthStore` (Zustand persist) — no `AuthInitializer` wrapper needed
- The `commentsCount` field in `BottomActionBar` should be sourced from the live `['blogPost', slug]` TanStack Query cache, not a separate prop, so optimistic updates propagate automatically
- Comment routes use `express.Router({ mergeParams: true })` and are mounted under `/blogs` in `app.ts`, giving paths like `/api/blogs/:slug/comments/:commentId/clap`
- Each property test is tagged: `Feature: blog-comments, Property N: <property_text>`
- fast-check minimum 100 iterations per property test (the default)
