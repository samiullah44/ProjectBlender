import React, { useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Tag,
  Image,
  Search,
  Folder,
  X,
  Upload,
  Star,
  Clock
} from 'lucide-react';

const CATEGORIES = ['Technology', 'Tutorial', 'News', 'Analysis', 'Updates', 'General'];

interface MetadataPanelProps {
  category: string;
  onCategoryChange: (category: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  coverImage: string;
  onCoverImageChange: (url: string) => void;
  seoTitle: string;
  onSeoTitleChange: (title: string) => void;
  seoDescription: string;
  onSeoDescriptionChange: (desc: string) => void;
  ogImage: string;
  onOgImageChange: (url: string) => void;
  readTime: string;
  onReadTimeChange: (v: string) => void;
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const token = localStorage.getItem('token');
  const res = await fetch('/api/cms/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.url as string;
}

// ── ImageUploadField ──────────────────────────────────────────────────────────
interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({ label, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {value ? (
        <div className="relative group">
          <img src={value} alt={label} className="w-full h-24 object-cover rounded border border-gray-700" />
          <button
            onClick={() => onChange('')}
            className="absolute top-1 right-1 p-0.5 rounded bg-gray-900/80 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove image"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded border border-dashed border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-colors text-sm disabled:opacity-50"
        >
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
};

// ── TagsInput ─────────────────────────────────────────────────────────────────
interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

const TagsInput: React.FC<TagsInputProps> = ({ tags, onChange }) => {
  const [input, setInput] = useState('');

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, '').trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (input.trim()) addTag(input);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
      <div className="min-h-[38px] flex flex-wrap gap-1 p-1.5 rounded bg-gray-800 border border-gray-700 focus-within:border-gray-500">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-700 text-gray-200 text-xs"
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-gray-400 hover:text-white"
              aria-label={`Remove tag ${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? 'Add tags…' : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-white placeholder-gray-500 outline-none"
        />
      </div>
      <p className="mt-0.5 text-xs text-gray-500">Press Enter or comma to add</p>
    </div>
  );
};

// ── SEOPanel ──────────────────────────────────────────────────────────────────
interface SEOPanelProps {
  seoTitle: string;
  onSeoTitleChange: (v: string) => void;
  seoDescription: string;
  onSeoDescriptionChange: (v: string) => void;
  ogImage: string;
  onOgImageChange: (url: string) => void;
}

const SEOPanel: React.FC<SEOPanelProps> = ({
  seoTitle,
  onSeoTitleChange,
  seoDescription,
  onSeoDescriptionChange,
  ogImage,
  onOgImageChange,
}) => (
  <div className="space-y-3">
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-400">SEO Title</label>
        <span className={`text-xs ${seoTitle.length > 60 ? 'text-red-400' : 'text-gray-500'}`}>
          {seoTitle.length}/60
        </span>
      </div>
      <input
        type="text"
        value={seoTitle}
        onChange={(e) => onSeoTitleChange(e.target.value.slice(0, 60))}
        maxLength={60}
        placeholder="SEO title…"
        className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
      />
    </div>

    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-400">SEO Description</label>
        <span className={`text-xs ${seoDescription.length > 160 ? 'text-red-400' : 'text-gray-500'}`}>
          {seoDescription.length}/160
        </span>
      </div>
      <textarea
        value={seoDescription}
        onChange={(e) => onSeoDescriptionChange(e.target.value.slice(0, 160))}
        maxLength={160}
        rows={3}
        placeholder="SEO description…"
        className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500 resize-none"
      />
    </div>

    <ImageUploadField label="OG Image" value={ogImage} onChange={onOgImageChange} />
  </div>
);

// ── MetadataPanel ─────────────────────────────────────────────────────────────
const MetadataPanel: React.FC<MetadataPanelProps & { 
  isFeatured: boolean; 
  onIsFeaturedChange: (v: boolean) => void; 
}> = ({
  category,
  onCategoryChange,
  tags,
  onTagsChange,
  coverImage,
  onCoverImageChange,
  seoTitle,
  onSeoTitleChange,
  seoDescription,
  onSeoDescriptionChange,
  ogImage,
  onOgImageChange,
  readTime,
  onReadTimeChange,
  isFeatured,
  onIsFeaturedChange,
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className={`
        flex flex-col bg-gray-900 border-l border-gray-700 transition-all duration-200
        ${expanded ? 'w-72' : 'w-12'}
        shrink-0 h-full overflow-hidden
      `}
    >
      {/* Toggle button */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-700 shrink-0">
        {expanded && (
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">
            Metadata
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
        >
          {expanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Collapsed icon strip */}
      {!expanded && (
        <div className="flex flex-col items-center gap-3 pt-3 text-gray-500">
          <Folder size={18} aria-label="Category" />
          <Tag size={18} aria-label="Tags" />
          <Image size={18} aria-label="Cover Image" />
          <Search size={18} aria-label="SEO" />
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="flex-1 overflow-y-auto p-3 space-y-5 text-gray-100">
          {/* Featured Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/50 transition-colors cursor-pointer group"
               onClick={() => onIsFeaturedChange(!isFeatured)}>
            <div className="flex items-center gap-2">
              <Star className={`w-4 h-4 ${isFeatured ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
              <span className="text-sm font-medium">Featured Article</span>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${isFeatured ? 'bg-purple-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isFeatured ? 'left-4.5' : 'left-0.5'}`} />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-white outline-none focus:border-gray-500 appearance-none cursor-pointer"
            >
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <TagsInput tags={tags} onChange={onTagsChange} />

          {/* Cover Image */}
          <ImageUploadField
            label="Cover Image"
            value={coverImage}
            onChange={onCoverImageChange}
          />

          {/* Read Time */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Read Time</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-500">
                <Clock size={14} />
              </div>
              <input
                type="text"
                value={readTime}
                onChange={(e) => onReadTimeChange(e.target.value)}
                placeholder="e.g. 5 min read"
                className="w-full pl-9 pr-2.5 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              SEO
            </p>
            <SEOPanel
              seoTitle={seoTitle}
              onSeoTitleChange={onSeoTitleChange}
              seoDescription={seoDescription}
              onSeoDescriptionChange={onSeoDescriptionChange}
              ogImage={ogImage}
              onOgImageChange={onOgImageChange}
            />
          </div>
        </div>
      )}
    </aside>
  );
};

export default MetadataPanel;
