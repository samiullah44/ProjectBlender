# Implementation Plan: Blog CMS System

## Overview

Implement the Blog CMS System in five phases: backend data layer and API, CMS frontend (Content Studio portal + TipTap editor), public blog frontend (post page + block renderer), integration layer (favorites, auto-save, SEO), and property-based tests. The stack is TypeScript throughout — Express + Mongoose on the backend, React + Tailwind + TipTap on the frontend.

---

## Tasks

- [x] 1. Extend backend data models
  - [x] 1.1 Extend `Blog.ts` model with new fields
    - Add `tags: string[]`, `coverImage?: string`, `favoritesCount: number` fields to `IBlog` interface and `blogSchema`
    - Add new indexes: `{ authorId: 1, updatedAt: -1 }` and `{ status: 1, slug: 1 }`
    - _Requirements: 6.7, 9.1, 16.8_

  - [x] 1.2 Add `favoriteBlogPosts` field to `User.ts` model
    - Add `favoriteBlogPosts: ObjectId[]` to `IUser` interface
    - Add schema field: `favoriteBlogPosts: [{ type: Schema.Types.ObjectId, ref: 'Blog' }]`
    - _Requirements: 16.8, 16.9_

  - [x] 1.3 Create `Template.ts` Mongoose model
    - Define `ITemplateSection` and `ITemplate` interfaces as specified in the design
    - Implement `templateSchema` with `name`, `description`, `category`, `icon`, `sections`, `isBuiltIn` fields
    - _Requirements: 5.5, 12.1_

- [x] 2. Add `uploadBlogImage` method to `S3Service.ts`
  - Implement `uploadBlogImage(file: Express.Multer.File): Promise<string>` that uploads to `blog-images/` prefix and returns the public CDN URL
  - Use `PutObjectCommand` with `ContentType` from `file.mimetype`; return `getPublicUrl(fileKey)`
  - _Requirements: 11.2_

- [x] 3. Implement CMS backend — controllers and routes
  - [x] 3.1 Create `cmsController.ts` — blog CRUD
    - `createBlog`: validate body, set `authorId` from `req.user.userId` (ignore any body `authorId`), generate slug, check uniqueness (409 + suggestedSlug on conflict), save and return 201
    - `listBlogs`: writers filter by `authorId === req.user.userId`; admins get all; support `status`, `search`, `page`, `limit` query params
    - `getBlogById`: fetch by `_id`, 404 if not found
    - `updateBlog`: verify author or admin; enforce status transition rules (writer cannot set `PUBLISHED` → 403); set `publishedAt` when transitioning to `PUBLISHED`; clear `publishedAt` when unpublishing
    - `deleteBlog`: verify author or admin; 403 otherwise
    - _Requirements: 10.1–10.6, 8.3–8.5, 15.8–15.9_

  - [x] 3.2 Create `cmsController.ts` — image upload handler
    - `uploadImage`: validate MIME type (jpeg/png/gif/webp) and size (≤10 MB) before calling `s3Service.uploadBlogImage()`; return `{ success: true, url }` on success; 400 on validation failure; 500 on S3 error
    - Configure `multer` with `memoryStorage()`, `limits: { fileSize: 10 * 1024 * 1024 }`, and MIME filter
    - _Requirements: 11.1–11.4_

  - [x] 3.3 Create `templateController.ts` — template CRUD + seed
    - `listTemplates`: return all templates
    - `createTemplate`, `updateTemplate`, `deleteTemplate`: admin-only operations
    - `seedTemplates`: idempotent function that creates the 5 built-in templates (Tutorial, Comparison, Technical Deep Dive, Listicle, Problem-Solution) if they don't exist; call from `index.ts` at startup
    - _Requirements: 12.1–12.5, 5.3_

  - [x] 3.4 Create `cms.routes.ts` and mount in `app.ts`
    - Create `backend/main/src/routes/api/cms.routes.ts`
    - Apply `authenticate` + `authorize('writer', 'admin')` at router level
    - Wire all CMS controller handlers to their routes per the API contract in the design
    - Admin-only template mutation routes use an additional `authorize('admin')` guard
    - Mount in `app.ts` under both `/api/cms` and `/cms` prefixes (matching existing pattern)
    - _Requirements: 10.1, 11.4, 12.2–12.4_

- [x] 4. Add favorites endpoints to `blogs.ts` public route
  - Register `GET /favorites` route BEFORE `/:slug` to avoid route shadowing
  - `GET /favorites`: requires `authenticate`; populate `user.favoriteBlogPosts`, filter to `PUBLISHED` only, return array
  - `POST /:slug/favorite`: requires `authenticate`; find blog by slug, add `_id` to `user.favoriteBlogPosts` if not present (idempotent), increment `blog.favoritesCount`
  - `DELETE /:slug/favorite`: requires `authenticate`; remove `_id` from `user.favoriteBlogPosts`, decrement `blog.favoritesCount` (floor 0)
  - _Requirements: 16.8–16.10_

- [x] 5. Checkpoint — backend complete
  - Ensure all backend routes compile without TypeScript errors
  - Verify `GET /api/cms/blogs`, `POST /api/cms/blogs`, `PATCH /api/cms/blogs/:id`, `DELETE /api/cms/blogs/:id`, `POST /api/cms/upload`, `GET /api/cms/templates` are all reachable
  - Ask the user if questions arise before proceeding to frontend.

- [x] 6. Set up CMS frontend routing and access control
  - [x] 6.1 Register `/dashboard/content-studio/*` routes in `App.tsx`
    - Add lazy-loaded `ContentStudio` import
    - Add route inside the existing `MainLayout` block, wrapped in `ProtectedRoute` with `allowedRoles: ['writer', 'admin']`
    - _Requirements: 3.1, 3.4, 14.3_

  - [x] 6.2 Add "Content Studio" link to dashboard sidebar
    - Locate the existing dashboard sidebar component and add a "Content Studio" nav entry
    - Conditionally render only when `user.roles` includes `writer` or `admin` (use `useAuthStore`)
    - _Requirements: 3.3, 14.1–14.2_

- [x] 7. Build CMS Post List View (`PostListView`)
  - [x] 7.1 Create `frontend/src/pages/cms/ContentStudio.tsx` shell with nested routes
    - Route `/dashboard/content-studio` → `PostListView`
    - Route `/dashboard/content-studio/new` → `PostEditorView`
    - Route `/dashboard/content-studio/:id/edit` → `PostEditorView`
    - _Requirements: 4.1, 14.2_

  - [x] 7.2 Implement `PostListView` component
    - Fetch posts from `GET /api/cms/blogs` with `useQuery`; display in a responsive table (desktop) / card stack (mobile)
    - Show title, status badge, category, author name, last updated date per row
    - `StatusFilterTabs` (All / Draft / In Review / Published) and `SearchInput` wired to query params
    - Per-row Edit button (navigates to `/:id/edit`) and Delete button (confirmation dialog → `DELETE /api/cms/blogs/:id`)
    - "Create New Post" button opens `TemplateSelectModal`
    - _Requirements: 4.1–4.6, 15.1, 15.4–15.6_

  - [x] 7.3 Implement `TemplateSelectModal` component
    - Fetch templates from `GET /api/cms/templates`
    - Display template cards with name, description, icon
    - "Start with blank" option available
    - On selection, navigate to `/dashboard/content-studio/new?templateId=<id>`
    - _Requirements: 5.1–5.4_

  - [x] 7.4 Implement `StatusBadge` component
    - Render color-coded pill for `DRAFT` (gray), `IN_REVIEW` (yellow/amber), `PUBLISHED` (green)
    - _Requirements: 8.6_

- [x] 8. Build TipTap editor core
  - [x] 8.1 Install TipTap dependencies and configure extensions
    - Install: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-highlight`, `@tiptap/extension-link`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`, `tiptap-extension-drag-handle`
    - Create `frontend/src/components/cms/editor/extensions/` directory with configured extension instances
    - _Requirements: 6.1–6.2_

  - [x] 8.2 Implement `SlashCommandMenu` custom TipTap extension
    - Trigger on `/` in an empty block; show floating menu with block type options (Heading 1–3, Paragraph, Blockquote, Code Block, Ordered List, Bullet List, Table, Image)
    - Keyboard navigable (arrow keys + Enter); dismiss on Escape or click outside
    - _Requirements: 6.1_

  - [x] 8.3 Implement `FloatingToolbar` component
    - Appears on text selection; buttons: Bold, Italic, Highlight, Link
    - Link button opens an inline URL input popover
    - _Requirements: 6.2_

  - [x] 8.4 Implement custom `ImageUploadBlock` TipTap node
    - Accepts file via drag-and-drop or file picker
    - Shows upload progress placeholder while POSTing to `POST /api/cms/upload`
    - On success: replace placeholder with `<img src={cdnUrl} />`
    - On failure: show inline error, remove placeholder, fire toast notification
    - _Requirements: 6.3–6.5_

  - [x] 8.5 Create `TipTapEditor` wrapper component
    - Compose all extensions, `SlashCommandMenu`, `FloatingToolbar`, `ImageUploadBlock`, and `DragHandle`
    - Expose `content` prop (initial `ContentBlock[]`) and `onChange` callback
    - Serialize editor state to `ContentBlock[]` JSON on every change
    - _Requirements: 6.7–6.8_

- [x] 9. Build Post Editor View (`PostEditorView`)
  - [x] 9.1 Implement `EditorTopBar` component
    - Back arrow (navigates to post list), `TitleInput` (large, borderless), `StatusBadge`
    - Action buttons: "Save Draft" (writer + admin), "Submit for Review" (writer + admin), "Publish" (admin only), "Unpublish" (admin only)
    - Show auto-save status indicator ("Saving…" / "Saved" / warning banner on failure)
    - _Requirements: 8.1–8.6_

  - [x] 9.2 Implement `MetadataPanel` (collapsible right sidebar)
    - `CategorySelect` (dropdown), `TagsInput` (comma-separated chips), `CoverImageUpload` (calls `POST /api/cms/upload`)
    - `SEOPanel`: `SeoTitleInput` (max 60, live char count), `SeoDescriptionTextarea` (max 160, live char count), `OgImageUpload`
    - Panel collapses to an icon strip on narrow viewports
    - _Requirements: 7.1–7.4_

  - [x] 9.3 Implement `DocumentOutline` sidebar (collapsible left)
    - Reads heading nodes from TipTap editor state and renders a clickable outline
    - Clicking a heading scrolls the editor to that block
    - _Requirements: 6.1_

  - [x] 9.4 Wire `PostEditorView` — data loading, saving, and slug logic
    - On mount: if `?templateId` present, fetch template and initialize editor with `defaultBlocks`; if `/:id/edit`, fetch post via `GET /api/cms/blogs/:id` and hydrate all fields
    - `generateSlug(title)` utility: lowercase, replace spaces with hyphens, strip non-alphanumeric (except hyphens), collapse consecutive hyphens
    - Auto-populate slug field from title; allow manual override
    - Save Draft: `POST /api/cms/blogs` (first save) or `PATCH /api/cms/blogs/:id` (subsequent); handle 409 slug conflict with inline error + suggested slug
    - Submit for Review / Publish / Unpublish: `PATCH /api/cms/blogs/:id` with new status
    - _Requirements: 9.1–9.4, 10.3–10.4, 15.2–15.3_

  - [x] 9.5 Implement auto-save logic
    - `setInterval` every 30 seconds; only fires when post has been saved at least once (has `_id`)
    - Calls `PATCH /api/cms/blogs/:id` with current editor state
    - Silent retry once on failure; show non-blocking warning banner in `EditorTopBar` if second attempt also fails
    - Clear interval on component unmount
    - _Requirements: 6.6_

- [x] 10. Checkpoint — CMS frontend complete
  - Verify full write flow: create post → select template → write content → upload image → submit for review
  - Ensure mobile layout is responsive (Tailwind breakpoints `sm:`, `md:`, `lg:`)
  - Ask the user if questions arise before proceeding to public blog.

- [x] 11. Build public blog post page
  - [x] 11.1 Create `BlockRenderer` component (`frontend/src/components/blog/BlockRenderer.tsx`)
    - Map each `ContentBlock.type` to its semantic HTML element:
      - `heading` → `<h1>`–`<h6>` (via `attrs.level`)
      - `paragraph` → `<p>`
      - `blockquote` → `<blockquote>`
      - `codeBlock` → `<pre><code>`
      - `image` → `<img>`
      - `orderedList` → `<ol>` with `<li>` children
      - `bulletList` → `<ul>` with `<li>` children
      - `table` → `<table>` with `<thead>` / `<tbody>` / `<tr>` / `<td>`
    - Apply Tailwind prose classes for clean typography
    - _Requirements: 1.3_

  - [x] 11.2 Create `BlogPost` page (`frontend/src/pages/blog/BlogPost.tsx`)
    - Fetch `GET /api/blogs/:slug` on mount; show loading skeleton while fetching
    - Render `PostMeta` (author name, publication date, read time, category) and `BlockRenderer`
    - 404 state: "Post not found" message with link back to `/`
    - API error state: generic error message, no crash
    - Back-to-blog navigation link
    - _Requirements: 1.1–1.2, 1.5–1.6_

  - [x] 11.3 Add SEO `<Helmet>` to `BlogPost` page
    - Set `<title>` to `seoMeta.title` (fallback to `blog.title`)
    - Set `<meta name="description">` to `seoMeta.description`
    - Set `<meta property="og:image">` to `seoMeta.ogImage`
    - _Requirements: 1.4_

  - [x] 11.4 Extend `BlogApp.tsx` with `/:slug` route
    - Add `<Route path="/:slug" element={<BlogPost />} />` before the wildcard route
    - Keep existing `<Route path="/" element={<BlogHome />} />` intact
    - _Requirements: 1.1, 2.1_

  - [x] 11.5 Wire `BlogHome` cards to navigate to `/:slug`
    - Update `BlogCard` (or equivalent) in `BlogHome.tsx` to use `useNavigate` or `<Link to={`/${blog.slug}`}>` on click
    - _Requirements: 2.1–2.2_

- [x] 12. Implement `FavoriteButton` component
  - [x] 12.1 Build `FavoriteButton` dual-mode component
    - Anonymous mode: read/write `localStorage` key `blogFavorites` (JSON array of slugs); toggle on click
    - Authenticated mode (detect via `useAuthStore`): call `POST /api/blogs/:slug/favorite` or `DELETE /api/blogs/:slug/favorite`; fetch initial state from `GET /api/blogs/favorites` on mount
    - Render filled/outlined heart icon based on favorited state
    - _Requirements: 16.1–16.7_

  - [x] 12.2 Add `FavoriteButton` to `BlogPost` page
    - Place near post title or in a fixed action bar
    - _Requirements: 16.1_

  - [x] 12.3 Add `FavoriteIndicator` to `BlogHome` blog cards
    - Small heart icon + count if `favoritesCount > 0`; highlight if post is in user's favorites
    - _Requirements: 16.11_

- [x] 13. Final checkpoint — full integration
  - Verify end-to-end: publish a post in CMS → visible on public blog → favoritable by visitor
  - Verify slug conflict flow: duplicate title → 409 → suggested slug shown inline
  - Verify anonymous favorites persist on page refresh (localStorage)
  - Ask the user if questions arise before proceeding to property tests.

- [ ] 14. Property-based tests (fast-check)
  - [x] 14.1 Write property test for Content Block Round-Trip (Property 1)
    - Generate random `ContentBlock[]` arrays with `fc.array(fc.record({ type: fc.constantFrom('heading','paragraph','image','codeBlock','orderedList','bulletList','table','blockquote'), ... }))`
    - Assert `JSON.parse(JSON.stringify(blocks))` deep-equals original
    - **Property 1: Content Block Round-Trip**
    - **Validates: Requirements 6.7, 6.8, 6.9**

  - [x] 14.2 Write property test for Block Renderer Type Mapping (Property 2)
    - For each valid `ContentBlock` type, render `<BlockRenderer blocks={[block]} />` and assert the root element tag matches the expected semantic element
    - **Property 2: Block Renderer Type Mapping**
    - **Validates: Requirements 1.1, 1.3**

  - [x] 14.3 Write property test for Slug Generation Invariant (Property 3)
    - Generate arbitrary non-empty strings with `fc.string({ minLength: 1 })`
    - Assert output is lowercase, matches `/^[a-z0-9]+(-[a-z0-9]+)*$/`, no leading/trailing hyphens, no consecutive hyphens
    - **Property 3: Slug Generation Invariant**
    - **Validates: Requirements 9.1**

  - [x] 14.4 Write property test for Slug Uniqueness Invariant (Property 4)
    - Seed two posts with different `_id` values but the same slug; assert `POST /api/cms/blogs` returns 409 with `suggestedSlug`
    - **Property 4: Slug Uniqueness Invariant**
    - **Validates: Requirements 9.3, 9.4**

  - [x] 14.5 Write property test for Writer Role Cannot Publish (Property 5)
    - Generate writer-role users and arbitrary post states; assert `PATCH /api/cms/blogs/:id` with `{ status: 'PUBLISHED' }` always returns 403
    - **Property 5: Writer Role Cannot Publish**
    - **Validates: Requirements 8.4**

  - [x] 14.6 Write property test for Favorites Idempotency (Property 6)
    - Call `POST /api/blogs/:slug/favorite` N times (N generated by `fc.integer({ min: 1, max: 20 })`); assert `user.favoriteBlogPosts` contains exactly one entry for that post
    - **Property 6: Favorites Idempotency**
    - **Validates: Requirements 16.8**

  - [x] 14.7 Write property test for Favorites Filter — Only Published Posts Returned (Property 7)
    - Seed a user with a mix of PUBLISHED and non-PUBLISHED post IDs in `favoriteBlogPosts`; assert `GET /api/blogs/favorites` returns only PUBLISHED posts
    - **Property 7: Favorites Filter — Only Published Posts Returned**
    - **Validates: Requirements 16.10**

  - [x] 14.8 Write property test for CMS List Scoping Invariant (Property 8)
    - Generate multi-author post sets; assert `GET /api/cms/blogs` for a writer-role user never returns posts where `authorId !== req.user.userId`
    - **Property 8: CMS List Scoping Invariant**
    - **Validates: Requirements 4.1, 10.2**

  - [x] 14.9 Write property test for Author Ownership Invariant (Property 9)
    - Generate create-post requests with arbitrary `authorId` values in the body; assert stored `authorId` always equals the authenticated user's `userId`
    - **Property 9: Author Ownership Invariant**
    - **Validates: Requirements 10.6**

  - [x] 14.10 Write property test for SEO Meta Persistence Round-Trip (Property 10)
    - Generate valid `seoMeta` objects (title ≤ 60 chars, description ≤ 160 chars, URL string for ogImage); save via `PATCH`, fetch via `GET /api/cms/blogs/:id`, assert deep equality
    - **Property 10: SEO Meta Persistence Round-Trip**
    - **Validates: Requirements 7.4**

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All frontend components use Tailwind CSS with mobile-first responsive classes (`sm:`, `md:`, `lg:`)
- The TipTap editor layout is full-screen / distraction-free — no main app Navbar or Footer
- `generateSlug` is a pure utility function in `frontend/src/utils/slug.ts` — shared between editor and property tests
- Property tests use `fast-check` (already available or install with `npm install --save-dev fast-check`)
- Each property test is tagged: `Feature: blog-cms-system, Property N: <property_text>`
- Checkpoints at tasks 5, 10, and 13 are natural pause points to verify correctness before moving on
