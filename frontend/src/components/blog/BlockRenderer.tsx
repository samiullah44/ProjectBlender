import React from 'react';
import type { ContentBlock } from '@/types/blog';

// Re-export for consumers that import from this file
export type { ContentBlock };

interface BlockRendererProps {
  blocks: ContentBlock[];
}

/** Render inline text with marks (bold, italic, highlight, link) */
function renderInlineContent(nodes: ContentBlock[] | undefined): React.ReactNode {
  if (!nodes || nodes.length === 0) return null;

  return nodes.map((node, i) => {
    if (node.type === 'text') {
      let content: React.ReactNode = node.text ?? '';

      if (node.marks && node.marks.length > 0) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') {
            content = <strong key={`bold-${i}`}>{content}</strong>;
          } else if (mark.type === 'italic') {
            content = <em key={`em-${i}`}>{content}</em>;
          } else if (mark.type === 'highlight') {
            const color = mark.attrs?.color;
            content = (
              <mark
                key={`mark-${i}`}
                style={color ? { backgroundColor: color } : undefined}
                className="bg-yellow-200 text-yellow-900 rounded px-0.5"
              >
                {content}
              </mark>
            );
          } else if (mark.type === 'link') {
            content = (
              <a
                key={`link-${i}`}
                href={mark.attrs?.href ?? '#'}
                target={mark.attrs?.target ?? '_blank'}
                rel="noopener noreferrer"
                className="text-purple-600 underline hover:text-purple-800 transition-colors"
              >
                {content}
              </a>
            );
          }
        }
      }

      return <React.Fragment key={i}>{content}</React.Fragment>;
    }

    // Nested inline nodes (e.g. hardBreak)
    if (node.type === 'hardBreak') {
      return <br key={i} />;
    }

    // Recurse for any other inline node types
    return (
      <React.Fragment key={i}>
        {renderInlineContent(node.content)}
      </React.Fragment>
    );
  });
}

/** Render a single block node */
function renderBlock(block: ContentBlock, index: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const level = block.attrs?.level ?? 1;
      const safeLevel = Math.min(Math.max(level, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const headingClasses: Record<number, string> = {
        1: 'text-4xl font-extrabold mt-10 mb-4 text-gray-900',
        2: 'text-3xl font-bold mt-8 mb-3 text-gray-900',
        3: 'text-2xl font-bold mt-6 mb-2 text-gray-900',
        4: 'text-xl font-semibold mt-5 mb-2 text-gray-800',
        5: 'text-lg font-semibold mt-4 mb-1 text-gray-800',
        6: 'text-base font-semibold mt-3 mb-1 text-gray-700',
      };
      const cls = headingClasses[safeLevel] ?? headingClasses[1];
      const children = renderInlineContent(block.content);
      
      // Generate ID for anchoring
      const headingText = block.content?.map((n: any) => n.text ?? '').join('') || '';
      const id = headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      if (safeLevel === 1) return <h1 key={index} id={id} className={cls}>{children}</h1>;
      if (safeLevel === 2) return <h2 key={index} id={id} className={cls}>{children}</h2>;
      if (safeLevel === 3) return <h3 key={index} id={id} className={cls}>{children}</h3>;
      if (safeLevel === 4) return <h4 key={index} id={id} className={cls}>{children}</h4>;
      if (safeLevel === 5) return <h5 key={index} id={id} className={cls}>{children}</h5>;
      return <h6 key={index} id={id} className={cls}>{children}</h6>;
    }

    case 'paragraph': {
      return (
        <p key={index} className="text-gray-700 leading-relaxed mb-4 text-base">
          {renderInlineContent(block.content)}
        </p>
      );
    }

    case 'blockquote': {
      return (
        <blockquote
          key={index}
          className="border-l-4 border-purple-400 pl-5 py-1 my-6 italic text-gray-600 bg-purple-50 rounded-r-lg"
        >
          {block.content?.map((child, i) => renderBlock(child, i))}
        </blockquote>
      );
    }

    case 'codeBlock': {
      const language = block.attrs?.language ?? '';
      // Detect button blocks stored as codeBlock with language "button:<url>"
      if (language.startsWith('button:')) {
        const url = language.slice(7);
        const label = block.content?.map((n: any) => n.text ?? '').join('') || 'Click here';
        return (
          <div key={index} className="my-6">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white font-semibold text-sm hover:bg-gray-700 transition-colors no-underline"
            >
              {label}
            </a>
          </div>
        );
      }
      return (
        <pre
          key={index}
          className="bg-gray-900 text-gray-100 rounded-xl p-5 my-6 overflow-x-auto text-sm font-mono leading-relaxed"
        >
          <code className={language ? `language-${language}` : undefined}>
            {renderInlineContent(block.content)}
          </code>
        </pre>
      );
    }

    case 'image': {
      // TipTap v2 stores: { type: 'image', attrs: { src, alt, title, width, align } }
      const src = block.attrs?.src ?? block.attrs?.url ?? '';
      const alt = block.attrs?.alt ?? '';
      const title = block.attrs?.title ?? '';
      const width = block.attrs?.width || '100%';
      const align = block.attrs?.align || 'center';
      
      if (!src) return null;

      const alignClasses: Record<string, string> = {
        left: 'mr-auto',
        center: 'mx-auto',
        right: 'ml-auto',
      };

      return (
        <figure key={index} className="my-8 flex flex-col">
          <img
            src={src}
            alt={alt}
            title={title || undefined}
            style={{ width }}
            className={`max-w-full rounded-xl object-cover shadow-md transition-all duration-300 ${alignClasses[align] || 'mx-auto'}`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {title && (
            <figcaption className={`text-sm text-gray-500 mt-2 italic ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'}`}>
              {title}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'orderedList': {
      return (
        <ol
          key={index}
          className="list-decimal list-outside pl-6 my-4 space-y-1 text-gray-700"
        >
          {block.content?.map((item, i) => renderListItem(item, i))}
        </ol>
      );
    }

    case 'bulletList': {
      return (
        <ul
          key={index}
          className="list-disc list-outside pl-6 my-4 space-y-1 text-gray-700"
        >
          {block.content?.map((item, i) => renderListItem(item, i))}
        </ul>
      );
    }

    case 'listItem': {
      return renderListItem(block, index);
    }

    case 'table': {
      return renderTable(block, index);
    }

    default:
      // Fallback: render any nested content
      if (block.content && block.content.length > 0) {
        return (
          <div key={index}>
            {block.content.map((child, i) => renderBlock(child, i))}
          </div>
        );
      }
      if (block.text) {
        return <span key={index}>{block.text}</span>;
      }
      return null;
  }
}

function renderListItem(item: ContentBlock, index: number): React.ReactNode {
  // listItem typically wraps a paragraph; unwrap for cleaner output
  const children = item.content?.map((child, i) => {
    if (child.type === 'paragraph') {
      return (
        <React.Fragment key={i}>
          {renderInlineContent(child.content)}
        </React.Fragment>
      );
    }
    return renderBlock(child, i);
  });

  return (
    <li key={index} className="leading-relaxed">
      {children}
    </li>
  );
}

function renderTable(block: ContentBlock, index: number): React.ReactNode {
  const rows = block.content ?? [];

  // Separate header row(s) from body rows
  const headerRows: ContentBlock[] = [];
  const bodyRows: ContentBlock[] = [];

  for (const row of rows) {
    if (row.type === 'tableRow') {
      const hasHeader = row.content?.some(cell => cell.type === 'tableHeader');
      if (hasHeader) {
        headerRows.push(row);
      } else {
        bodyRows.push(row);
      }
    }
  }

  const renderCell = (cell: ContentBlock, cellIndex: number): React.ReactNode => {
    const isHeader = cell.type === 'tableHeader';
    const Tag = isHeader ? 'th' : 'td';
    const cellClass = isHeader
      ? 'px-4 py-3 text-left text-sm font-semibold text-gray-900 bg-gray-100 border border-gray-200'
      : 'px-4 py-3 text-sm text-gray-700 border border-gray-200';

    return (
      <Tag key={cellIndex} className={cellClass}>
        {cell.content?.map((child, i) => renderBlock(child, i))}
      </Tag>
    );
  };

  const renderRow = (row: ContentBlock, rowIndex: number): React.ReactNode => (
    <tr key={rowIndex} className="even:bg-gray-50">
      {row.content?.map((cell, ci) => renderCell(cell, ci))}
    </tr>
  );

  return (
    <div key={index} className="my-6 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full border-collapse text-sm">
        {headerRows.length > 0 && (
          <thead>
            {headerRows.map((row, ri) => renderRow(row, ri))}
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, ri) => renderRow(row, ri))}
        </tbody>
      </table>
    </div>
  );
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="max-w-none">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
};

export default BlockRenderer;
