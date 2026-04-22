import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals'

type MetricName = 'CLS' | 'FCP' | 'LCP' | 'TTFB' | 'INP'

interface VitalMetric {
  name: MetricName
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

/**
 * Reports Core Web Vitals to the console in development,
 * and to Google Analytics in production.
 */
function sendToAnalytics({ name, value, rating }: VitalMetric) {
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${name}: ${value.toFixed(2)} (${rating})`)
    return
  }

  // Send to GA4 if available
  if (typeof window !== 'undefined' && 'gtag' in window) {
    // @ts-expect-error gtag is injected globally
    window.gtag('event', name, {
      event_category: 'Web Vitals',
      value: Math.round(name === 'CLS' ? value * 1000 : value),
      event_label: rating,
      non_interaction: true,
    })
  }
}

export function initWebVitals() {
  onCLS((m) => sendToAnalytics({ name: 'CLS', value: m.value, rating: m.rating }))
  onFCP((m) => sendToAnalytics({ name: 'FCP', value: m.value, rating: m.rating }))
  onLCP((m) => sendToAnalytics({ name: 'LCP', value: m.value, rating: m.rating }))
  onTTFB((m) => sendToAnalytics({ name: 'TTFB', value: m.value, rating: m.rating }))
  onINP((m) => sendToAnalytics({ name: 'INP', value: m.value, rating: m.rating }))
}
