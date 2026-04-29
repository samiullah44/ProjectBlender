import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ImageIcon, LayoutTemplate, SearchCode, Type, List, Quote, Table2 } from 'lucide-react';

interface Template {
  _id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  sections?: Array<{
    label: string;
    defaultBlocks: any[];
  }>;
}

interface TemplatesResponse {
  success: boolean;
  templates: Template[];
}

interface Props {
  onClose: () => void;
}

async function fetchTemplates(): Promise<TemplatesResponse> {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/cms/templates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

function renderBlockWireframe(block: any, index: number) {
  const type = block.type;
  switch (type) {
    case 'heading':
      return (
        <div key={index} className="flex gap-2 items-center mb-2">
          <Type size={14} className="text-gray-500 shrink-0" />
          <div className="h-4 bg-gray-600 rounded w-3/4"></div>
        </div>
      );
    case 'paragraph':
      return (
        <div key={index} className="flex flex-col gap-1.5 mb-3 pl-5">
          <div className="h-2 bg-gray-700 rounded w-full"></div>
          <div className="h-2 bg-gray-700 rounded w-11/12"></div>
          <div className="h-2 bg-gray-700 rounded w-4/5"></div>
        </div>
      );
    case 'image':
      return (
        <div key={index} className="flex items-center justify-center h-20 bg-gray-800 border border-gray-700 rounded mb-3">
          <ImageIcon size={20} className="text-gray-600" />
        </div>
      );
    case 'codeBlock':
      return (
        <div key={index} className="flex items-start gap-2 bg-gray-900 border border-gray-800 p-2 rounded mb-3">
          <SearchCode size={14} className="text-gray-600 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1 w-full mt-1">
            <div className="h-1.5 bg-gray-700 rounded w-1/2"></div>
            <div className="h-1.5 bg-indigo-900/50 rounded w-2/3"></div>
            <div className="h-1.5 bg-gray-700 rounded w-1/3"></div>
          </div>
        </div>
      );
    case 'bulletList':
    case 'orderedList':
      return (
        <div key={index} className="flex flex-col gap-2 mb-3 pl-5">
          <div className="flex items-center gap-2"><List size={10} className="text-gray-500" /><div className="h-2 bg-gray-700 rounded w-2/3"></div></div>
          <div className="flex items-center gap-2"><List size={10} className="text-gray-500" /><div className="h-2 bg-gray-700 rounded w-3/4"></div></div>
        </div>
      );
    case 'blockquote':
      return (
        <div key={index} className="flex items-start gap-2 mb-3 pl-2 border-l-2 border-indigo-500/50">
          <Quote size={12} className="text-gray-500 shrink-0" />
          <div className="h-2 bg-gray-700 rounded w-5/6 mt-1.5"></div>
        </div>
      );
    case 'table':
      return (
        <div key={index} className="flex items-center justify-center p-2 border border-gray-700 rounded mb-3 bg-gray-800/50">
           <Table2 size={24} className="text-gray-600" />
        </div>
      )
    default:
      return <div key={index} className="h-2 bg-gray-800 rounded w-full mb-2"></div>;
  }
}

const TemplateSelectModal = ({ onClose }: Props) => {
  const navigate = useNavigate();
  const [hoveredTemplate, setHoveredTemplate] = useState<Template | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cms-templates'],
    queryFn: fetchTemplates,
  });

  const templates = data?.templates ?? [];

  const handleSelectTemplate = (templateId: string) => {
    navigate(`/dashboard/content-studio/new?templateId=${templateId}`);
    onClose();
  };

  const handleBlank = () => {
    navigate('/dashboard/content-studio/new');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-white">Choose a template</h2>
            <p className="text-sm text-gray-400 mt-1">Start with a structure or begin from scratch</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Template Grid */}
          <div className="flex-1 p-6 overflow-y-auto border-r border-gray-800">
            {isLoading && (
              <div className="text-gray-400 text-center py-8">Loading templates...</div>
            )}

            {isError && (
              <div className="text-red-400 text-center py-8">Failed to load templates.</div>
            )}

            {!isLoading && !isError && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Blank option */}
                <button
                  onClick={handleBlank}
                  onMouseEnter={() => setHoveredTemplate(null)}
                  className="flex flex-col items-start gap-2 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-indigo-500 rounded-lg text-left transition-all group"
                >
                  <span className="text-2xl">📄</span>
                  <div>
                    <div className="font-medium text-white text-sm group-hover:text-indigo-300 transition-colors">
                      Start with blank
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">Empty editor, full freedom</div>
                  </div>
                </button>

                {/* Template cards */}
                {templates.map((template) => (
                  <button
                    key={template._id}
                    onClick={() => handleSelectTemplate(template._id)}
                    onMouseEnter={() => setHoveredTemplate(template)}
                    className="flex flex-col items-start gap-2 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-indigo-500 rounded-lg text-left transition-all group"
                  >
                    <span className="text-2xl">{template.icon}</span>
                    <div>
                      <div className="font-medium text-white text-sm group-hover:text-indigo-300 transition-colors">
                        {template.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 max-h-8 overflow-hidden text-ellipsis">
                        {template.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Structural Preview Pane */}
          <div className="hidden lg:flex w-80 bg-gray-950 flex-col shrink-0">
            <div className="p-4 border-b border-gray-800 bg-gray-900/50 block">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><LayoutTemplate size={14}/> Structure Preview</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-800">
              {hoveredTemplate ? (
                <div className="space-y-6">
                  {hoveredTemplate.sections?.map((section, idx) => (
                    <div key={idx}>
                      <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-3">
                        {section.label}
                      </div>
                      <div className="ml-1 border-l-2 border-gray-800/50 pl-3">
                        {section.defaultBlocks?.map((block, bIdx) => renderBlockWireframe(block, bIdx))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 text-center space-y-3">
                  <LayoutTemplate size={32} className="opacity-50" />
                  <p className="text-sm">Hover over a template to preview its block structure here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelectModal;
