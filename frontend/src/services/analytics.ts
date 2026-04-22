// frontend/src/services/analytics.ts
// Self-contained analytics tracking SDK
// Collects events in a queue and flushes every 5 seconds or when queue > 10 items

const API_URL = import.meta.env.VITE_API_URL || '';

// ─────────────────────────────────────────────
// Identity helpers
// ─────────────────────────────────────────────
const getUserId = (): string => {
  let id = localStorage.getItem('_an_uid');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('_an_uid', id);
  }
  return id;
};

const getSessionId = (): string => {
  let sid = sessionStorage.getItem('_an_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('_an_sid', sid);
  }
  return sid;
};

// ─────────────────────────────────────────────
// UTM & Referrer capture (read once on first load)
// ─────────────────────────────────────────────
const captureUtm = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source:   params.get('utm_source')   || undefined,
    utm_medium:   params.get('utm_medium')   || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_term:     params.get('utm_term')     || undefined,
    utm_content:  params.get('utm_content')  || undefined,
    referrer:     document.referrer          || undefined,
  };
};

// ─────────────────────────────────────────────
// Event types
// ─────────────────────────────────────────────
export type AnalyticsEventType =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'PAGE_VIEW'
  | 'PAGE_EXIT'
  | 'TIME_ON_PAGE'
  | 'BUTTON_CLICK'
  | 'LINK_CLICK'
  | 'FORM_SUBMIT'
  | 'SCROLL_DEPTH'
  | 'USER_IDENTIFIED'
  | 'CUSTOM';

interface QueuedEvent {
  eventType: AnalyticsEventType;
  userId: string;
  sessionId: string;
  page: string;
  timestamp: string;
  metadata: Record<string, any>;
}

// ─────────────────────────────────────────────
// Analytics Service (singleton)
// ─────────────────────────────────────────────
class AnalyticsService {
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionStarted = false;
  private pageEnterTime = 0;
  private userId: string;
  private sessionId: string;
  private userRole: string | null = null;

  constructor() {
    this.userId = getUserId();
    this.sessionId = getSessionId();
  }

  // Called once when the app mounts
  init() {
    if (this.sessionStarted) return; // prevent double-init
    this.sessionStarted = true;
    this.pageEnterTime = Date.now();

    // Start session
    this.push('SESSION_START', {
      ...captureUtm(),
      screenRes: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
    });

    // Flush every 5 seconds
    this.flushTimer = setInterval(() => this.flush(), 5000);

    // Flush and end session when tab closes
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
      this.flushSync(); // synchronous beacon
    });

    // Track visibility changes (tab hidden / shown)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.trackTimeOnPage(window.location.pathname);
      } else {
        this.pageEnterTime = Date.now();
      }
    });
  }

  // Define user role to exclude admin data
  setRole(role: string) {
    this.userRole = role;
    console.log(`[Analytics] Role set: ${role}`);
  }

  // Identify user (e.g., after login)
  identify(email?: string, name?: string, registeredId?: string) {
    this.push('USER_IDENTIFIED', { email, name, registeredId });
  }

  // Track page view (called by router hook on route change)
  trackPageView(path: string) {
    this.push('PAGE_VIEW', { page: path });
    this.pageEnterTime = Date.now();
  }

  // Track time spent on a page before navigating away
  trackTimeOnPage(path: string) {
    const duration = Date.now() - this.pageEnterTime;
    if (duration > 500) { // ignore bounces < 500ms
      this.push('TIME_ON_PAGE', { page: path, duration });
    }
  }

  // Track button / UI clicks
  trackClick(button: string, extraMeta: Record<string, any> = {}) {
    this.push('BUTTON_CLICK', { button, ...extraMeta });
  }

  // Track form submits
  trackForm(formName: string, extraMeta: Record<string, any> = {}) {
    this.push('FORM_SUBMIT', { form: formName, ...extraMeta });
  }

  // Track scroll depth milestones (25, 50, 75, 100)
  trackScrollDepth(percent: number) {
    this.push('SCROLL_DEPTH', { percent });
  }

  // Generic custom event
  trackEvent(eventType: AnalyticsEventType, metadata: Record<string, any> = {}) {
    this.push(eventType, metadata);
  }

  private trackSessionEnd() {
    const duration = Date.now() - (this.pageEnterTime || Date.now());
    this.push('SESSION_END', { duration });
  }

  private push(eventType: AnalyticsEventType, metadata: Record<string, any> = {}) {
    const path = window.location.pathname;
    
    // Skip tracking for admin routes OR if user is recognized as an admin
    if (path.startsWith('/admin') || this.userRole === 'admin') {
      console.log(`[Analytics] Skipping event ${eventType} (Admin Exclusion active)`);
      return;
    }

    console.log(`[Analytics] Queuing event: ${eventType}`, metadata);
    this.queue.push({
      eventType,
      userId: this.userId,
      sessionId: this.sessionId,
      page: path,
      timestamp: new Date().toISOString(),
      metadata,
    });

    // Eager flush if queue is large
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  private async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0); // drain queue atomically
    try {
      console.log(`[Analytics] Flushing batch of ${batch.length} events...`);
      await fetch(`${API_URL}/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
    } catch {
      // Silently fail — analytics must never break the app
    }
  }

  // Synchronous flush using sendBeacon for beforeunload
  private flushSync() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const payload = JSON.stringify({ events: batch });
    navigator.sendBeacon(
      `${API_URL}/analytics/track`,
      new Blob([payload], { type: 'application/json' }),
    );
  }

  destroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushSync();
  }
}

// Export as singleton
export const analytics = new AnalyticsService();
