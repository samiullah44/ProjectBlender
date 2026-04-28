import { useEffect, useRef, useState, useCallback } from 'react'
import { Editor } from '@tiptap/react'
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  Quote,
  Code,
  ListOrdered,
  List,
  Table,
  Image,
  MousePointerClick,
} from 'lucide-react'

interface SlashCommand {
  label: string
  description: string
  icon: React.ReactNode
  keywords: string[]
  action: (editor: Editor) => void
}

const COMMANDS: SlashCommand[] = [
  {
    label: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 size={16} />,
    keywords: ['h1', 'heading', 'title'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 size={16} />,
    keywords: ['h2', 'heading', 'subtitle'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 size={16} />,
    keywords: ['h3', 'heading'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'Paragraph',
    description: 'Plain text paragraph',
    icon: <Type size={16} />,
    keywords: ['p', 'text', 'paragraph'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).setParagraph().run(),
  },
  {
    label: 'Blockquote',
    description: 'Highlighted quote block',
    icon: <Quote size={16} />,
    keywords: ['quote', 'blockquote'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).toggleBlockquote().run(),
  },
  {
    label: 'Code Block',
    description: 'Monospace code block',
    icon: <Code size={16} />,
    keywords: ['code', 'pre', 'codeblock'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).toggleCodeBlock().run(),
  },
  {
    label: 'Ordered List',
    description: 'Numbered list',
    icon: <ListOrdered size={16} />,
    keywords: ['ol', 'ordered', 'numbered', 'list'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).toggleOrderedList().run(),
  },
  {
    label: 'Bullet List',
    description: 'Unordered bullet list',
    icon: <List size={16} />,
    keywords: ['ul', 'bullet', 'unordered', 'list'],
    action: (editor) =>
      editor.chain().focus().deleteRange(editor.state.selection).toggleBulletList().run(),
  },
  {
    label: 'Table',
    description: 'Custom size table',
    icon: <Table size={16} />,
    keywords: ['table', 'grid'],
    action: (editor) => {
      const input = window.prompt('Table size (rows x cols), e.g. 4x3:', '3x3')
      if (!input) return
      const parts = input.toLowerCase().replace(/\s/g, '').split('x')
      const rows = Math.max(1, Math.min(20, parseInt(parts[0]) || 3))
      const cols = Math.max(1, Math.min(10, parseInt(parts[1]) || 3))
      editor
        .chain()
        .focus()
        .deleteRange(editor.state.selection)
        .insertTable({ rows, cols, withHeaderRow: true })
        .run()
    },
  },
  {
    label: 'Button',
    description: 'Clickable call-to-action button',
    icon: <MousePointerClick size={16} />,
    keywords: ['button', 'cta', 'link', 'action'],
    action: (editor) => {
      const label = window.prompt('Button label:', 'Click here')
      if (!label) return
      const url = window.prompt('Button URL:', 'https://')
      if (!url) return
      // Store as a codeBlock with language "button:<url>" — BlockRenderer detects this
      editor
        .chain()
        .focus()
        .deleteRange(editor.state.selection)
        .insertContent({
          type: 'codeBlock',
          attrs: { language: `button:${url}` },
          content: [{ type: 'text', text: label }],
        })
        .run()
    },
  },
  {
    label: 'Image',
    description: 'Embed an image via URL',
    icon: <Image size={16} />,
    keywords: ['image', 'img', 'photo', 'picture'],
    action: (editor) => {
      const url = window.prompt('Enter image URL')
      if (url) {
        editor.chain().focus().deleteRange(editor.state.selection).setImage({ src: url }).run()
      }
    },
  },
]

interface MenuPosition {
  top: number
  left: number
}

interface SlashCommandMenuProps {
  editor: Editor
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const slashStartRef = useRef<number | null>(null)

  const filteredCommands = COMMANDS.filter((cmd) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q))
    )
  })

  const isOpenRef = useRef(false)

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    isOpenRef.current = false
    setQuery('')
    setSelectedIndex(0)
    slashStartRef.current = null
  }, [])

  const openMenu = useCallback(() => {
    setIsOpen(true)
    isOpenRef.current = true
  }, [])

  const executeCommand = useCallback(
    (cmd: SlashCommand) => {
      if (!editor) return
      // Delete from the slash position to current cursor
      const { from } = editor.state.selection
      const start = slashStartRef.current ?? from
      editor.chain().focus().deleteRange({ from: start, to: from }).run()
      cmd.action(editor)
      closeMenu()
    },
    [editor, closeMenu]
  )

  // Listen to editor updates to detect `/` trigger and query changes
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      const { state } = editor
      const { from } = state.selection
      const textBefore = state.doc.textBetween(
        Math.max(0, from - 50),
        from,
        '\n',
        '\0'
      )

      // Find the last `/` in the text before cursor
      const slashIndex = textBefore.lastIndexOf('/')
      if (slashIndex === -1) {
        if (isOpenRef.current) closeMenu()
        return
      }

      // Check that the slash is at the start of a block or preceded only by whitespace
      const beforeSlash = textBefore.slice(0, slashIndex)
      // Allow slash at start of line (after newline or at very beginning)
      const lastNewline = beforeSlash.lastIndexOf('\n')
      const textOnLine = lastNewline === -1 ? beforeSlash : beforeSlash.slice(lastNewline + 1)
      const isAtLineStart = textOnLine.trim() === ''

      if (!isAtLineStart) {
        if (isOpenRef.current) closeMenu()
        return
      }

      // Calculate absolute position of the slash in the document
      const absoluteSlashPos = from - (textBefore.length - slashIndex)
      slashStartRef.current = absoluteSlashPos

      // Extract query text after the slash
      const afterSlash = textBefore.slice(slashIndex + 1)
      setQuery(afterSlash)
      setSelectedIndex(0)

      // Get cursor DOM position for menu placement
      const domSelection = window.getSelection()
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const editorEl = editor.view.dom
        const editorRect = editorEl.getBoundingClientRect()

        setPosition({
          top: rect.bottom - editorRect.top + 8,
          left: Math.max(0, rect.left - editorRect.left),
        })
      }

      openMenu()
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, closeMenu, openMenu])

  // Keyboard navigation
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((i) => (i + 1) % Math.max(1, filteredCommands.length))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((i) =>
          i === 0 ? Math.max(0, filteredCommands.length - 1) : i - 1
        )
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex])
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
      }
    }

    // Attach to the editor DOM element
    const editorDom = editor.view.dom
    editorDom.addEventListener('keydown', handleKeyDown, true)
    return () => {
      editorDom.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [editor, isOpen, filteredCommands, selectedIndex, executeCommand, closeMenu])

  // Click outside to dismiss
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, closeMenu])

  if (!isOpen || filteredCommands.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-64 rounded-lg border border-white/10 bg-gray-900 shadow-xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 text-xs text-gray-500 border-b border-white/10">
        Block type
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {filteredCommands.map((cmd, index) => (
          <li key={cmd.label}>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-200 hover:bg-white/5'
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault()
                executeCommand(cmd)
              }}
            >
              <span
                className={`shrink-0 ${
                  index === selectedIndex ? 'text-white' : 'text-gray-400'
                }`}
              >
                {cmd.icon}
              </span>
              <div>
                <div className="text-sm font-medium leading-tight">{cmd.label}</div>
                <div
                  className={`text-xs leading-tight ${
                    index === selectedIndex ? 'text-indigo-200' : 'text-gray-500'
                  }`}
                >
                  {cmd.description}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
