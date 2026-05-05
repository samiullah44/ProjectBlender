import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'react-hot-toast';

const NewsletterBox: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axiosInstance.post('/newsletter/subscribe', {
        email,
        role: 'blog_subscriber'
      });
      
      if (response.data.success) {
        toast.success(response.data.message || 'Successfully subscribed!');
        setEmail(''); // Clear the field so they can see the original state
      } else {
        toast.error(response.data.error || 'Subscription failed');
      }
    } catch (error: any) {
      console.error('Newsletter sub error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to subscribe';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-gray-200/60 p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-6">
        <Mail className="w-6 h-6 text-[#7C3AED]" />
      </div>
      <h4 className="text-xl font-bold text-gray-900 mb-2">Stay in the Loop</h4>
      <p className="text-gray-500 text-sm leading-relaxed mb-6">
        Subscribe to get the latest insights, updates, and tutorials.
      </p>
      <form onSubmit={handleSubscribe} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email..."
          disabled={isLoading}
          className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all placeholder:text-gray-400 disabled:opacity-50"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-[0_8px_20px_rgba(124,58,237,0.2)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Subscribing...
            </>
          ) : (
            'Subscribe'
          )}
        </button>
      </form>
    </div>
  );
};

export default NewsletterBox;
