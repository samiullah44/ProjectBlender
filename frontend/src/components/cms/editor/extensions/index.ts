import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { ResizableImage } from './ResizableImage'
import Placeholder from '@tiptap/extension-placeholder'

export const editorExtensions = [
  StarterKit,
  Highlight,
  Link.configure({ openOnClick: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  ResizableImage,
  Placeholder.configure({ placeholder: "Type '/' for commands…" }),
]
