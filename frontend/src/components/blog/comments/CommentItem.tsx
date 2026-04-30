import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, EyeOff } from 'lucide-react';
import type { IComment } from '@/types/comment';
import ClapButton from './ClapButton';
import DeleteMenu from './DeleteMenu';
import { useEditComment } from '@/hooks/useComments';

interface CommentItemProps {
  comment: IComment;
  slug: string;
  currentUserId?: string;
  currentUserRoles?: string[];
  isAuthenticated: boolean;
}

const EDIT_WINDOW_MS = 20 * 60 * 1000; // 20 minutes

function useEditTimeLeft(createdAt: string): number {
  const [msLeft, setMsLeft] = useState(() =>
    Math.max(0, EDIT_WINDOW_MS - (Date.now() - new Date(createdAt).getTime()))
  );

  useEffect(() => {
    if (msLeft <= 0) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, EDIT_WINDOW_MS - (Date.now() - new Date(createdAt).getTime()));
      setMsLeft(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 10_000); // update every 10s
    return () => clearInterval(id);
  }, [createdAt, msLeft]);

  return msLeft;
}

export default function CommentItem({
  comment,
  slug,
  currentUserId,
  currentUserRoles,
  isAuthenticated,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [editError, setEditError] = useState<string | null>(null);

  const { mutate: editComment, isPending: isSaving } = useEditComment(slug);
  const msLeft = useEditTimeLeft(comment.createdAt);

  const avatarInitial = comment.authorId.name.charAt(0).toUpperCase();
  const formattedDate = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  const isAuthor = !!(currentUserId && currentUserId === comment.authorId._id);
  const isAdmin = !!(currentUserRoles?.includes('admin'));
  const canDelete = isAuthor || isAdmin;
  const canEdit = isAuthor && msLeft > 0;
  const hasClapped = !!(currentUserId && comment.clappers.includes(currentUserId));

  const minutesLeft = Math.ceil(msLeft / 60_000);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed) { setEditError('Comment cannot be empty'); return; }
    setEditError(null);
    editComment(
      { commentId: comment._id, text: trimmed },
      {
        onSuccess: () => setEditing(false),
        onError: (err: any) => setEditError(err?.response?.data?.error ?? 'Failed to save'),
      }
    );
  };

  // Hidden comments — show a muted placeholder for admins, nothing for others
  if (comment.hidden) {
    if (!isAdmin) return null;
    return (
      <article className="flex gap-3 py-4 opacity-40">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <EyeOff className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 italic">Hidden comment by {comment.authorId.name}</p>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{comment.text}</p>
          <div className="mt-2">
            <DeleteMenu commentId={comment._id} slug={slug} showHideToggle isHidden={comment.hidden} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex gap-3 py-5">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5"
        aria-hidden="true"
      >
        {avatarInitial}
      </div>

      <div className="flex-1 min-w-0">
        {/* Author + date */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{comment.authorId.name}</span>
          <span className="text-xs text-gray-400" title={new Date(comment.createdAt).toLocaleString()}>
            {formattedDate}
          </span>
          {comment.editedAt && (
            <span className="text-xs text-gray-400 italic">(edited)</span>
          )}
        </div>

        {/* Text or inline editor */}
        {editing ? (
          <div className="mt-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={1000}
              rows={3}
              autoFocus
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">{editText.length} / 1000</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setEditText(comment.text); setEditError(null); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="text-xs text-white bg-gray-900 hover:bg-gray-700 px-3 py-1 rounded-full disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            {editError && <p className="text-xs text-red-500 mt-1">{editError}</p>}
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {comment.text}
          </p>
        )}

        {/* Actions row */}
        {!editing && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <ClapButton
                commentId={comment._id}
                slug={slug}
                claps={comment.claps}
                hasClapped={hasClapped}
                isAuthenticated={isAuthenticated}
              />
              {/* Edit button — only for author within 20 min */}
              {canEdit && (
                <button
                  onClick={() => { setEditing(true); setEditText(comment.text); }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  title={`Edit available for ${minutesLeft} more min`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                  <span className="text-gray-300">· {minutesLeft}m left</span>
                </button>
              )}
            </div>

            {canDelete && (
              <DeleteMenu
                commentId={comment._id}
                slug={slug}
                showHideToggle={isAdmin}
                isHidden={comment.hidden}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
