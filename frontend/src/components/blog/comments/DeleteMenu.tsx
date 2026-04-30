import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Trash2, EyeOff, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDeleteComment, useToggleCommentVisibility } from '@/hooks/useComments';

interface DeleteMenuProps {
  commentId: string;
  slug: string;
  showHideToggle?: boolean;  // true for admins
  isHidden?: boolean;
}

export default function DeleteMenu({ commentId, slug, showHideToggle = false, isHidden = false }: DeleteMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { mutate: deleteComment, isPending: isDeleting } = useDeleteComment(slug);
  const { mutate: toggleVisibility, isPending: isToggling } = useToggleCommentVisibility(slug);
  const isPending = isDeleting || isToggling;

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false); setIsConfirming(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setIsOpen(false); setIsConfirming(false); } };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClickOutside); document.removeEventListener('keydown', onEsc); };
  }, [isOpen]);

  const handleConfirmDelete = () => {
    deleteComment(commentId, {
      onSuccess: () => { setIsOpen(false); setIsConfirming(false); },
      onError: () => { setIsOpen(false); setIsConfirming(false); toast.error('Failed to delete comment.'); },
    });
  };

  const handleToggleVisibility = () => {
    toggleVisibility(
      { commentId, hidden: !isHidden },
      {
        onSuccess: () => { setIsOpen(false); toast.success(isHidden ? 'Comment shown' : 'Comment hidden'); },
        onError: () => toast.error('Failed to update visibility'),
      }
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => { if (!isPending) { setIsOpen(v => !v); setIsConfirming(false); } }}
        disabled={isPending}
        aria-label="Comment options"
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
        >
          {!isConfirming ? (
            <>
              {/* Hide / Show — admin only */}
              {showHideToggle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleToggleVisibility}
                  disabled={isToggling}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isHidden
                    ? <><Eye className="w-3.5 h-3.5 shrink-0" /> Show comment</>
                    : <><EyeOff className="w-3.5 h-3.5 shrink-0" /> Hide comment</>
                  }
                </button>
              )}

              {/* Delete */}
              <button
                type="button"
                role="menuitem"
                onClick={() => setIsConfirming(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                Delete
              </button>
            </>
          ) : (
            <div className="px-3 py-2">
              <p className="text-gray-700 font-medium mb-2 text-xs">Are you sure?</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsConfirming(false); setIsOpen(false); }}
                  disabled={isDeleting}
                  className="flex-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
