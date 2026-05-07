import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Facebook, Youtube } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0B0F19] border-t border-white/5 pt-16 pb-8 min-h-[350px]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row flex-wrap lg:flex-nowrap justify-between gap-8 mb-12 items-start">
          {/* Brand & Description */}
          <div className="w-full lg:w-2/5 mb-8 lg:mb-0">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <img
                src="/assets/images/logo.png"
                alt="RenderOnNodes"
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-gray-400 text-sm mb-6 max-w-sm leading-relaxed">
              We are building the world's most accessible, high-performance distributed rendering network. Harness the power of idle GPUs globally.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://x.com/RenderOnNodes" aria-label="Twitter" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/company/rebderonnodes/" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="https://www.facebook.com/share/1BGi4RdYta/" aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="https://www.youtube.com/@RenderOnNodes-k8d" aria-label="YouTube" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links Group */}
          <div className="flex flex-row flex-1 justify-between gap-8 min-w-[300px]">
            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4 whitespace-nowrap">Platform</h4>
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
                <li>
                  <Link to="/faq" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            {/* About Links */}
            <div>
              <h4 className="text-white font-semibold mb-4 whitespace-nowrap">About</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/about" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link to="/docs/" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors">
                    Docs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold mb-4 whitespace-nowrap">Legal</h4>
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
                <li>
                  <Link to="/risk" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Risk Disclosure
                  </Link>
                </li>
                <li>
                  <Link to="/refund" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link to="/aup" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Acceptable Use
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} RenderOnNodes Network. All rights reserved.
          </p>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
