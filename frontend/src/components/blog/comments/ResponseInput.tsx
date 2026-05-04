import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { usePostComment } from '@/hooks/useComments';

interface ResponseInputProps {
  slug: string;
  currentUser: { id: string; name: string } | null;
}

const MAX_LENGTH = 1000;

function getLoginUrl(): string {
  const { hostname, protocol, pathname } = window.location;
  // On the blog subdomain (blog.renderonnodes.com) → redirect to main app
  if (hostname.includes('blog.')) {
    return `${protocol}//${hostname.replace('blog.', '')}/login?returnTo=${encodeURIComponent(window.location.href)}`;
  }
  // On localhost or any other host, use the same origin
  return `/login?returnTo=${encodeURIComponent(pathname)}`;
}

export default function ResponseInput({ slug, currentUser }: ResponseInputProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { mutate: postComment, isPending } = usePostComment(slug);

  // Sign-in prompt for unauthenticated visitors
  if (!currentUser) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
        <a
          href={getLoginUrl()}
          className="text-gray-900 font-medium underline underline-offset-2 hover:text-purple-600 transition-colors"
        >
          Sign in
        </a>
        <span>to leave a response</span>
      </div>
    );
  }

  const avatarInitial = currentUser.name.charAt(0).toUpperCase();
  const isSubmittable = text.trim().length > 0;

  const handleSubmit = () => {
    if (!isSubmittable || isPending) return;

    setError(null);
    postComment(text, {
      onSuccess: () => {
        setText('');
      },
      onError: (err: unknown) => {
        const message =
          (err as any)?.response?.data?.error ??
          (err as any)?.message ??
          'Something went wrong. Please try again.';
        setError(message);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Ctrl+Enter / Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-3">
      {/* Avatar initial circle */}
      <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 mt-1">
        {avatarInitial}
      </div>

      {/* Input area */}
      <div className="flex-1 min-w-0">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are your thoughts?"
          maxLength={MAX_LENGTH}
          rows={3}
          disabled={isPending}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />

        {/* Footer row: character count + submit button */}
        <div className="flex items-center justify-between mt-2">
          {/* Live character count */}
          <span className="text-xs text-gray-400 tabular-nums">
            {text.length} / {MAX_LENGTH}
          </span>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!isSubmittable || isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              'Respond'
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-2 text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
