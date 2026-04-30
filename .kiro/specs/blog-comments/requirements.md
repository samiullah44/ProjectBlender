# Requirements Document

## Introduction

The Blog Comments feature adds a responses/comments section to each blog post page on `blog.rendernodes.com`. Inspired by Medium's responses section, it allows authenticated users to post text comments on published blog posts, while all visitors (authenticated or not) can read the comments. Each blog post has its own isolated set of comments. Reply-to-comment threading is explicitly out of scope.

The feature also adds a bottom action bar to the blog post page, displaying a speech-bubble icon with the total comment count and a share button — matching the Medium-style bottom bar pattern.

The existing codebase provides: a `Blog` Mongoose model, public blog routes at `/api/blogs/*`, the `authenticate` and `optionalAuthenticate` middleware, a `User` model with `roles`, and a React/TypeScript frontend with `useAuthStore` for authentication state.

---

## Glossary

- **Comment**: A text response posted by an authenticated user on a specific Blog_Post, containing the author's user ID, display name, avatar initial, timestamp, comment text, and a clap count.
- **Comment_Section**: The UI area rendered below the blog post content on the Blog_Post page, containing the Response_Input (for authenticated users) and the Comment_List.
- **Comment_List**: The ordered list of all Comments for a given Blog_Post, sorted by creation date descending (newest first).
- **Response_Input**: The text input area shown at the top of the Comment_Section, visible only to authenticated users, used to compose and submit a new Comment.
- **Clap**: A positive reaction a user can give to a Comment, analogous to a "like". Each user may clap a Comment at most once. The total clap count is displayed on each Comment.
- **Bottom_Action_Bar**: A fixed or sticky bar at the bottom of the Blog_Post page displaying the total comment count (with a speech-bubble icon) and a share button.
- **Comment_API**: The set of backend REST endpoints under `/api/blogs/:slug/comments` that handle Comment CRUD and clap operations.
- **Blog_Post**: A single published blog article identified by its unique slug, as defined in the existing Blog CMS system.
- **AuthStore**: The existing frontend Zustand store (`useAuthStore`) that exposes the authenticated user's profile, token, and roles.
- **Public_Blog**: The blog subdomain frontend at `blog.rendernodes.com`, built as a React SPA.
- **Comment_Author**: The authenticated user who created a Comment.

---

## Requirements

### Requirement 1: Comment Section Display on Blog Post Page

**User Story:** As a visitor to the public blog, I want to see a comments section below each blog post, so that I can read what other readers have said about the article.

#### Acceptance Criteria

1. WHEN a visitor loads a Blog_Post page, THE Public_Blog SHALL render the Comment_Section below the blog post content and above the "More Posts" section.
2. THE Public_Blog SHALL display a "Responses" heading in the Comment_Section, followed by the total number of Comments for that Blog_Post in parentheses (e.g., "Responses (12)").
3. WHEN a Blog_Post has zero Comments, THE Public_Blog SHALL display the "Responses (0)" heading and an empty Comment_List with a message indicating no responses yet.
4. THE Public_Blog SHALL display the Comment_Section for all visitors regardless of authentication state.

---

### Requirement 2: Comment List Rendering

**User Story:** As a visitor, I want to see all comments for a blog post displayed clearly, so that I can read the community's responses.

#### Acceptance Criteria

1. THE Public_Blog SHALL render each Comment in the Comment_List with the following fields: author avatar (a circle showing the first letter of the author's display name), author display name, relative or formatted date of creation, comment text, and clap count.
2. THE Public_Blog SHALL display Comments in the Comment_List sorted by creation date descending (newest first).
3. WHEN a Comment's text exceeds 500 characters in display, THE Public_Blog SHALL show the full text without truncation.
4. THE Public_Blog SHALL display the clap count next to a clap icon on each Comment.
5. IF a Comment has zero claps, THE Public_Blog SHALL display "0" next to the clap icon.

---

### Requirement 3: Response Input for Authenticated Users

**User Story:** As a logged-in user, I want to see a text input area at the top of the comments section, so that I can write and submit my response to the blog post.

#### Acceptance Criteria

1. WHILE a visitor is authenticated, THE Public_Blog SHALL display the Response_Input at the top of the Comment_Section, above the Comment_List.
2. THE Response_Input SHALL display the authenticated user's avatar initial in a circle alongside the input area.
3. THE Response_Input SHALL display placeholder text "What are your thoughts?" when the input is empty.
4. WHILE a visitor is not authenticated, THE Public_Blog SHALL display a prompt in place of the Response_Input with the text "Sign in to leave a response" and a link to the login page.
5. THE Response_Input SHALL accept plain text input with a maximum length of 1000 characters.
6. THE Public_Blog SHALL display a live character count in the Response_Input showing the number of characters remaining (e.g., "950 / 1000").
7. WHEN the Response_Input contains at least 1 non-whitespace character, THE Public_Blog SHALL enable the "Respond" submit button.
8. WHEN the Response_Input is empty or contains only whitespace, THE Public_Blog SHALL disable the "Respond" submit button.

---

### Requirement 4: Submitting a Comment

**User Story:** As a logged-in user, I want to submit my comment and see it appear immediately in the list, so that I know my response was posted successfully.

#### Acceptance Criteria

1. WHEN an authenticated user clicks the "Respond" button with a non-empty Response_Input, THE Public_Blog SHALL call `POST /api/blogs/:slug/comments` with the comment text in the request body.
2. WHEN the Comment_API returns a success response, THE Public_Blog SHALL prepend the new Comment to the top of the Comment_List and clear the Response_Input.
3. WHEN the Comment_API returns a success response, THE Public_Blog SHALL increment the displayed comment count in the "Responses (N)" heading by 1.
4. IF the Comment_API returns an error response, THEN THE Public_Blog SHALL display an error message below the Response_Input and preserve the typed text in the input.
5. WHILE a comment submission request is in flight, THE Public_Blog SHALL disable the "Respond" button and display a loading indicator on it.
6. THE Comment_API SHALL expose `POST /api/blogs/:slug/comments` requiring the `authenticate` middleware.
7. WHEN `POST /api/blogs/:slug/comments` is called with a valid slug and non-empty text, THE Comment_API SHALL create a new Comment document with: `blogId` set to the Blog_Post's `_id`, `authorId` set to the authenticated user's `userId`, `text` set to the trimmed request body text, `claps` set to 0, and `clappers` set to an empty array.
8. WHEN `POST /api/blogs/:slug/comments` is called, THE Comment_API SHALL increment the `commentsCount` field on the corresponding Blog_Post document by 1.
9. IF `POST /api/blogs/:slug/comments` is called with an empty or whitespace-only text body, THEN THE Comment_API SHALL return a 400 error with `{ "success": false, "error": "Comment text is required" }`.
10. IF `POST /api/blogs/:slug/comments` is called with text exceeding 1000 characters, THEN THE Comment_API SHALL return a 400 error with `{ "success": false, "error": "Comment text must not exceed 1000 characters" }`.
11. IF `POST /api/blogs/:slug/comments` is called with a slug that does not match a PUBLISHED Blog_Post, THEN THE Comment_API SHALL return a 404 error with `{ "success": false, "error": "Blog post not found" }`.

---

### Requirement 5: Fetching Comments

**User Story:** As a visitor, I want the comments to load when I open a blog post, so that I can read the existing responses without any extra action.

#### Acceptance Criteria

1. WHEN a visitor loads a Blog_Post page, THE Public_Blog SHALL fetch the Comment_List by calling `GET /api/blogs/:slug/comments`.
2. THE Comment_API SHALL expose `GET /api/blogs/:slug/comments` as a public endpoint requiring no authentication.
3. WHEN `GET /api/blogs/:slug/comments` is called with a valid slug, THE Comment_API SHALL return all Comments for that Blog_Post sorted by `createdAt` descending, with each Comment including: `_id`, `authorId` (populated with `name` and `username`), `text`, `claps`, `createdAt`.
4. WHEN `GET /api/blogs/:slug/comments` is called with a slug that does not match any Blog_Post, THE Comment_API SHALL return a 404 error with `{ "success": false, "error": "Blog post not found" }`.
5. WHILE the Comment_List is loading, THE Public_Blog SHALL display a skeleton loading state in the Comment_Section.
6. IF the `GET /api/blogs/:slug/comments` request fails, THEN THE Public_Blog SHALL display an error message in the Comment_Section and provide a "Retry" button.

---

### Requirement 6: Clapping on a Comment

**User Story:** As a logged-in user, I want to clap on a comment I appreciate, so that I can show support for responses I find valuable.

#### Acceptance Criteria

1. WHILE a visitor is authenticated, THE Public_Blog SHALL display a clap button (clap/hands icon) on each Comment in the Comment_List.
2. WHILE a visitor is not authenticated, THE Public_Blog SHALL display the clap count on each Comment but SHALL NOT display an interactive clap button.
3. WHEN an authenticated user clicks the clap button on a Comment they have not yet clapped, THE Public_Blog SHALL call `POST /api/blogs/:slug/comments/:commentId/clap`.
4. WHEN the clap API returns a success response, THE Public_Blog SHALL increment the displayed clap count on that Comment by 1 and update the clap button to a "clapped" visual state.
5. WHEN an authenticated user clicks the clap button on a Comment they have already clapped, THE Public_Blog SHALL call `DELETE /api/blogs/:slug/comments/:commentId/clap` to remove the clap.
6. WHEN the unclap API returns a success response, THE Public_Blog SHALL decrement the displayed clap count on that Comment by 1 and update the clap button to the default (unclapped) visual state.
7. THE Comment_API SHALL expose `POST /api/blogs/:slug/comments/:commentId/clap` requiring the `authenticate` middleware; the endpoint SHALL add the authenticated user's `userId` to the Comment's `clappers` array if not already present and increment `claps` by 1.
8. IF `POST /api/blogs/:slug/comments/:commentId/clap` is called by a user whose `userId` is already in the Comment's `clappers` array, THEN THE Comment_API SHALL return a 409 error with `{ "success": false, "error": "Already clapped" }`.
9. THE Comment_API SHALL expose `DELETE /api/blogs/:slug/comments/:commentId/clap` requiring the `authenticate` middleware; the endpoint SHALL remove the authenticated user's `userId` from the Comment's `clappers` array and decrement `claps` by 1 (floor 0).
10. IF `DELETE /api/blogs/:slug/comments/:commentId/clap` is called by a user whose `userId` is not in the Comment's `clappers` array, THEN THE Comment_API SHALL return a 409 error with `{ "success": false, "error": "Not clapped yet" }`.
11. WHEN a Blog_Post page loads and the visitor is authenticated, THE Public_Blog SHALL determine which Comments the authenticated user has already clapped by checking the `clappers` array in the fetched Comment data and render those clap buttons in the "clapped" state.

---

### Requirement 7: Deleting a Comment

**User Story:** As a logged-in user, I want to delete my own comments, so that I can remove responses I no longer want to be visible.

#### Acceptance Criteria

1. WHILE a visitor is authenticated and viewing a Comment authored by themselves, THE Public_Blog SHALL display a delete option (e.g., a "..." menu or a trash icon) on that Comment.
2. WHEN an authenticated user selects the delete option on their own Comment, THE Public_Blog SHALL display a confirmation prompt before proceeding.
3. WHEN the user confirms deletion, THE Public_Blog SHALL call `DELETE /api/blogs/:slug/comments/:commentId`.
4. WHEN the delete API returns a success response, THE Public_Blog SHALL remove the Comment from the Comment_List and decrement the displayed comment count in the "Responses (N)" heading by 1.
5. THE Comment_API SHALL expose `DELETE /api/blogs/:slug/comments/:commentId` requiring the `authenticate` middleware.
6. WHEN `DELETE /api/blogs/:slug/comments/:commentId` is called by the Comment_Author, THE Comment_API SHALL delete the Comment document and decrement the `commentsCount` field on the corresponding Blog_Post by 1 (floor 0).
7. IF `DELETE /api/blogs/:slug/comments/:commentId` is called by a user who is not the Comment_Author and does not have the `admin` role, THEN THE Comment_API SHALL return a 403 error with `{ "success": false, "error": "Insufficient permissions" }`.
8. WHEN `DELETE /api/blogs/:slug/comments/:commentId` is called by a user with the `admin` role, THE Comment_API SHALL delete the Comment regardless of authorship.
9. IF `DELETE /api/blogs/:slug/comments/:commentId` is called with a `commentId` that does not exist, THEN THE Comment_API SHALL return a 404 error with `{ "success": false, "error": "Comment not found" }`.

---

### Requirement 8: Bottom Action Bar

**User Story:** As a visitor reading a blog post, I want to see a bottom action bar with the comment count and a share button, so that I can quickly see engagement and share the article.

#### Acceptance Criteria

1. WHEN a visitor is on a Blog_Post page, THE Public_Blog SHALL display a Bottom_Action_Bar that is fixed to the bottom of the viewport.
2. THE Bottom_Action_Bar SHALL display a speech-bubble icon alongside the total comment count for the Blog_Post.
3. WHEN a visitor clicks the speech-bubble icon or comment count in the Bottom_Action_Bar, THE Public_Blog SHALL scroll the page to the Comment_Section.
4. THE Bottom_Action_Bar SHALL display a share button.
5. WHEN a visitor clicks the share button, THE Public_Blog SHALL copy the current page URL to the clipboard and display a brief confirmation message (e.g., "Link copied!") for 2 seconds.
6. WHERE the Web Share API is available in the visitor's browser, WHEN the visitor clicks the share button, THE Public_Blog SHALL invoke the native Web Share API with the Blog_Post title and URL instead of copying to clipboard.
7. THE Bottom_Action_Bar SHALL display the comment count sourced from the `commentsCount` field on the Blog_Post, updated optimistically when a new comment is submitted or deleted.

---

### Requirement 9: Comment Data Model

**User Story:** As a platform engineer, I want a well-structured Comment data model, so that comments are stored efficiently and can be queried by blog post.

#### Acceptance Criteria

1. THE Comment_API SHALL store each Comment in a dedicated `Comment` MongoDB collection with the following fields: `_id` (ObjectId), `blogId` (ObjectId, ref: `Blog`, required), `authorId` (ObjectId, ref: `User`, required), `text` (String, required, max 1000 characters), `claps` (Number, default 0), `clappers` (Array of ObjectId, ref: `User`, default []), `createdAt` (Date), `updatedAt` (Date).
2. THE Comment_API SHALL maintain a compound index on `{ blogId: 1, createdAt: -1 }` to support efficient Comment_List queries sorted by newest first.
3. THE Comment_API SHALL maintain an index on `{ authorId: 1 }` to support efficient lookup of comments by author.
4. THE Blog model SHALL include a `commentsCount` field (Number, default 0) that is incremented on comment creation and decremented on comment deletion.
5. FOR ALL Comment documents, THE Comment_API SHALL ensure `claps` equals the length of the `clappers` array (invariant maintained by the clap/unclap endpoints).

---

### Requirement 10: Comment Count on Blog Post API

**User Story:** As a frontend developer, I want the blog post API to include the comment count, so that the Bottom_Action_Bar and the Responses heading can display accurate counts without a separate request.

#### Acceptance Criteria

1. WHEN `GET /api/blogs/:slug` is called, THE Comment_API SHALL include the `commentsCount` field in the Blog_Post response body.
2. THE `commentsCount` field returned by `GET /api/blogs/:slug` SHALL reflect the current number of Comments stored in the `Comment` collection for that Blog_Post.

---

### Requirement 11: Authentication Gate for Comment Actions

**User Story:** As a platform operator, I want unauthenticated users to be unable to post or delete comments, so that comment authorship is always tied to a verified account.

#### Acceptance Criteria

1. IF `POST /api/blogs/:slug/comments` is called without a valid authentication token, THEN THE Comment_API SHALL return a 401 error with `{ "success": false, "error": "Authentication token required" }`.
2. IF `DELETE /api/blogs/:slug/comments/:commentId` is called without a valid authentication token, THEN THE Comment_API SHALL return a 401 error with `{ "success": false, "error": "Authentication token required" }`.
3. IF `POST /api/blogs/:slug/comments/:commentId/clap` is called without a valid authentication token, THEN THE Comment_API SHALL return a 401 error with `{ "success": false, "error": "Authentication token required" }`.
4. IF `DELETE /api/blogs/:slug/comments/:commentId/clap` is called without a valid authentication token, THEN THE Comment_API SHALL return a 401 error with `{ "success": false, "error": "Authentication token required" }`.
5. WHILE a visitor is not authenticated, THE Public_Blog SHALL display the Comment_List in a read-only state with no interactive controls other than the sign-in prompt.
