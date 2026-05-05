import React from 'react';
import { X, Calendar, Clock, ChevronRight, List, Share2, Star } from 'lucide-react';
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

  const headings = data.contentBlocks
    .filter((b: any) => b.type === 'heading' && (b.attrs?.level === 2 || b.attrs?.level === 3))
    .map((b: any) => {
      const text = b.content?.map((n: any) => n.text ?? '').join('') || '';
      return { text, level: b.attrs.level };
    });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-950/80 backdrop-blur-sm backdrop-saturate-150 font-sans">
      <div className="bg-white w-full max-w-7xl h-full max-h-[95vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Modal Header */}
        <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
               <EyeIcon size={16} />
             </div>
             <div>
                <h2 className="text-sm font-bold text-gray-900 leading-none">Post Preview</h2>
                <p className="text-[10px] text-gray-400 mt-1 font-medium italic">Viewing live draft as it will appear to your readers</p>
             </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all active:scale-95 border border-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto bg-white p-8 lg:p-12">
          <div className="max-w-6xl mx-auto">
            
            {/* Cover Image - Top curved */}
            {data.coverImage && (
              <div className="w-full h-[300px] sm:h-[400px] rounded-[32px] sm:rounded-[40px] overflow-hidden mb-12 shadow-2xl shadow-purple-500/10">
                <img 
                  src={data.coverImage} 
                  alt={data.title} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] lg:gap-16">
              <article>
                {/* Category */}
                {data.category && (
                  <div className="mb-6">
                    <span className="text-[10px] font-black tracking-widest text-purple-600 uppercase bg-purple-50 px-3 py-1 rounded-full">
                      {data.category}
                    </span>
                  </div>
                )}

                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-8">
                  {data.title || 'Untitled Post'}
                </h1>

                <div className="flex items-center gap-3 pb-8 border-b border-gray-100 mb-12">
                  <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                     <img src={`https://ui-avatars.com/api/?name=${data.authorName || 'Admin'}&background=random`} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Admin User</p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                      {formatDate(new Date())} • {data.readTime || '5 min read'}
                    </p>
                  </div>
                </div>

                {/* Blocks */}
                <div className="
                  [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-5
                  [&_p]:text-gray-600 [&_p]:leading-[1.8] [&_p]:mb-6 [&_p]:text-[17px]
                  [&_img]:rounded-2xl [&_img]:my-10
                  [&_blockquote]:border-l-4 [&_blockquote]:border-purple-400 [&_blockquote]:pl-6 [&_blockquote]:py-3 [&_blockquote]:bg-purple-50/50 [&_blockquote]:rounded-r-2xl
                ">
                  <BlockRenderer blocks={data.contentBlocks} />
                </div>
              </article>

              {/* Sidebar Placeholders */}
              <aside className="hidden lg:block">
                <div className="space-y-10">
                  {/* ToC Placeholder */}
                  {headings.length > 0 && (
                    <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-3xl opacity-60 grayscale-[0.5]">
                      <div className="flex items-center gap-2 mb-6 text-purple-500">
                        <List size={16} />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Table of contents</h4>
                      </div>
                      <div className="flex flex-col gap-3">
                        {headings.map((h, i) => (
                           <div key={i} className={`text-xs font-bold text-gray-400 pl-4 border-l-2 border-transparent ${h.level === 3 ? 'ml-4' : ''}`}>
                             {h.text}
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Share Placeholder */}
                  <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-3xl opacity-60 grayscale-[0.5]">
                    <div className="flex items-center gap-2 mb-6 text-purple-500">
                      <Share2 size={16} />
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Share this article</h4>
                    </div>
                    <div className="space-y-3">
                       {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white border border-gray-50 rounded-xl" />)}
                    </div>
                  </div>

                  {/* More Like This Placeholder */}
                  <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-3xl opacity-60 grayscale-[0.5]">
                    <div className="flex items-center gap-2 mb-6 text-purple-500">
                      <Star size={16} />
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">More like this</h4>
                    </div>
                    <div className="space-y-4">
                       {[1, 2].map(i => (
                         <div key={i} className="flex gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gray-100" />
                            <div className="flex-1 space-y-2">
                               <div className="h-3 bg-gray-100 rounded w-full" />
                               <div className="h-2 bg-gray-100 rounded w-1/2" />
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EyeIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.062 12.348a1 1 0 010-.696 10.75 10.75 0 0119.876 0 1 1 0 010 .696 10.75 10.75 0 01-19.876 0z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default BlogPreviewModal;
