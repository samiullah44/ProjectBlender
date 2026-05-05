import React from 'react';
import { X, Calendar, Clock, User } from 'lucide-react';
import BlockRenderer from '../../blog/BlockRenderer';
import type { ContentBlock } from '@/types/blog';

interface BlogPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    title: string;
    category: string;
    coverImage: string;
    contentBlocks: ContentBlock[];
    readTime: string;
    authorName?: string;
  };
}

const BlogPreviewModal: React.FC<BlogPreviewModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-950/80 backdrop-blur-sm backdrop-saturate-150">
      <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Modal Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Post Preview</h2>
            <p className="text-xs text-gray-400 mt-0.5">This is how your post will look to readers</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-all active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-3xl mx-auto px-8 py-16">
            {/* Category */}
            {data.category && (
              <div className="mb-6">
                <span className="text-[11px] font-black tracking-widest text-[#7C3AED] uppercase bg-purple-50 px-4 py-2 rounded-full border border-purple-100/50">
                  {data.category}
                </span>
              </div>
            )}

            {/* Date */}
            <p className="text-sm text-gray-400 mb-5 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(new Date())}
            </p>

            {/* Title */}
            <h1 className="text-4xl sm:text-[56px] font-extrabold tracking-tight text-gray-900 leading-[1.05] mb-8">
              {data.title || 'Untitled Post'}
            </h1>

            {/* Meta */}
            <div className="flex items-center gap-6 py-6 border-y border-gray-100 mb-12">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-purple-500/20">
                  {(data.authorName || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{data.authorName || 'Current Author'}</p>
                  <p className="text-[11px] text-gray-400 font-medium">Content Writer</p>
                </div>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <Clock className="w-4 h-4 text-purple-400" />
                {data.readTime || '5 min read'}
              </div>
            </div>

            {/* Cover Image - Removed from preview as per user request */}
            {/* {data.coverImage && (
              <div className="mb-12 rounded-[32px] overflow-hidden shadow-2xl shadow-gray-200/50 group">
                <img
                  src={data.coverImage}
                  alt={data.title}
                  className="w-full h-auto object-cover transform transition-transform duration-[2s] group-hover:scale-105"
                />
              </div>
            )} */}

            {/* Blocks */}
            <div className="prose prose-lg prose-purple max-w-none
              [&_h1]:text-4xl [&_h1]:font-extrabold [&_h1]:text-gray-900 [&_h1]:mt-12 [&_h1]:mb-6
              [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-5
              [&_p]:text-gray-700 [&_p]:leading-[1.8] [&_p]:mb-6 [&_p]:text-[18px]
              [&_blockquote]:border-l-4 [&_blockquote]:border-purple-400 [&_blockquote]:pl-6 [&_blockquote]:py-2 [&_blockquote]:my-10 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:bg-purple-50/50 [&_blockquote]:rounded-r-2xl
              [&_pre]:bg-gray-950 [&_pre]:text-gray-100 [&_pre]:rounded-2xl [&_pre]:p-8 [&_pre]:my-10
              [&_img]:rounded-2xl [&_img]:shadow-xl [&_img]:my-10
              [&_ul]:space-y-3 [&_ol]:space-y-3
              [&_a]:text-purple-600 [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-purple-200 [&_a]:hover:decoration-purple-500 [&_a]:transition-all
            ">
              <BlockRenderer blocks={data.contentBlocks} />
            </div>

            <div className="h-20" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPreviewModal;
