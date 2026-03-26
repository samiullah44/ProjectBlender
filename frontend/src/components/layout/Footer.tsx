import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin, Cpu } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0B0F19] border-t border-white/5 pt-16 pb-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

          {/* Brand & Description */}
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <span className="font-bold text-xl tracking-tight">
                <span className="text-indigo-400">Render</span>
                <span className="text-white">OnNodes</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm mb-6 max-w-sm leading-relaxed">
              We are building the world's most accessible, high-performance distributed rendering network. Harness the power of idle GPUs globally.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://x.com/RenderOnNodes" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/company/rebderonnodes/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Platform</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/features" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                  How It Works
                </Link>
              </li>
              {/* <li>
                <Link to="/pricing" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                  Pricing
                </Link>
              </li> */}
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} RenderOnNodes Network. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-500 tracking-wider uppercase">
              Under Development
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
