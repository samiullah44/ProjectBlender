import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Share, MoreHorizontal, Flag, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';

interface BottomActionBarProps {
  commentCount: number;
  postTitle: string;
  blogId: string;
  commentSectionRef: React.RefObject<HTMLDivElement | null>;
}

type ReportReason =
  | 'spam'
  | 'misinformation'
  | 'hate_speech'
  | 'harassment'
  | 'inappropriate_content'
  | 'other';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
];

export default function BottomActionBar({
  commentCount,
  postTitle,
  blogId,
  commentSectionRef,
}: BottomActionBarProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 3-dot dropdown state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const handleScrollToComments = () => {
    commentSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!', { duration: 2000 });
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const openReport = () => {
    if (!isAuthenticated) {
      toast.error('Sign in to report this post');
      setMenuOpen(false);
      return;
    }
    setMenuOpen(false);
    setReason('spam');
    setDetails('');
    setReportOpen(true);
  };

  const submitReport = async () => {
    setSubmitting(true);
    try {
      await api.post('/reports', {
        targetType: 'blog',
        targetId: blogId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success('Report submitted. Thank you for helping keep the community safe.');
      setReportOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to submit report. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const iconBtn =
    'flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300';

  return (
    <>
      {/* ── Inline action bar ── */}
      <div className="flex items-center justify-between py-4 border-t border-b border-gray-100 my-8">
        {/* Left: comment count */}
        <button
          type="button"
          onClick={handleScrollToComments}
          aria-label={`${commentCount} responses — scroll to comments`}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors duration-150 focus-visible:outline-none"
        >
          <MessageCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="text-sm tabular-nums">{commentCount}</span>
        </button>

        {/* Right: share + 3-dot */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleShare} aria-label="Share this post" className={iconBtn}>
            <Share className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className={iconBtn}
            >
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 bottom-full mb-2 w-44 rounded-xl border border-gray-200 bg-white shadow-lg py-1 z-50"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={openReport}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Flag className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Report post
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Report modal ── */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="report-title" className="text-lg font-bold text-gray-900 mb-1">
              Report this post
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Help us understand what's wrong with this content.
            </p>

            {/* Reason selector */}
            <fieldset className="mb-4">
              <legend className="text-sm font-medium text-gray-700 mb-2">Reason</legend>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-red-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {r.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Optional details */}
            <div className="mb-6">
              <label htmlFor="report-details" className="text-sm font-medium text-gray-700 block mb-1">
                Additional details <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe the issue..."
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{details.length} / 500</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
