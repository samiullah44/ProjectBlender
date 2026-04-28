import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';

interface DocumentOutlineProps {
  editor: Editor | null;
}

interface HeadingItem {
  level: number;
  text: string;
  index: number;
}

function extractHeadings(editor: Editor): HeadingItem[] {
  const json = editor.getJSON();
  const headings: HeadingItem[] = [];
  let headingIndex = 0;

  const traverse = (nodes: typeof json.content) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'heading') {
        const text = node.content
          ?.map((n) => (n.type === 'text' ? n.text ?? '' : ''))
          .join('') ?? '';
        headings.push({ level: node.attrs?.level ?? 1, text, index: headingIndex });
        headingIndex++;
      }
      if (node.content) traverse(node.content);
    }
  };

  traverse(json.content);
  return headings;
}

const INDENT: Record<number, string> = {
  1: '',
  2: 'pl-3',
  3: 'pl-6',
  4: 'pl-9',
  5: 'pl-12',
  6: 'pl-15',
};

const DocumentOutline: React.FC<DocumentOutlineProps> = ({ editor }) => {
  const [expanded, setExpanded] = useState(true);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  const refresh = useCallback(() => {
    if (editor) setHeadings(extractHeadings(editor));
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    refresh();
    editor.on('transaction', refresh);
    return () => {
      editor.off('transaction', refresh);
    };
  }, [editor, refresh]);

  const scrollToHeading = (index: number) => {
    if (!editor) return;
    editor.commands.focus();
    const headingElements = document.querySelectorAll(
      '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6'
    );
    headingElements[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside
      className={`
        flex flex-col bg-gray-900 border-r border-gray-700 transition-all duration-200
        ${expanded ? 'w-56' : 'w-12'}
        shrink-0 h-full overflow-hidden
      `}
    >
      {/* Toggle button */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-700 shrink-0">
        {expanded && (
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">
            Outline
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label={expanded ? 'Collapse outline' : 'Expand outline'}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Collapsed icon strip */}
      {!expanded && (
        <div className="flex flex-col items-center pt-3 text-gray-500">
          <List size={18} title="Document Outline" />
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="flex-1 overflow-y-auto py-2">
          {headings.length === 0 ? (
            <p className="text-xs text-gray-600 px-3 pt-2">No headings yet</p>
          ) : (
            <ul className="space-y-0.5">
              {headings.map((h) => (
                <li key={h.index}>
                  <button
                    onClick={() => scrollToHeading(h.index)}
                    className={`
                      w-full text-left text-xs text-gray-400 hover:text-white hover:bg-gray-800
                      px-3 py-1 rounded transition-colors truncate
                      ${INDENT[h.level] ?? ''}
                    `}
                    title={h.text}
                  >
                    {h.text || <span className="italic text-gray-600">Untitled</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
};

export default DocumentOutline;
