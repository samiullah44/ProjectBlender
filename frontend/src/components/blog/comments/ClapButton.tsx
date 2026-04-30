import React from 'react';
import { HandHeart } from 'lucide-react';
import { useClapComment, useUnClapComment } from '@/hooks/useComments';

interface ClapButtonProps {
  commentId: string;
  slug: string;
  claps: number;
  hasClapped: boolean;
  isAuthenticated: boolean;
}

export default function ClapButton({
  commentId,
  slug,
  claps,
  hasClapped,
  isAuthenticated,
}: ClapButtonProps) {
  const { mutate: clap, isPending: isClapPending } = useClapComment(slug);
  const { mutate: unclap, isPending: isUnclapPending } = useUnClapComment(slug);

  const isPending = isClapPending || isUnclapPending;

  const handleClick = () => {
    if (isPending) return;
    if (hasClapped) {
      unclap({ commentId });
    } else {
      clap({ commentId });
    }
  };

  // Unauthenticated: static display only — no interactive button
  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-1.5 text-gray-400 select-none">
        <HandHeart className="w-4 h-4" aria-hidden="true" />
        <span className="text-xs tabular-nums">{claps}</span>
      </div>
    );
  }

  // Authenticated: interactive clap/unclap button
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={hasClapped ? 'Remove clap' : 'Clap for this comment'}
      aria-pressed={hasClapped}
      className={[
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-60',
        hasClapped
          ? 'text-purple-600 bg-purple-50 hover:bg-purple-100'
          : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50',
      ].join(' ')}
    >
      <HandHeart
        className={[
          'w-4 h-4 transition-colors duration-150',
          hasClapped ? 'fill-purple-200 stroke-purple-600' : 'fill-none stroke-current',
        ].join(' ')}
        aria-hidden="true"
      />
      <span className="tabular-nums">{claps}</span>
    </button>
  );
}
