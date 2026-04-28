# Requirements Document

## Introduction

The Blog CMS System adds a full content management workflow to the RenderOnNodes platform. It has two parts:

1. **Public Blog Website** — served on `blog.rendernodes.com` (hostname-sniffed in the existing React SPA). Includes a blog landing page with category filters and blog cards, and individual blog post pages that render dynamic content from the database. The `BlogHome` page and `BlogApp` subdomain router are partially built; this feature completes them with individual post pages and full dynamic data.

2. **Writer CMS Portal** — lives at `/dashboard/content-studio` inside the existing authenticated app. Writers and admins can create, edit, and publish blog posts using a block-based TipTap editor. Content is stored as structured JSON blocks in MongoDB. A draft → in-review → published workflow controls visibility.

The existing codebase already has: a `Blog` Mongoose model, public `GET /api/blogs` and `GET /api/blogs/:slug` routes, a `BlogHome` frontend page, a `BlogApp` subdomain router, the `writer` role on the `User` model, and `authenticate`/`authorize` middleware. This feature builds on top of all of that.

---

## Glossary

- **CMS**: Content Management System — the writer-facing portal at `/dashboard/content-studio`
- **Blog_Post**: A single piece of content with a title, slug, author, template, content blocks, SEO metadata, and a publication status
- **Content_Block**: A single unit of structured content (heading, paragraph, image, code block, list, table, quote) stored as a JSON object within a Blog_Post
- **Template**: A predefined blog structure (e.g., Tutorial, Comparison, Technical Deep Dive, Listicle, Problem-Solution) that pre-populates the editor with a set of suggested Content_Blocks
- **TipTap_Editor**: The block-based rich-text editor (Notion-like) used in the CMS portal
- **Status_Workflow**: The three-state lifecycle of a Blog_Post: `DRAFT` → `IN_REVIEW` → `PUBLISHED`
- **Writer**: A user with the `writer` role who can create and edit Blog_Posts
- **Admin**: A user with the `admin` role who has full CMS access including publishing and deleting
- **Public_Blog**: The blog subdomain frontend at `blog.rendernodes.com`
- **SEO_Meta**: The set of fields (title, description, OG image URL) attached to a Blog_Post for search engine and social sharing optimization
- **S3**: The existing AWS S3 bucket used for file storage; images uploaded in the CMS are stored here
- **CDN_URL**: The public URL returned after an image is uploaded to S3, stored inside a Content_Block
- **Slug**: A URL-safe, unique string identifier derived from the Blog_Post title, used in public URLs
- **AuthStore**: The existing frontend Zustand store that holds the authenticated user's profile and roles
- **ProtectedRoute**: The existing React component that guards routes by checking the user's roles against an `allowedRoles` list
- **favoriteBlogPosts**: An array field on the User model storing the `_id` references of Blog_Posts the user has favorited

---

## Requirements

### Requirement 1: Public Blog Post Page

**User Story:** As a visitor to the public blog, I want to click on a blog card and read the full article, so that I can consume the content published by the RenderOnNodes team.

#### Acceptance Criteria

1. WHEN a visitor navigates to `blog.rendernodes.com/:slug`, THE Public_Blog SHALL fetch the Blog_Post with the matching slug and `PUBLISHED` status from the API and render its Content_Blocks.
2. IF the slug does not match any `PUBLISHED` Blog_Post, THEN THE Public_Blog SHALL display a 404 message and a link back to the blog landing page.
3. THE Public_Blog SHALL render each Content_Block type (heading, paragraph, image, code block, ordered list, unordered list, table, quote) using the appropriate HTML element.
4. THE Public_Blog SHALL display the Blog_Post's SEO_Meta title and description in the page `<head>` using the existing `HelmetProvider`.
5. WHEN a visitor is on a blog post page, THE Public_Blog SHALL display the author name, publication date, read time, and category.
6. THE Public_Blog SHALL include a navigation link back to the blog landing page.

---

### Requirement 2: Blog Landing Page — Individual Post Navigation

**User Story:** As a visitor, I want to click on a blog card on the landing page and be taken to the full post, so that I can read the complete article.

#### Acceptance Criteria

1. WHEN a visitor clicks a blog card on the `BlogHome` page, THE Public_Blog SHALL navigate to the route `/:slug` within the blog subdomain router.
2. THE Public_Blog SHALL pass the Blog_Post slug as the URL parameter to the post detail route.

---

### Requirement 3: CMS Portal Access Control

**User Story:** As a platform operator, I want only writers and admins to access the CMS portal, so that unauthorized users cannot create or modify blog content.

#### Acceptance Criteria

1. WHEN a user navigates to `/dashboard/content-studio`, THE CMS SHALL verify the user's roles using the existing `ProtectedRoute` component with `allowedRoles` set to `['writer', 'admin']`.
2. IF the authenticated user does not have the `writer` or `admin` role, THEN THE CMS SHALL redirect the user to the main dashboard.
3. THE CMS SHALL display the Content Studio navigation link in the dashboard sidebar only to users whose roles include `writer` or `admin`.
4. WHEN an unauthenticated user navigates to `/dashboard/content-studio`, THE CMS SHALL redirect the user to the login page.

---

### Requirement 4: CMS Blog Post List

**User Story:** As a writer, I want to see all my blog posts in one place, so that I can manage my drafts and published articles.

#### Acceptance Criteria

1. WHEN a writer opens the CMS portal, THE CMS SHALL display a list of Blog_Posts authored by the authenticated user, sorted by `updatedAt` descending.
2. WHEN an admin opens the CMS portal, THE CMS SHALL display a list of all Blog_Posts across all authors, sorted by `updatedAt` descending.
3. THE CMS SHALL display each Blog_Post's title, status, category, author name, and last updated date in the list.
4. THE CMS SHALL provide a button to create a new Blog_Post from the list view.
5. THE CMS SHALL provide per-row actions to edit or delete a Blog_Post.
6. IF a writer attempts to delete a Blog_Post authored by another user, THEN THE CMS API SHALL return a 403 error.

---

### Requirement 5: Template Selection

**User Story:** As a writer, I want to choose a template when creating a new blog post, so that I start with a structured outline suited to my content type.

#### Acceptance Criteria

1. WHEN a writer clicks "Create New Post", THE CMS SHALL display a template selector showing all available Templates with their name and description.
2. WHEN a writer selects a Template, THE CMS SHALL initialize the TipTap_Editor with the Template's predefined Content_Blocks as the starting content.
3. THE CMS SHALL provide the following built-in Templates: Tutorial, Comparison, Technical Deep Dive, Listicle, Problem-Solution.
4. THE CMS SHALL allow a writer to proceed without selecting a template, starting with an empty editor.
5. THE Template model SHALL store: id, name, description, and an ordered list of sections where each section has a label and a list of allowed Content_Block types.

---

### Requirement 6: Block-Based TipTap Editor

**User Story:** As a writer, I want a rich block-based editor to compose my blog post, so that I can create well-structured, visually rich content without writing HTML.

#### Acceptance Criteria

1. THE TipTap_Editor SHALL support the following Content_Block types: Heading (H1–H6), Paragraph, Blockquote, Image, Code Block, Ordered List, Unordered List, Table.
2. THE TipTap_Editor SHALL support the following inline text formatting: bold, italic, highlight, hyperlink.
3. WHEN a writer inserts an image block, THE TipTap_Editor SHALL accept a file via drag-and-drop or file picker and upload it to S3 via the `POST /api/cms/upload` endpoint.
4. WHEN the S3 upload completes, THE TipTap_Editor SHALL replace the uploading placeholder with an `<img>` element whose `src` is the returned CDN_URL.
5. IF the S3 upload fails, THEN THE TipTap_Editor SHALL display an inline error message and remove the placeholder block.
6. THE TipTap_Editor SHALL auto-save the current Content_Blocks to the backend as a `DRAFT` every 30 seconds while the editor is open and the Blog_Post has been saved at least once.
7. THE TipTap_Editor SHALL serialize the editor state to a JSON array of Content_Blocks when saving.
8. THE TipTap_Editor SHALL deserialize a JSON array of Content_Blocks from the database and restore the editor state when opening an existing Blog_Post.
9. FOR ALL valid Content_Block JSON arrays, serializing then deserializing SHALL produce an editor state equivalent to the original (round-trip property).

---

### Requirement 7: SEO Metadata Editor

**User Story:** As a writer, I want to fill in SEO metadata for my blog post, so that it appears correctly in search engines and social media previews.

#### Acceptance Criteria

1. THE CMS SHALL provide a SEO panel within the post editor containing fields for: SEO title (max 60 characters), SEO description (max 160 characters), and OG image URL.
2. WHEN a writer uploads an image via the SEO panel, THE CMS SHALL upload it to S3 and populate the OG image URL field with the returned CDN_URL.
3. THE CMS SHALL display a live character count for the SEO title and SEO description fields.
4. WHEN a writer saves the Blog_Post, THE CMS SHALL persist the SEO_Meta fields to the `seoMeta` subdocument on the Blog model.

---

### Requirement 8: Status Workflow

**User Story:** As a writer, I want to move my blog post through a review and publishing workflow, so that content is reviewed before going live.

#### Acceptance Criteria

1. THE CMS SHALL allow a writer to save a Blog_Post with status `DRAFT` at any time.
2. WHEN a writer clicks "Submit for Review", THE CMS SHALL update the Blog_Post status from `DRAFT` to `IN_REVIEW`.
3. WHEN an admin clicks "Publish", THE CMS SHALL update the Blog_Post status from `IN_REVIEW` to `PUBLISHED` and set `publishedAt` to the current UTC timestamp.
4. IF a user with only the `writer` role attempts to set a Blog_Post status to `PUBLISHED` via the API, THEN THE CMS API SHALL return a 403 error.
5. WHEN an admin clicks "Unpublish", THE CMS SHALL update the Blog_Post status from `PUBLISHED` back to `DRAFT` and clear `publishedAt`.
6. THE CMS SHALL display the current status prominently in the editor header.

---

### Requirement 9: Slug Generation

**User Story:** As a writer, I want a URL slug to be automatically generated from my blog post title, so that I don't have to manually create SEO-friendly URLs.

#### Acceptance Criteria

1. WHEN a writer enters or changes the Blog_Post title, THE CMS SHALL automatically generate a Slug by converting the title to lowercase, replacing spaces with hyphens, and removing non-alphanumeric characters (except hyphens).
2. THE CMS SHALL allow the writer to manually override the auto-generated Slug.
3. WHEN a writer saves a Blog_Post, THE CMS API SHALL verify the Slug is unique across all Blog_Posts with a different `_id`.
4. IF the Slug is not unique, THEN THE CMS API SHALL return a 409 error with a suggested alternative slug.

---

### Requirement 10: CMS API — Blog CRUD

**User Story:** As a writer, I want the CMS to persist my blog posts to the database, so that my work is saved and retrievable.

#### Acceptance Criteria

1. THE CMS API SHALL expose `POST /api/cms/blogs` to create a new Blog_Post; the endpoint SHALL require the `authenticate` and `authorize('writer', 'admin')` middleware.
2. THE CMS API SHALL expose `GET /api/cms/blogs` to list Blog_Posts; writers SHALL receive only their own posts, admins SHALL receive all posts.
3. THE CMS API SHALL expose `GET /api/cms/blogs/:id` to fetch a single Blog_Post by its MongoDB `_id`.
4. THE CMS API SHALL expose `PATCH /api/cms/blogs/:id` to update a Blog_Post's fields; the endpoint SHALL verify the authenticated user is the author or has the `admin` role.
5. THE CMS API SHALL expose `DELETE /api/cms/blogs/:id` to delete a Blog_Post; the endpoint SHALL verify the authenticated user is the author or has the `admin` role.
6. WHEN a Blog_Post is created, THE CMS API SHALL set `authorId` to the authenticated user's `userId`.

---

### Requirement 11: CMS API — Image Upload

**User Story:** As a writer, I want to upload images directly from the editor, so that they are stored on the CDN and embedded in my content.

#### Acceptance Criteria

1. THE CMS API SHALL expose `POST /api/cms/upload` to accept a single image file (JPEG, PNG, GIF, WebP) with a maximum size of 10 MB.
2. WHEN a valid image is received, THE CMS API SHALL upload it to the existing S3 bucket and return the CDN_URL in the response body as `{ success: true, url: "<cdn_url>" }`.
3. IF the uploaded file exceeds 10 MB or is not an accepted MIME type, THEN THE CMS API SHALL return a 400 error with a descriptive message.
4. THE `POST /api/cms/upload` endpoint SHALL require the `authenticate` and `authorize('writer', 'admin')` middleware.

---

### Requirement 12: CMS API — Template CRUD

**User Story:** As an admin, I want to manage blog templates, so that writers have up-to-date structural starting points.

#### Acceptance Criteria

1. THE CMS API SHALL expose `GET /api/cms/templates` to return all Templates; this endpoint SHALL be accessible to authenticated users with the `writer` or `admin` role.
2. THE CMS API SHALL expose `POST /api/cms/templates` to create a new Template; this endpoint SHALL require the `admin` role.
3. THE CMS API SHALL expose `PATCH /api/cms/templates/:id` to update a Template; this endpoint SHALL require the `admin` role.
4. THE CMS API SHALL expose `DELETE /api/cms/templates/:id` to delete a Template; this endpoint SHALL require the `admin` role.
5. THE CMS API SHALL seed the five built-in Templates (Tutorial, Comparison, Technical Deep Dive, Listicle, Problem-Solution) on application startup if they do not already exist.

---

### Requirement 13: Public API — Blog Listing and Detail

**User Story:** As a visitor to the public blog, I want the blog pages to load quickly with accurate data, so that I can browse and read content without delays.

#### Acceptance Criteria

1. THE Public_Blog API SHALL expose `GET /api/blogs` returning only Blog_Posts with `status: PUBLISHED`, sorted by `publishedAt` descending, with support for `category`, `limit`, and `pinned` query parameters. *(This endpoint already exists; this requirement documents and locks its contract.)*
2. THE Public_Blog API SHALL expose `GET /api/blogs/:slug` returning a single Blog_Post with `status: PUBLISHED` matching the given slug. *(This endpoint already exists; this requirement documents and locks its contract.)*
3. WHEN `GET /api/blogs/:slug` is called with a slug that matches no `PUBLISHED` Blog_Post, THE Public_Blog API SHALL return a 404 response with `{ success: false, error: "Blog post not found" }`.
4. THE Public_Blog API SHALL populate the `authorId` field with the author's `name` and `username` in all responses.

---

### Requirement 14: Dashboard Navigation Integration

**User Story:** As a writer, I want to see a "Content Studio" link in the dashboard navigation, so that I can easily access the CMS from within the app.

#### Acceptance Criteria

1. THE CMS SHALL add a "Content Studio" navigation entry to the existing dashboard sidebar, visible only when the authenticated user's roles include `writer` or `admin`.
2. WHEN a writer clicks "Content Studio" in the sidebar, THE CMS SHALL navigate to `/dashboard/content-studio`.
3. THE CMS SHALL register the `/dashboard/content-studio/*` routes within the existing `App.tsx` router, protected by `ProtectedRoute` with `allowedRoles: ['writer', 'admin']`.

---

### Requirement 15: Edit and Delete Blog Posts

**User Story:** As a writer, I want to edit my existing blog posts and delete them when needed, so that I can maintain and manage my content over time. As an admin, I want to edit or delete any blog post, so that I can moderate and manage all platform content.

#### Acceptance Criteria

1. WHEN a writer views the CMS blog post list, THE CMS SHALL display an "Edit" button for each Blog_Post authored by the writer.
2. WHEN a writer clicks the "Edit" button, THE CMS SHALL navigate to the editor view and pre-populate the TipTap_Editor with the existing Blog_Post's Content_Blocks, title, category, and SEO_Meta.
3. WHEN a writer saves changes to an existing Blog_Post, THE CMS SHALL call `PATCH /api/cms/blogs/:id` with the updated fields and preserve the original `authorId` and `createdAt` values.
4. WHEN a writer views the CMS blog post list, THE CMS SHALL display a "Delete" button for each Blog_Post authored by the writer.
5. WHEN a writer clicks the "Delete" button, THE CMS SHALL display a confirmation dialog with the message "Are you sure you want to delete this blog post? This action cannot be undone."
6. WHEN a writer confirms deletion, THE CMS SHALL call `DELETE /api/cms/blogs/:id` and remove the Blog_Post from the list upon successful deletion.
7. WHEN an admin views the CMS blog post list, THE CMS SHALL display "Edit" and "Delete" buttons for all Blog_Posts regardless of author.
8. IF a writer attempts to edit or delete a Blog_Post authored by another user via the API, THEN THE CMS API SHALL return a 403 error.
9. WHEN an admin edits or deletes any Blog_Post, THE CMS API SHALL allow the operation regardless of the original author.

---

### Requirement 16: Add Blog Posts to Favorites

**User Story:** As a visitor to the public blog, I want to mark blog posts as favorites, so that I can easily find and return to content I enjoyed. As a logged-in user, I want my favorites to persist across sessions and devices.

#### Acceptance Criteria

1. WHEN a visitor views a blog post page on the Public_Blog, THE Public_Blog SHALL display a "Add to Favorites" button (heart icon or bookmark icon) near the post title or in a fixed action bar.
2. WHEN an anonymous visitor clicks "Add to Favorites", THE Public_Blog SHALL store the Blog_Post slug in the browser's localStorage under the key `blogFavorites` as a JSON array.
3. WHEN an anonymous visitor clicks "Add to Favorites" on a post already in their favorites, THE Public_Blog SHALL remove the slug from localStorage and update the button state to "Add to Favorites".
4. WHEN an anonymous visitor views a blog post that is in their localStorage favorites, THE Public_Blog SHALL display the button in the "favorited" state (filled heart or highlighted bookmark).
5. WHERE a visitor is authenticated (logged in), WHEN the visitor clicks "Add to Favorites", THE Public_Blog SHALL call `POST /api/blogs/:slug/favorite` to persist the favorite to the database associated with the user's account.
6. WHERE a visitor is authenticated, WHEN the visitor clicks "Remove from Favorites" on a favorited post, THE Public_Blog SHALL call `DELETE /api/blogs/:slug/favorite` to remove the favorite from the database.
7. WHERE a visitor is authenticated, WHEN the visitor views a blog post, THE Public_Blog SHALL fetch the user's favorites from the API and display the correct button state (favorited or not favorited).
8. THE Public_Blog API SHALL expose `POST /api/blogs/:slug/favorite` requiring the `authenticate` middleware; the endpoint SHALL add the Blog_Post `_id` to the user's `favoriteBlogPosts` array if not already present.
9. THE Public_Blog API SHALL expose `DELETE /api/blogs/:slug/favorite` requiring the `authenticate` middleware; the endpoint SHALL remove the Blog_Post `_id` from the user's `favoriteBlogPosts` array.
10. THE Public_Blog API SHALL expose `GET /api/blogs/favorites` requiring the `authenticate` middleware; the endpoint SHALL return all Blog_Posts whose `_id` is in the authenticated user's `favoriteBlogPosts` array, with `status: PUBLISHED`.
11. WHEN a blog post card is displayed on the blog landing page, THE Public_Blog SHALL display a small favorites indicator (count or icon) if the post is in the visitor's favorites (localStorage for anonymous, API for authenticated).
