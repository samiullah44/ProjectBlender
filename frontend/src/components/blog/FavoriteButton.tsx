import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/axios';

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
    const favorites = getLocalFavorites();
    const isLocalFav = favorites.includes(slug);
    
    if (isAuthenticated) {
      api.get('/blogs/favorites')
        .then((res) => {
          const data = res.data;
          if (data.success && Array.isArray(data.blogs)) {
            const isFav = data.blogs.some(
              (b: { slug: string }) => b.slug === slug
            );
            setFavorited(isFav);
          }
        })
        .catch(() => {
          // fallback to local storage if API fails or while loading
          setFavorited(isLocalFav);
        });
    } else {
      setFavorited(isLocalFav);
    }
  }, [slug, isAuthenticated]);

  const handleToggle = async (e: React.MouseEvent) => {
    // Prevent navigating away when inside a <Link> tag
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    try {
      const res = await (favorited 
        ? api.delete(`/blogs/${slug}/favorite`)
        : api.post(`/blogs/${slug}/favorite`));
      
      const data = res.data;

      if (data.success) {
        const next = !favorited;
        setFavorited(next);
        setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));

        // Keep localStorage in sync
        const favorites = getLocalFavorites();
        setLocalFavorites(next ? [...favorites, slug] : favorites.filter((s) => s !== slug));
      }
    } catch (error) {
      console.error('Favorite toggle failed:', error);
    } finally {
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
