import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface Template {
  _id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
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

const TemplateSelectModal = ({ onClose }: Props) => {
  const navigate = useNavigate();

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
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
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

        {/* Body */}
        <div className="p-6">
          {isLoading && (
            <div className="text-gray-400 text-center py-8">Loading templates...</div>
          )}

          {isError && (
            <div className="text-red-400 text-center py-8">Failed to load templates.</div>
          )}

          {!isLoading && !isError && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Blank option */}
              <button
                onClick={handleBlank}
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
                  className="flex flex-col items-start gap-2 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-indigo-500 rounded-lg text-left transition-all group"
                >
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <div className="font-medium text-white text-sm group-hover:text-indigo-300 transition-colors">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {template.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelectModal;
