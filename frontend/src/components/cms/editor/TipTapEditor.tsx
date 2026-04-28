import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from './extensions'
import { FloatingToolbar } from './FloatingToolbar'
import { SlashCommandMenu } from './SlashCommandMenu'
import { ImageUploadBlock } from './ImageUploadBlock'
import type { ContentBlock } from '@/types/blog'

export type { ContentBlock }

interface TipTapEditorProps {
  content?: ContentBlock[]
  onChange?: (blocks: ContentBlock[]) => void
  editable?: boolean
}

export function TipTapEditor({ content, onChange, editable = true }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: editorExtensions,
    editable,
    content: content && content.length > 0
      ? { type: 'doc', content: content as any[] }
      : undefined,
    onUpdate: ({ editor }) => {
      if (onChange) {
        const blocks = (editor.getJSON().content ?? []) as ContentBlock[]
        onChange(blocks)
      }
    },
  })

  // Sync editable prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  return (
    <div className="relative w-full">
      <div
        className="relative w-full min-h-[400px] rounded-lg bg-gray-900 text-gray-100 prose prose-invert max-w-none
          [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-6 [&_.ProseMirror]:outline-none
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
  )
}
