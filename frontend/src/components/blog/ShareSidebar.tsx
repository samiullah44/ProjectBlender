import React from 'react';
import { Twitter, Linkedin, Facebook, Link, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ShareSidebarProps {
  url: string;
}

const ShareSidebar: React.FC<ShareSidebarProps> = ({ url }) => {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const shareLinks = [
    { name: 'Twitter', icon: <Twitter className="w-4 h-4" />, color: 'text-sky-500', bg: 'bg-sky-50', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}` },
    { name: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, color: 'text-blue-700', bg: 'bg-blue-50', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { name: 'Facebook', icon: <Facebook className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { 
      name: 'Reddit', 
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.051l-2.597-.547-.8 3.747c2.361.116 4.374.646 5.676 1.37.362-.278.806-.445 1.29-.445.688 0 1.25.561 1.25 1.249 0 .688-.562 1.25-1.25 1.25-.494 0-.927-.291-1.135-.712-1.314-.73-3.435-1.273-5.903-1.377l.79-3.71 1.908.411c.026.401.355.72.76.72zm-10.01 5.19c.688 0 1.25.561 1.25 1.249 0 .688-.562 1.25-1.25 1.25a1.25 1.25 0 0 1 0-2.498zm3.986 5.98s-.308.224-.344.252c-.42.347-1.042.61-1.677.61-.634 0-1.256-.263-1.676-.61l-.344-.252c-.126-.1-.137-.285-.024-.399a.276.276 0 0 1 .391-.024l.32.235c.34.256.89.448 1.333.448.441 0 .991-.192 1.331-.448l.32-.235a.276.276 0 0 1 .391.024c.113.114.102.299-.024.399zm.506-3.481c.688 0 1.25.561 1.25 1.249 0 .688-.562 1.25-1.25 1.25a1.25 1.25 0 0 1 0-2.498zm5.508-3.481c.688 0 1.25.561 1.25 1.249 0 .688-.562 1.25-1.25 1.25a1.25 1.25 0 0 1 0-2.498z"/>
        </svg>
      ), 
      color: 'text-orange-600', bg: 'bg-orange-50', href: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}` 
    },
    { 
      name: 'Telegram', 
      icon: <Send className="w-4 h-4" />, 
      color: 'text-sky-500', bg: 'bg-sky-50', href: `https://t.me/share/url?url=${encodeURIComponent(url)}` 
    },
  ];

  return (
    <div className="hidden md:flex flex-col gap-1 shrink-0 p-8 pt-6 bg-gray-50/40 border border-gray-200/60 rounded-[32px] h-fit self-start">
      <h5 className="text-[9px] font-black tracking-[0.2em] text-gray-400 uppercase mb-5 whitespace-nowrap text-center">SHARE THIS ARTICLE</h5>
      <div className="flex flex-col gap-4">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 group"
          >
            <div className={`w-9 h-9 rounded-xl ${link.bg} flex items-center justify-center ${link.color} group-hover:scale-110 transition-all shadow-sm border border-white/50`}>
              {link.icon}
            </div>
            <span className="text-[10.5px] font-bold text-gray-500 group-hover:text-gray-900 transition-colors uppercase tracking-wider">{link.name}</span>
          </a>
        ))}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-500 group-hover:scale-110 transition-all shadow-sm border border-gray-100">
            <Link className="w-4 h-4" />
          </div>
          <span className="text-[10.5px] font-bold text-gray-500 group-hover:text-gray-900 transition-colors uppercase tracking-wider">Copy Link</span>
        </button>
      </div>
    </div>
  );
};

export default ShareSidebar;
