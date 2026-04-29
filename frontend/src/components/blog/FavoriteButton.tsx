import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface FavoriteButtonProps {
  slug: string;
  initialCount?: number;
}

const STORAGE_KEY = 'blogFavorites';

function getLocalFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function setLocalFavorites(slugs: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
}

export default function FavoriteButton({ slug, initialCount }: FavoriteButtonProps) {
  const { isAuthenticated } = useAuthStore();
  const [favorited, setFavorited] = useState(false);
  const [count, setCount] = useState(initialCount ?? 0);
  const [loading, setLoading] = useState(false);

  // Sync initialCount when it changes (data reloads)
  useEffect(() => {
    setCount(initialCount ?? 0);
  }, [initialCount]);

  // On mount: determine initial favorited state from local storage or server
  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      fetch('/api/blogs/favorites', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.blogs)) {
            const isFav = data.blogs.some(
              (b: { slug: string }) => b.slug === slug
            );
            setFavorited(isFav);
          }
        })
        .catch(() => {/* silently ignore */});
    } else {
      setFavorited(getLocalFavorites().includes(slug));
    }
  }, [slug, isAuthenticated]);

  const handleToggle = async (e: React.MouseEvent) => {
    // Prevent navigating away when inside a <Link> tag
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    const token = isAuthenticated ? localStorage.getItem('token') : null;
    const method = favorited ? 'DELETE' : 'POST';

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/blogs/${slug}/favorite`, { method, headers });
      const data = await res.json();

      if (data.success) {
        const next = !favorited;
        setFavorited(next);
        setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));

        // Keep localStorage in sync (used for immediate re-render state across pages)
        const favorites = getLocalFavorites();
        setLocalFavorites(next ? [...favorites, slug] : favorites.filter((s) => s !== slug));
      }
    } catch {/* silently ignore */} finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors
        ${favorited
          ? 'bg-red-50 text-red-500 hover:bg-red-100'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Heart
        size={16}
        className={favorited ? 'fill-red-500 text-red-500' : 'text-gray-500'}
      />
      {initialCount !== undefined && <span>{count}</span>}
    </button>
  );
}
