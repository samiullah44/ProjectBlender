import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import StatusBadge from '@/pages/cms/StatusBadge';

interface EditorTopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
  canPublish: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSaveDraft: () => void;
  onSubmitForReview: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onPreview: () => void;
  isSaving: boolean;
}

const EditorTopBar: React.FC<EditorTopBarProps> = ({
  title,
  onTitleChange,
  status,
  canPublish,
  autoSaveStatus,
  onSaveDraft,
  onSubmitForReview,
  onPublish,
  onUnpublish,
  onPreview,
  isSaving,
}) => {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50">
      {/* Main top bar */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center gap-3">
        {/* Back arrow */}
        <button
          onClick={() => navigate('/dashboard/content-studio')}
          className="shrink-0 p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label="Back to post list"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Post title…"
          className="flex-1 bg-transparent border-none outline-none text-white text-lg font-semibold placeholder-gray-500 min-w-0"
        />

        {/* Status badge */}
        <div className="shrink-0">
          <StatusBadge status={status} />
        </div>

        {/* Auto-save indicator */}
        <div className="shrink-0 text-sm min-w-[60px] text-right">
          {autoSaveStatus === 'saving' && (
            <span className="text-gray-400">Saving…</span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="text-green-400 flex items-center gap-1 justify-end">
              <Check size={14} />
              Saved
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Preview — always visible */}
          <button
            onClick={onPreview}
            className="px-4 py-1.5 text-sm font-semibold rounded-full bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white transition-all active:scale-95"
          >
            Preview
          </button>

          {/* Save Draft — writer + admin */}
          <button
            onClick={onSaveDraft}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm font-semibold rounded-full bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            Save Draft
          </button>

          {/* Submit for Review — writer + admin, only when DRAFT */}
          {status === 'DRAFT' && (
            <button
              onClick={onSubmitForReview}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm font-semibold rounded-full bg-amber-600/90 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Submit for Review
            </button>
          )}

          {/* Publish — writer + editor + admin, when IN_REVIEW or DRAFT */}
          {canPublish && (status === 'IN_REVIEW' || status === 'DRAFT') && (
            <button
              onClick={onPublish}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm font-semibold rounded-full bg-green-600/90 text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Publish
            </button>
          )}

          {/* Unpublish — writer + editor + admin */}
          {canPublish && status === 'PUBLISHED' && (
            <button
              onClick={onUnpublish}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm font-semibold rounded-full bg-red-700/90 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {/* Auto-save error banner */}
      {autoSaveStatus === 'error' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-sm">
          <span className="font-medium">Auto-save failed.</span>
          <span>Your changes may not be saved. Please save manually.</span>
        </div>
      )}
    </div>
  );
};

export default EditorTopBar;
