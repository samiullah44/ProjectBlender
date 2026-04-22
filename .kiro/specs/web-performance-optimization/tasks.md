# Implementation Plan: Web Performance Optimization

## Overview

This implementation plan transforms the RenderOnNodes frontend from a catastrophic performance state (Lighthouse: 17/100) to a production-ready application (target: 90+/100). The approach prioritizes high-impact, low-risk optimizations first: build configuration, lazy loading, and layout shift prevention. Implementation follows the phased roadmap from the design document, focusing on measurable improvements to Core Web Vitals while preserving all existing functionality.

**Critical Constraint:** Do NOT modify business logic or component behavior. Only optimize build configuration, loading strategies, and asset delivery.

---

## Tasks

- [x] 1. Configure Vite build optimization with code splitting and minification
  - Update `frontend/vite.config.ts` with manual chunk splitting strategy
  - Configure Terser minification with aggressive settings
  - Enable CSS code splitting and disable production source maps
  - Set chunk size warning limit to 500KB
  - Add rollup output configuration for optimized file naming
  - _Requirements: 3.1, 3.4, 3.5, 6.1, 6.3, 6.4_

- [ ]* 1.1 Write unit tests for Vite configuration
  - Test manual chunks configuration includes correct dependencies
  - Verify source maps are disabled in production mode
  - Verify CSS code splitting is enabled
  - _Requirements: 6.1, 6.3_

- [x] 2. Implement lazy loading for route components
  - [x] 2.1 Convert all route components to use React.lazy()
    - Wrap route imports with `lazy(() => import('./Component'))`
    - Add Suspense boundaries with loading fallbacks in App.tsx
    - Implement error boundaries for lazy loading failures
    - Update routes for: Home, Dashboard, Admin, Client, Node, Public pages
    - _Requirements: 3.3, 4.5, 5.1_

  - [x] 2.2 Create reusable loading fallback components
    - Implement LoadingSpinner component for route transitions
    - Implement ContentSkeleton component for content placeholders
    - Add error fallback component for lazy loading failures
    - _Requirements: 4.5, 2.5_

  - [ ]* 2.3 Write unit tests for lazy loading
    - Test routes are not loaded on initial render
    - Test Suspense fallbacks render correctly
    - Test error boundaries catch lazy loading failures
    - _Requirements: 4.5_

- [x] 3. Implement lazy loading for Web3 provider
  - [x] 3.1 Create LazyWeb3Provider wrapper component
    - Implement dynamic import for Solana wallet provider
    - Add hover and click triggers for Web3 loading
    - Implement loading state management
    - Add error handling for Web3 loading failures
    - _Requirements: 4.1, 3.3_

  - [x] 3.2 Update App.tsx to use LazyWeb3Provider
    - Replace direct SolanaWalletProvider with lazy wrapper
    - Ensure wallet connect button triggers Web3 loading
    - Test wallet functionality after lazy loading
    - _Requirements: 4.1_

  - [ ]* 3.3 Write integration tests for Web3 lazy loading
    - Test Web3 provider not loaded on initial render
    - Test Web3 loads on wallet connect interaction
    - Test wallet functionality works after lazy loading
    - _Requirements: 4.1_

- [ ] 4. Checkpoint - Verify lazy loading and build configuration
  - Run production build and verify bundle sizes
  - Test lazy loading in development mode
  - Ensure all routes and Web3 functionality work correctly
  - Ask the user if questions arise

- [x] 5. Fix layout shifts with explicit dimensions and reserved space
  - [x] 5.1 Add explicit dimensions to all image elements
    - Audit all `<img>` tags in components
    - Add width and height attributes to every image
    - Update hero images with explicit dimensions
    - Update logo and icon images with dimensions
    - _Requirements: 2.2, 5.4_

  - [x] 5.2 Fix footer layout shift
    - Add `min-height` style to Footer component (400px minimum)
    - Test footer rendering to verify no layout shift
    - Measure CLS improvement for footer
    - _Requirements: 2.3_

  - [x] 5.3 Configure font loading optimization
    - Update font declarations with `font-display: swap`
    - Add preload hints for critical fonts in index.html
    - Test font loading behavior
    - _Requirements: 2.4, 8.2_

  - [ ]* 5.4 Write unit tests for layout shift prevention
    - Test all images have width and height attributes
    - Test footer has min-height style applied
    - Test skeleton loaders reserve appropriate space
    - _Requirements: 2.2, 2.3, 2.5_

- [ ] 6. Implement image optimization
  - [ ] 6.1 Create OptimizedImage component
    - Implement component with width, height, loading, fetchPriority props
    - Add lazy loading for below-fold images
    - Add eager loading and high priority for hero images
    - Implement error handling with fallback images
    - _Requirements: 5.3, 5.4, 8.3_

  - [ ] 6.2 Replace all img tags with OptimizedImage component
    - Update hero images with priority loading
    - Update below-fold images with lazy loading
    - Ensure all images have proper alt text
    - _Requirements: 5.1, 5.3, 5.4_

  - [ ] 6.3 Compress and optimize image assets
    - Compress hero.webp from 372KB to <100KB
    - Verify all images are in WebP format
    - Add image compression to build process if needed
    - _Requirements: 5.2_

  - [ ]* 6.4 Write unit tests for OptimizedImage component
    - Test priority images use eager loading and high fetchPriority
    - Test non-priority images use lazy loading
    - Test error handling with fallback images
    - _Requirements: 5.3, 5.4_

- [ ] 7. Checkpoint - Verify layout stability and image optimization
  - Run Lighthouse audit to measure CLS improvement
  - Verify all images load correctly with proper dimensions
  - Test footer stability during page load
  - Ask the user if questions arise

- [x] 8. Optimize animations with CSS alternatives
  - [x] 8.1 Identify and replace simple Framer Motion animations
    - Audit components using Framer Motion
    - Replace simple fade/slide animations with CSS
    - Create CSS animation utility classes (fade-in, slide-up, etc.)
    - Keep Framer Motion only for complex interactions
    - _Requirements: 9.1, 9.4_

  - [x] 8.2 Implement lazy loading for Framer Motion
    - Defer Framer Motion import for non-critical animations
    - Use dynamic imports for components with complex animations
    - _Requirements: 9.2, 4.2_

  - [x] 8.3 Add reduced motion support
    - Detect `prefers-reduced-motion` media query
    - Disable animations when user prefers reduced motion
    - Provide static alternatives for animated components
    - _Requirements: 9.1_

  - [ ]* 8.4 Write unit tests for animation optimization
    - Test CSS animations are used for simple transitions
    - Test reduced motion preference is respected
    - Test Framer Motion is lazy loaded
    - _Requirements: 9.1, 9.2_

- [x] 9. Implement resource prioritization and preloading
  - [x] 9.1 Add preload hints to index.html
    - Preload critical fonts
    - Preload hero image with high priority
    - Add preconnect hints for API domain
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 9.2 Defer non-critical scripts
    - Add defer attribute to analytics scripts
    - Ensure third-party scripts don't block rendering
    - _Requirements: 4.3, 4.4_

  - [x] 9.3 Configure cache headers for static assets
    - Document recommended cache-control headers for deployment
    - Add cache configuration to deployment documentation
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 9.4 Write integration tests for resource loading
    - Test critical resources are preloaded
    - Test non-critical scripts are deferred
    - Test resource loading order
    - _Requirements: 8.1, 8.3, 4.3_

- [ ] 10. Checkpoint - Verify all optimizations are working
  - Run full Lighthouse audit on production build
  - Verify performance score meets target (≥90)
  - Test all functionality to ensure nothing is broken
  - Ask the user if questions arise

- [x] 11. Set up performance monitoring and budgets
  - [x] 11.1 Configure Lighthouse CI
    - Create `lighthouserc.json` configuration file
    - Set performance budget thresholds (score ≥90, LCP <2.5s, FCP <1.5s, CLS <0.1)
    - Add Lighthouse CI to GitHub Actions workflow
    - _Requirements: 10.3, 10.2_

  - [x] 11.2 Implement Core Web Vitals tracking
    - Install `web-vitals` package
    - Implement tracking for CLS, FCP, LCP, TTFB
    - Send metrics to analytics service
    - _Requirements: 10.1, 10.4_

  - [x] 11.3 Configure bundle size monitoring
    - Add bundle size checks to build process
    - Set warning thresholds (initial bundle <500KB gzipped)
    - Document bundle size targets
    - _Requirements: 10.2, 6.5_

  - [ ]* 11.4 Write integration tests for performance monitoring
    - Test Lighthouse CI configuration is valid
    - Test Core Web Vitals tracking functions
    - Test bundle size warnings trigger correctly
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 12. Final checkpoint and documentation
  - Run final Lighthouse audit and document results
  - Compare before/after metrics
  - Update README with performance optimization details
  - Ensure all tests pass
  - Ask the user if questions arise

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback
- Focus on high-impact optimizations first (build config, lazy loading, layout shifts)
- All optimizations must preserve existing functionality
- Performance targets: Lighthouse ≥90, LCP <2.5s, FCP <1.5s, CLS <0.1, initial bundle <500KB gzipped
