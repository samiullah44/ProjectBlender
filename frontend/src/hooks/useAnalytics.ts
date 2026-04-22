// frontend/src/hooks/useAnalytics.ts
// Auto-tracks page views and time-on-page via React Router

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '@/services/analytics';

export const useAnalytics = () => {
  const location = useLocation();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname;

    // Track time spent on the PREVIOUS page before navigating
    if (prevPath.current && prevPath.current !== path) {
      analytics.trackTimeOnPage(prevPath.current);
    }

    // Track new page view
    analytics.trackPageView(path);
    prevPath.current = path;
  }, [location.pathname]);
};

// Scroll depth tracker – attach this to any page that needs it
export const useScrollTracking = () => {
  const fired = useRef(new Set<number>());

  useEffect(() => {
    fired.current.clear();

    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const percent = Math.round((scrolled / total) * 100);

      [25, 50, 75, 100].forEach((milestone) => {
        if (percent >= milestone && !fired.current.has(milestone)) {
          fired.current.add(milestone);
          analytics.trackScrollDepth(milestone);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
};
