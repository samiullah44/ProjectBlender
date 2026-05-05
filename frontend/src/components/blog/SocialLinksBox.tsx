import React from 'react';
import { Twitter, Linkedin, Facebook } from 'lucide-react';

const SocialLinksBox: React.FC = () => {
  return (
    <div className="bg-white rounded-[32px] border border-gray-200/60 p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <h4 className="text-[10px] font-black tracking-[0.3em] text-purple-600 uppercase mb-4">FOLLOW US</h4>
      <p className="text-gray-500 text-sm font-medium mb-6">
        Join our community across platforms.
      </p>
      <div className="flex flex-wrap gap-3">
        <a 
          href="https://x.com/RenderOnNodes" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-11 h-11 rounded-xl bg-[#00ACEE]/10 flex items-center justify-center text-[#00ACEE] hover:bg-[#00ACEE] hover:text-white transition-all shadow-sm"
        >
          <Twitter className="w-5 h-5 fill-current" />
        </a>
        <a 
          href="https://www.linkedin.com/company/rebderonnodes/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-11 h-11 rounded-xl bg-[#0077B5]/10 flex items-center justify-center text-[#0077B5] hover:bg-[#0077B5] hover:text-white transition-all shadow-sm"
        >
          <Linkedin className="w-5 h-5 fill-current" />
        </a>
        <a 
          href="https://www.facebook.com/share/1BGi4RdYta/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-11 h-11 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2] hover:bg-[#1877F2] hover:text-white transition-all shadow-sm"
        >
          <Facebook className="w-5 h-5 fill-current" />
        </a>
        <a 
          href="https://www.youtube.com/@RenderOnNodes-k8d" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-11 h-11 rounded-xl bg-[#FF0000]/10 flex items-center justify-center text-[#FF0000] hover:bg-[#FF0000] hover:text-white transition-all shadow-sm"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.872.505 9.377.505 9.377.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </a>
      </div>
    </div>
  );
};

export default SocialLinksBox;
