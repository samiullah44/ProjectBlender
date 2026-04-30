import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { useAuthStore } from '@/stores/authStore';
import { generateSlug } from '../../utils/slug';
import EditorTopBar from '../../components/cms/editor/EditorTopBar';
import { FloatingToolbar } from '../../components/cms/editor/FloatingToolbar';
import { SlashCommandMenu } from '../../components/cms/editor/SlashCommandMenu';
import { ImageUploadBlock } from '../../components/cms/editor/ImageUploadBlock';
import { editorExtensions } from '../../components/cms/editor/extensions';
import type { ContentBlock } from '@/types/blog';
import MetadataPanel from '../../components/cms/editor/MetadataPanel';
import DocumentOutline from '../../components/cms/editor/DocumentOutline';

type PostStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

const PostEditorView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');

  const user = useAuthStore((s) => s.user);
  const isAdmin = !!(user?.roles?.includes('admin') || user?.role === 'admin');

  const [postId, setPostId] = useState<string | null>(id ?? null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<PostStatus>('DRAFT');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [readTime, setReadTime] = useState('5 min read');
  const [isFeatured, setIsFeatured] = useState(false);

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [slugConflictSuggestion, setSlugConflictSuggestion] = useState('');

  const postIdRef = useRef<string | null>(id ?? null);
  const slugManuallySet = useRef(false);
  // Store latest contentBlocks in a ref so savePost always reads fresh value
  const contentBlocksRef = useRef<ContentBlock[]>([]);

  const setPostIdBoth = (newId: string) => {
    postIdRef.current = newId;
    setPostId(newId);
  };

  // ── Single TipTap editor instance ────────────────────────────────────────
  const editor = useEditor({
    extensions: editorExtensions,
    editable: true,
    onUpdate: ({ editor: e }) => {
      const blocks = (e.getJSON().content ?? []) as ContentBlock[];
      contentBlocksRef.current = blocks;
    },
  });

  // ── Load post or template on mount ───────────────────────────────────────
  useEffect(() => {
    if (templateId) loadTemplate(templateId);
    else if (id) loadPost(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEditorContent = useCallback((blocks: ContentBlock[]) => {
    if (!editor) return;
    contentBlocksRef.current = blocks;
    if (blocks.length > 0) {
      editor.commands.setContent({ type: 'doc', content: blocks as any[] }, false);
    } else {
      editor.commands.clearContent(false);
    }
  }, [editor]);

  const loadTemplate = async (tmplId: string) => {
    try {
      const res = await fetch('/api/cms/templates', { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const template = (data.templates as any[]).find((t: any) => t._id === tmplId);
      if (template) {
        const blocks: ContentBlock[] = template.sections.flatMap((s: any) => s.defaultBlocks ?? []);
        setEditorContent(blocks);
      }
    } catch { /* ignore */ }
  };

  const loadPost = async (postIdToLoad: string) => {
    try {
      const res = await fetch(`/api/cms/blogs/${postIdToLoad}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const blog = data.blog;
      setTitle(blog.title ?? '');
      setSlug(blog.slug ?? '');
      setStatus(blog.status ?? 'DRAFT');
      setCategory(blog.category ?? '');
      setTags(blog.tags ?? []);
      setCoverImage(blog.coverImage ?? '');
      setSeoTitle(blog.seoMeta?.title ?? '');
      setSeoDescription(blog.seoMeta?.description ?? '');
      setOgImage(blog.seoMeta?.ogImage ?? '');
      setReadTime(blog.readTime ?? '5 min read');
      setIsFeatured(blog.isFeatured ?? false);
      setPostIdBoth(blog._id);
      slugManuallySet.current = true;

      // Load content into editor — handle both flat array and doc wrapper
      const rawBlocks = blog.contentBlocks ?? [];
      const blocks: ContentBlock[] = Array.isArray(rawBlocks)
        ? rawBlocks
        : (rawBlocks?.content ?? []);
      setEditorContent(blocks);
    } catch { /* ignore */ }
  };

  // Re-run setEditorContent once editor is ready (handles async mount timing)
  const editorReadyRef = useRef(false);
  useEffect(() => {
    if (editor && !editorReadyRef.current) {
      editorReadyRef.current = true;
      if (id) loadPost(id);
      else if (templateId) loadTemplate(templateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ── Slug logic ────────────────────────────────────────────────────────────
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!slugManuallySet.current) setSlug(generateSlug(newTitle));
  };

  const handleSlugChange = (newSlug: string) => {
    setSlug(newSlug);
    slugManuallySet.current = true;
    setSlugError('');
    setSlugConflictSuggestion('');
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const titleRef = useRef(title);
  const slugRef = useRef(slug);
  const statusRef = useRef(status);
  const categoryRef = useRef(category);
  const tagsRef = useRef(tags);
  const coverImageRef = useRef(coverImage);
  const seoTitleRef = useRef(seoTitle);
  const seoDescriptionRef = useRef(seoDescription);
  const ogImageRef = useRef(ogImage);
  const readTimeRef = useRef(readTime);
  const isFeaturedRef = useRef(isFeatured);

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { slugRef.current = slug; }, [slug]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { coverImageRef.current = coverImage; }, [coverImage]);
  useEffect(() => { seoTitleRef.current = seoTitle; }, [seoTitle]);
  useEffect(() => { seoDescriptionRef.current = seoDescription; }, [seoDescription]);
  useEffect(() => { ogImageRef.current = ogImage; }, [ogImage]);
  useEffect(() => { readTimeRef.current = readTime; }, [readTime]);
  useEffect(() => { isFeaturedRef.current = isFeatured; }, [isFeatured]);

  const savePost = useCallback(async (overrideStatus?: PostStatus): Promise<boolean> => {
    if (!titleRef.current.trim()) {
      setSlugError('Title is required to save');
      return false;
    }

    setIsSaving(true);
    setSlugError('');
    setSlugConflictSuggestion('');

    const payload = {
      title: titleRef.current,
      slug: slugRef.current,
      status: overrideStatus ?? statusRef.current,
      category: categoryRef.current,
      tags: tagsRef.current,
      coverImage: coverImageRef.current,
      readTime: readTimeRef.current,
      isFeatured: isFeaturedRef.current,
      contentBlocks: contentBlocksRef.current,
      seoMeta: {
        title: seoTitleRef.current,
        description: seoDescriptionRef.current,
        ogImage: ogImageRef.current,
      },
    };

    try {
      const currentId = postIdRef.current;
      const res = await fetch(
        currentId ? `/api/cms/blogs/${currentId}` : '/api/cms/blogs',
        {
          method: currentId ? 'PATCH' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 409) {
        const data = await res.json();
        setSlugError(data.error ?? 'Slug already exists');
        setSlugConflictSuggestion(data.suggestedSlug ?? '');
        return false;
      }
      if (!res.ok) return false;

      const data = await res.json();
      if (data.blog?._id && !postIdRef.current) setPostIdBoth(data.blog._id);
      if (overrideStatus) setStatus(overrideStatus);
      setAutoSaveStatus('saved');
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleSaveDraft = () => savePost();
  const handleSubmitForReview = async () => {
    if (!postIdRef.current) {
      const ok = await savePost('DRAFT');
      if (!ok) return;
    }
    await savePost('IN_REVIEW');
  };
  const handlePublish = () => savePost('PUBLISHED');
  const handleUnpublish = () => savePost('DRAFT');

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!postIdRef.current) return;
      setAutoSaveStatus('saving');
      const ok = await savePost();
      if (!ok) {
        const retry = await savePost();
        setAutoSaveStatus(retry ? 'saved' : 'error');
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [savePost]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <EditorTopBar
        title={title}
        onTitleChange={handleTitleChange}
        status={status}
        isAdmin={isAdmin}
        autoSaveStatus={autoSaveStatus}
        onSaveDraft={handleSaveDraft}
        onSubmitForReview={handleSubmitForReview}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        isSaving={isSaving}
      />

      {/* Slug row */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-1.5 flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Slug:</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          placeholder="post-slug"
          className={`flex-1 bg-transparent text-xs outline-none text-gray-300 placeholder-gray-600 border-b ${
            slugError ? 'border-red-500' : 'border-transparent focus:border-gray-600'
          }`}
        />
        {slugError && (
          <span className="text-xs text-red-400 shrink-0">
            {slugError}
            {slugConflictSuggestion && (
              <button
                className="ml-1 underline text-amber-400"
                onClick={() => { setSlug(slugConflictSuggestion); setSlugError(''); setSlugConflictSuggestion(''); }}
              >
                Use "{slugConflictSuggestion}"
              </button>
            )}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <DocumentOutline editor={editor} />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Editor area */}
          <div className="relative w-full">
            <div
              className="relative w-full min-h-[400px] rounded-lg bg-gray-900 text-gray-100
                [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-6 [&_.ProseMirror]:outline-none
                [&_.ProseMirror]:text-gray-100
                [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:text-white
                [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-white
                [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-white
                [&_.ProseMirror_p]:mb-3 [&_.ProseMirror_p]:leading-relaxed
                [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-3
                [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-3
                [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-indigo-500 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-gray-400
                [&_.ProseMirror_pre]:bg-gray-800 [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:mb-3
                [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-4
                [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:mb-4
                [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-600 [&_.ProseMirror_td]:p-2
                [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-600 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-800 [&_.ProseMirror_th]:font-semibold
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-500
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
            >
              <EditorContent editor={editor} />
              {editor && <FloatingToolbar editor={editor} />}
              {editor && <SlashCommandMenu editor={editor} />}
            </div>
            {editor && (
              <div className="mt-4">
                <ImageUploadBlock editor={editor} />
              </div>
            )}
          </div>
        </main>

        <MetadataPanel
          category={category}
          onCategoryChange={setCategory}
          tags={tags}
          onTagsChange={setTags}
          coverImage={coverImage}
          onCoverImageChange={setCoverImage}
          seoTitle={seoTitle}
          onSeoTitleChange={setSeoTitle}
          seoDescription={seoDescription}
          onSeoDescriptionChange={setSeoDescription}
          ogImage={ogImage}
          onOgImageChange={setOgImage}
          readTime={readTime}
          onReadTimeChange={setReadTime}
          isFeatured={isFeatured}
          onIsFeaturedChange={setIsFeatured}
        />
      </div>
    </div>
  );
};

export default PostEditorView;
