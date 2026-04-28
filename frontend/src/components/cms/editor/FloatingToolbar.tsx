import { useState, useRef } from 'react'
import { BubbleMenu, Editor } from '@tiptap/react'
import { Bold, Italic, Highlighter, Link } from 'lucide-react'

interface FloatingToolbarProps {
  editor: Editor
}

export function FloatingToolbar({ editor }: FloatingToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleLinkButtonClick = () => {
    // Pre-fill with existing link href if cursor is on a link
    const existingHref = editor.getAttributes('link').href ?? ''
    setLinkUrl(existingHref)
    setShowLinkInput(true)
    // Focus the input on next tick after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const submitLink = () => {
    const url = linkUrl.trim()
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const cancelLink = () => {
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const handleLinkKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitLink()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelLink()
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-gray-900 p-1 shadow-xl"
    >
      {showLinkInput ? (
        <div className="flex items-center gap-1 px-1">
          <input
            ref={inputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="https://..."
            className="w-48 rounded bg-gray-800 px-2 py-1 text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); submitLink() }}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-400 hover:bg-white/10 hover:text-indigo-300 transition-colors"
          >
            Apply
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); cancelLink() }}
            className="rounded px-2 py-1 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <Bold size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <Italic size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            title="Highlight"
          >
            <Highlighter size={14} />
          </ToolbarButton>

          <div className="mx-0.5 h-4 w-px bg-white/10" />

          <ToolbarButton
            onClick={handleLinkButtonClick}
            isActive={editor.isActive('link')}
            title="Link"
          >
            <Link size={14} />
          </ToolbarButton>
        </>
      )}
    </BubbleMenu>
  )
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        isActive
          ? 'bg-indigo-600 text-white'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
