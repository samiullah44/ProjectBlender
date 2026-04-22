# Web Performance Optimization - Design Document

## Overview

This design document outlines the technical approach to transform the RenderOnNodes frontend from a catastrophic performance state (Lighthouse score: 17/100) to a production-ready, highly performant web application (target: 90+/100). The optimization strategy addresses critical issues across bundle size, layout stability, loading performance, and runtime efficiency through systematic improvements to build configuration, code architecture, asset delivery, and rendering strategies.

### Current Performance Baseline

**Lighthouse Metrics (Catastrophic State):**
- Performance Score: 17/100
- Largest Contentful Paint (LCP): 17.0s (target: <2.5s)
- First Contentful Paint (FCP): 8.5s (target: <1.5s)
- Cumulative Layout Shift (CLS): 0.325 (target: <0.1)
- Total Blocking Time (TBT): 500ms (target: <200ms)
- Total JavaScript: 16.6MB (14.8MB from localhost)

**Critical Issues Identified:**
1. Massive JavaScript bundles (react-dom: 4.5MB, chunk-YSVJOAPC: 2.4MB, framer-motion: 1.5MB)
2. Footer causing 0.277 CLS (85% of total layout shift)
3. Unminified JavaScript: 11MB potential savings
4. Unused JavaScript: 6.5MB unused code
5. Main thread blocking: 4.6s total (2.6s JS execution)
6. Large hero image: 372KB (needs further compression)
7. Forced reflows from react-dom: 190ms
8. 9 long tasks blocking main thread
9. Excessive DOM size: 957 elements

### Technology Stack Context

- **Framework:** React 19.2 + TypeScript
- **Build Tool:** Vite 7.2
- **Routing:** React Router 7.12
- **Animation:** Framer Motion 12.34 (heavy, needs optimization)
- **Web3:** Solana Web3.js + wallet adapters (loaded upfront, needs lazy loading)
- **Styling:** Tailwind CSS 4.1
- **State Management:** Zustand 5.0

---

## Architecture

### High-Level Optimization Strategy

The optimization approach follows a layered strategy addressing different aspects of web performance:

```
┌─────────────────────────────────────────────────────────────┐
│                    Build-Time Optimizations                  │
│  • Code splitting & tree shaking                            │
│  • Bundle size reduction                                     │
│  • Asset compression & optimization                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Load-Time Optimizations                    │
│  • Critical resource prioritization                         │
│  • Lazy loading & code splitting                            │
│  • Image optimization & lazy loading                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Runtime Optimizations                       │
│  • Layout shift prevention                                   │
│  • Animation performance                                     │
│  • Main thread optimization                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 Monitoring & Maintenance                     │
│  • Performance budgets                                       │
│  • Lighthouse CI integration                                 │
│  • Core Web Vitals tracking                                  │
└─────────────────────────────────────────────────────────────┘
```

### Bundle Architecture

**Current State (Problematic):**
```
main.js (16.6MB uncompressed)
├── react-dom (4.5MB)
├── chunk-YSVJOAPC (2.4MB)
├── framer-motion (1.5MB)
├── react-router-dom (1.4MB)
├── @solana/spl-token (1.4MB)
├── @solana/web3.js (1.2MB)
└── other dependencies (4.2MB)
```

**Target State (Optimized):**
```
Initial Bundle (<500KB gzipped)
├── main.js (core React + routing)
├── critical-styles.css (inlined)
└── hero-image.webp (preloaded)

Lazy-Loaded Chunks
├── web3.chunk.js (loaded on wallet connect)
├── admin.chunk.js (loaded on admin routes)
├── client.chunk.js (loaded on client routes)
├── node.chunk.js (loaded on node routes)
├── animations.chunk.js (loaded after initial render)
└── vendor.chunk.js (shared dependencies)
```

### Loading Strategy

**Critical Path (First Paint):**
1. HTML document (minimal, inlined critical CSS)
2. Main JavaScript bundle (<200KB gzipped)
3. Hero image (preloaded, optimized WebP)
4. Critical fonts (preloaded with font-display: swap)

**Deferred Resources (Post-Initial Render):**
1. Non-critical routes (lazy loaded)
2. Web3 libraries (lazy loaded on wallet interaction)
3. Animation library (loaded after initial paint)
4. Analytics scripts (deferred)
5. Below-the-fold images (lazy loaded)

---

## Components and Interfaces

### 1. Build Configuration Component

**Purpose:** Configure Vite for optimal production builds with aggressive code splitting and minification.

**Configuration Structure:**

```typescript
// vite.config.ts (optimized)
interface ViteOptimizationConfig {
  build: {
    rollupOptions: {
      output: {
        manualChunks: ChunkStrategy
        chunkFileNames: string
        assetFileNames: string
      }
    }
    minify: 'terser'
    terserOptions: TerserConfig
    cssCodeSplit: boolean
    sourcemap: boolean
    chunkSizeWarningLimit: number
  }
  optimizeDeps: {
    include: string[]
    exclude: string[]
  }
}

interface ChunkStrategy {
  react: string[]        // React core libraries
  web3: string[]         // Solana/Web3 libraries (lazy loaded)
  router: string[]       // React Router
  ui: string[]           // UI libraries (lucide, radix)
  vendor: string[]       // Other dependencies
}
```

**Key Optimizations:**
- Manual chunk splitting for major dependencies
- Terser minification with aggressive settings
- CSS code splitting enabled
- Source maps disabled in production
- Chunk size warnings at 500KB threshold

### 2. Lazy Loading Component

**Purpose:** Implement React.lazy() and Suspense for route-based and component-based code splitting.

**Interface:**

```typescript
interface LazyLoadConfig {
  component: () => Promise<{ default: ComponentType }>
  fallback: ReactElement
  preload?: boolean
  errorBoundary?: ComponentType
}

// Usage pattern
const LazyComponent = lazy(() => import('./Component'))

<Suspense fallback={<LoadingSpinner />}>
  <LazyComponent />
</Suspense>
```

**Implementation Strategy:**
- All route components lazy loaded
- Web3 provider lazy loaded (triggered by wallet connect)
- Admin dashboard lazy loaded (role-based)
- Heavy UI components lazy loaded (modals, complex forms)

### 3. Image Optimization Component

**Purpose:** Deliver optimized, responsive images with proper dimensions and lazy loading.

**Interface:**

```typescript
interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
  sizes?: string
  srcSet?: string
}

// Component implementation
const OptimizedImage: FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  loading = 'lazy',
  fetchPriority = 'auto',
  ...props
}) => {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : loading}
      fetchPriority={priority ? 'high' : fetchPriority}
      {...props}
    />
  )
}
```

**Optimization Rules:**
- All images have explicit width/height attributes
- Hero images use fetchPriority="high" and loading="eager"
- Below-fold images use loading="lazy"
- WebP format with fallbacks
- Compression target: <100KB for hero images

### 4. Layout Shift Prevention Component

**Purpose:** Eliminate layout shifts by reserving space for dynamic content.

**Interface:**

```typescript
interface LayoutReservationProps {
  minHeight?: string
  aspectRatio?: string
  skeleton?: ReactElement
}

// Skeleton loader for content reservation
const ContentSkeleton: FC<{ height: string }> = ({ height }) => (
  <div 
    className="animate-pulse bg-gray-800 rounded"
    style={{ minHeight: height }}
  />
)

// Footer with fixed dimensions
const StableFooter: FC = () => (
  <footer 
    className="footer"
    style={{ minHeight: '400px' }} // Reserve space
  >
    {/* Footer content */}
  </footer>
)
```

**Critical Fixes:**
- Footer: Add min-height to prevent 0.277 CLS
- Images: Explicit dimensions on all img tags
- Fonts: Use font-display: swap
- Dynamic content: Skeleton loaders with reserved space

### 5. Animation Optimization Component

**Purpose:** Replace heavy Framer Motion animations with performant CSS alternatives where possible.

**Strategy:**

```typescript
// Before (Framer Motion - heavy)
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {content}
</motion.div>

// After (CSS - lightweight)
<div className="fade-in-up">
  {content}
</div>

// CSS
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}
```

**Implementation Rules:**
- Simple animations: Use CSS (opacity, transform)
- Complex interactions: Keep Framer Motion but lazy load
- Scroll animations: Use Intersection Observer + CSS
- GPU-accelerated properties only (transform, opacity)

### 6. Web3 Lazy Loading Component

**Purpose:** Defer loading of heavy Solana/Web3 libraries until wallet interaction.

**Interface:**

```typescript
interface LazyWeb3ProviderProps {
  children: ReactNode
}

const LazyWeb3Provider: FC<LazyWeb3ProviderProps> = ({ children }) => {
  const [isWeb3Loaded, setIsWeb3Loaded] = useState(false)
  
  const loadWeb3 = async () => {
    if (!isWeb3Loaded) {
      await import('./providers/SolanaWalletProvider')
      setIsWeb3Loaded(true)
    }
  }
  
  return (
    <div onMouseEnter={loadWeb3} onClick={loadWeb3}>
      {isWeb3Loaded ? (
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      ) : (
        children
      )}
    </div>
  )
}
```

**Lazy Load Triggers:**
- User hovers over wallet connect button
- User clicks wallet connect button
- User navigates to authenticated route

**Expected Savings:** 2-3MB initial bundle reduction

---

## Data Models

### Performance Budget Model

```typescript
interface PerformanceBudget {
  metrics: {
    lighthouse: {
      performance: number      // Target: >= 90
      accessibility: number    // Target: >= 95
      bestPractices: number    // Target: >= 95
      seo: number             // Target: >= 95
    }
    coreWebVitals: {
      lcp: number             // Target: < 2500ms
      fcp: number             // Target: < 1500ms
      cls: number             // Target: < 0.1
      tbt: number             // Target: < 200ms
      tti: number             // Target: < 3500ms
    }
  }
  budgets: {
    initialBundle: number     // Target: < 500KB gzipped
    totalJS: number           // Target: < 2MB uncompressed
    totalCSS: number          // Target: < 100KB
    images: number            // Target: < 2MB total
    fonts: number             // Target: < 200KB
  }
}
```

### Bundle Analysis Model

```typescript
interface BundleAnalysis {
  chunks: Array<{
    name: string
    size: number
    gzipSize: number
    modules: Array<{
      name: string
      size: number
    }>
  }>
  totalSize: number
  totalGzipSize: number
  unusedCode: number
  duplicateCode: number
}
```

### Image Optimization Model

```typescript
interface ImageOptimization {
  original: {
    path: string
    size: number
    format: string
    dimensions: { width: number; height: number }
  }
  optimized: {
    path: string
    size: number
    format: 'webp' | 'avif'
    dimensions: { width: number; height: number }
    compressionRatio: number
  }
  loading: 'eager' | 'lazy'
  priority: 'high' | 'low' | 'auto'
}
```

---

## Testing Strategy

### Performance Testing Approach

This feature focuses on **integration testing** and **performance monitoring** rather than property-based testing, as the optimizations involve infrastructure, build configuration, and runtime behavior that don't have universal properties suitable for PBT.

**Testing Categories:**

1. **Build-Time Tests**
   - Bundle size validation
   - Code splitting verification
   - Minification checks
   - Source map exclusion

2. **Load-Time Tests**
   - Lighthouse CI integration
   - Core Web Vitals monitoring
   - Resource loading order verification
   - Cache header validation

3. **Runtime Tests**
   - Layout shift measurement
   - Animation performance (FPS tracking)
   - Main thread blocking detection
   - Memory leak detection

4. **Regression Tests**
   - Performance budget enforcement
   - Bundle size limits
   - Lighthouse score thresholds

### Unit Testing Strategy

**Bundle Configuration Tests:**
```typescript
describe('Vite Build Configuration', () => {
  it('should split React into separate chunk', () => {
    const config = getViteConfig()
    expect(config.build.rollupOptions.output.manualChunks.react)
      .toContain('react')
  })
  
  it('should exclude source maps in production', () => {
    const config = getViteConfig('production')
    expect(config.build.sourcemap).toBe(false)
  })
  
  it('should enable CSS code splitting', () => {
    const config = getViteConfig()
    expect(config.build.cssCodeSplit).toBe(true)
  })
})
```

**Lazy Loading Tests:**
```typescript
describe('Lazy Loading', () => {
  it('should not load Web3 provider on initial render', () => {
    render(<App />)
    expect(screen.queryByTestId('web3-provider')).not.toBeInTheDocument()
  })
  
  it('should load Web3 provider on wallet connect click', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('Connect Wallet'))
    await waitFor(() => {
      expect(screen.getByTestId('web3-provider')).toBeInTheDocument()
    })
  })
})
```

**Image Optimization Tests:**
```typescript
describe('Image Optimization', () => {
  it('should have explicit dimensions on all images', () => {
    render(<HomePage />)
    const images = screen.getAllByRole('img')
    images.forEach(img => {
      expect(img).toHaveAttribute('width')
      expect(img).toHaveAttribute('height')
    })
  })
  
  it('should use lazy loading for below-fold images', () => {
    render(<HomePage />)
    const belowFoldImages = screen.getAllByRole('img')
      .filter(img => !img.hasAttribute('fetchpriority'))
    belowFoldImages.forEach(img => {
      expect(img).toHaveAttribute('loading', 'lazy')
    })
  })
})
```

**Layout Shift Tests:**
```typescript
describe('Layout Shift Prevention', () => {
  it('should reserve space for footer', () => {
    render(<Footer />)
    const footer = screen.getByRole('contentinfo')
    const styles = window.getComputedStyle(footer)
    expect(parseInt(styles.minHeight)).toBeGreaterThan(0)
  })
  
  it('should use skeleton loaders for async content', () => {
    render(<DashboardPage />)
    expect(screen.getByTestId('content-skeleton')).toBeInTheDocument()
  })
})
```

### Integration Testing Strategy

**Lighthouse CI Tests:**
```yaml
# lighthouserc.json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "url": ["http://localhost:5173/"]
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "first-contentful-paint": ["error", {"maxNumericValue": 1500}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 200}]
      }
    }
  }
}
```

**Bundle Size Tests:**
```typescript
describe('Bundle Size Limits', () => {
  it('should keep initial bundle under 500KB gzipped', async () => {
    const stats = await getBuildStats()
    const initialChunk = stats.chunks.find(c => c.isEntry)
    expect(initialChunk.gzipSize).toBeLessThan(500 * 1024)
  })
  
  it('should keep total JS under 2MB', async () => {
    const stats = await getBuildStats()
    const totalJS = stats.chunks
      .filter(c => c.name.endsWith('.js'))
      .reduce((sum, c) => sum + c.size, 0)
    expect(totalJS).toBeLessThan(2 * 1024 * 1024)
  })
})
```

### Performance Monitoring

**Core Web Vitals Tracking:**
```typescript
// Track real user metrics
import { getCLS, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric: Metric) {
  analytics.track('web_vital', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta
  })
}

getCLS(sendToAnalytics)
getFCP(sendToAnalytics)
getLCP(sendToAnalytics)
getTTFB(sendToAnalytics)
```

**Performance Budget Enforcement:**
```typescript
// CI/CD integration
const budgets = {
  lighthouse: { performance: 90 },
  lcp: 2500,
  fcp: 1500,
  cls: 0.1,
  tbt: 200,
  initialBundle: 500 * 1024 // 500KB gzipped
}

async function enforceBudgets() {
  const metrics = await runLighthouse()
  const stats = await getBuildStats()
  
  const violations = []
  
  if (metrics.performance < budgets.lighthouse.performance) {
    violations.push(`Performance score ${metrics.performance} < ${budgets.lighthouse.performance}`)
  }
  
  if (stats.initialChunk.gzipSize > budgets.initialBundle) {
    violations.push(`Initial bundle ${stats.initialChunk.gzipSize} > ${budgets.initialBundle}`)
  }
  
  if (violations.length > 0) {
    throw new Error(`Performance budget violations:\n${violations.join('\n')}`)
  }
}
```

---

## Error Handling

### Build-Time Error Handling

**Bundle Size Violations:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'CHUNK_SIZE_EXCEEDED') {
          throw new Error(
            `Chunk size exceeded: ${warning.chunkName} (${warning.size}KB > 500KB)`
          )
        }
        warn(warning)
      }
    }
  }
})
```

**Missing Image Dimensions:**
```typescript
// ESLint rule or build-time check
function validateImageDimensions(ast: AST) {
  const images = findAllImageElements(ast)
  const violations = images.filter(img => 
    !img.attributes.width || !img.attributes.height
  )
  
  if (violations.length > 0) {
    throw new Error(
      `Images missing dimensions: ${violations.map(v => v.src).join(', ')}`
    )
  }
}
```

### Runtime Error Handling

**Lazy Loading Failures:**
```typescript
const LazyComponent = lazy(() => 
  import('./Component').catch(err => {
    console.error('Failed to load component:', err)
    return { default: ErrorFallback }
  })
)

function ErrorFallback() {
  return (
    <div className="error-fallback">
      <p>Failed to load component. Please refresh the page.</p>
      <button onClick={() => window.location.reload()}>
        Refresh
      </button>
    </div>
  )
}
```

**Image Loading Failures:**
```typescript
function OptimizedImage({ src, fallback, ...props }: ImageProps) {
  const [error, setError] = useState(false)
  
  if (error && fallback) {
    return <img src={fallback} {...props} />
  }
  
  return (
    <img
      src={src}
      onError={() => setError(true)}
      {...props}
    />
  )
}
```

**Performance Monitoring Errors:**
```typescript
try {
  getCLS(sendToAnalytics)
  getFCP(sendToAnalytics)
  getLCP(sendToAnalytics)
} catch (error) {
  // Silently fail - don't break user experience
  console.warn('Performance monitoring failed:', error)
}
```

### Graceful Degradation

**Web3 Loading Failure:**
```typescript
function Web3Provider({ children }: Props) {
  const [loadError, setLoadError] = useState(false)
  
  if (loadError) {
    return (
      <div className="web3-unavailable">
        <p>Wallet features are temporarily unavailable.</p>
        {children}
      </div>
    )
  }
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LazyWeb3Provider onError={() => setLoadError(true)}>
        {children}
      </LazyWeb3Provider>
    </Suspense>
  )
}
```

**Animation Fallbacks:**
```typescript
// Detect reduced motion preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

// Disable animations if user prefers reduced motion
const AnimatedComponent = prefersReducedMotion 
  ? StaticComponent 
  : MotionComponent
```

---

## Implementation Roadmap

### Phase 1: Build Configuration Optimization (High Impact)

**Objective:** Reduce bundle size through code splitting and minification.

**Tasks:**
1. Configure manual chunk splitting in Vite
2. Enable Terser minification with aggressive settings
3. Exclude source maps from production builds
4. Configure CSS code splitting
5. Add bundle size warnings

**Expected Impact:**
- Initial bundle: 16.6MB → <500KB gzipped (97% reduction)
- Total JS: 16.6MB → <2MB (88% reduction)
- Build time: Minimal increase (<10%)

### Phase 2: Lazy Loading Implementation (High Impact)

**Objective:** Defer non-critical code to improve initial load time.

**Tasks:**
1. Lazy load all route components
2. Lazy load Web3 provider and libraries
3. Lazy load admin dashboard components
4. Lazy load heavy UI components (modals, forms)
5. Implement loading fallbacks and error boundaries

**Expected Impact:**
- FCP: 8.5s → <1.5s (82% improvement)
- LCP: 17.0s → <2.5s (85% improvement)
- TTI: Significant improvement

### Phase 3: Layout Shift Prevention (High Impact)

**Objective:** Eliminate visual instability during page load.

**Tasks:**
1. Add explicit dimensions to all images
2. Fix footer layout shift (add min-height)
3. Implement skeleton loaders for dynamic content
4. Configure font-display: swap for web fonts
5. Reserve space for ads/dynamic content

**Expected Impact:**
- CLS: 0.325 → <0.1 (69% improvement)
- Footer CLS: 0.277 → <0.05 (82% improvement)

### Phase 4: Image Optimization (Medium Impact)

**Objective:** Reduce image payload and improve loading performance.

**Tasks:**
1. Compress hero.webp from 372KB to <100KB
2. Convert all images to WebP with fallbacks
3. Implement lazy loading for below-fold images
4. Add preload hints for critical images
5. Implement responsive images with srcset

**Expected Impact:**
- Image payload: ~2MB → <500KB (75% reduction)
- LCP improvement: Additional 0.5-1s reduction

### Phase 5: Animation Optimization (Medium Impact)

**Objective:** Replace heavy Framer Motion with CSS where possible.

**Tasks:**
1. Identify simple animations for CSS conversion
2. Lazy load Framer Motion library
3. Use Intersection Observer for scroll animations
4. Implement GPU-accelerated CSS animations
5. Add reduced motion support

**Expected Impact:**
- Bundle size: -1.5MB (Framer Motion deferred)
- Animation performance: 60fps maintained
- TBT reduction: ~100ms

### Phase 6: Resource Prioritization (Low Impact)

**Objective:** Optimize resource loading order and caching.

**Tasks:**
1. Inline critical CSS in HTML head
2. Add preload hints for critical resources
3. Configure cache headers for static assets
4. Defer analytics and third-party scripts
5. Add preconnect hints for external domains

**Expected Impact:**
- FCP improvement: Additional 0.2-0.5s
- Repeat visit performance: Near-instant

### Phase 7: Monitoring and Maintenance (Ongoing)

**Objective:** Prevent performance regressions and track improvements.

**Tasks:**
1. Integrate Lighthouse CI in GitHub Actions
2. Configure performance budgets
3. Implement Core Web Vitals tracking
4. Set up performance alerts
5. Create performance dashboard

**Expected Impact:**
- Continuous monitoring
- Early regression detection
- Data-driven optimization decisions

---

## Performance Targets Summary

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Lighthouse Score | 17/100 | ≥90/100 | +429% |
| LCP | 17.0s | <2.5s | -85% |
| FCP | 8.5s | <1.5s | -82% |
| CLS | 0.325 | <0.1 | -69% |
| TBT | 500ms | <200ms | -60% |
| Total JS | 16.6MB | <2MB | -88% |
| Initial Bundle | ~5MB | <500KB gz | -90% |

---

## References

**Content was rephrased for compliance with licensing restrictions**

- [Vite Code Splitting Best Practices](https://benmukebo.medium.com/boost-your-react-apps-performance-with-vite-lazy-loading-and-code-splitting-2fd093128682) - Guide on implementing lazy loading and code splitting with Vite
- [React Code Splitting Patterns](https://copyprogramming.com/howto/react-code-splitting) - Comprehensive overview of React.lazy and Suspense patterns
- [Cumulative Layout Shift Optimization](https://www.corewebvitals.io/core-web-vitals/cumulative-layout-shift/images-and-media) - Techniques for preventing layout shifts with images
- [CSS vs JavaScript Animations Performance](https://copyprogramming.com/howto/css-and-javascript-animation-performance) - Performance comparison and best practices for web animations
- [Bundle Size Optimization Guide](https://shaxadd.medium.com/optimizing-your-react-vite-application-a-guide-to-reducing-bundle-size-6b7e93891c96) - Strategies for reducing React Vite bundle sizes

---

## Conclusion

This design provides a comprehensive, phased approach to transforming the RenderOnNodes frontend from a catastrophic performance state to a production-ready, highly performant web application. By addressing bundle size, layout stability, loading performance, and runtime efficiency through systematic optimizations, we expect to achieve a Lighthouse performance score of 90+ and meet all Core Web Vitals thresholds.

The implementation prioritizes high-impact optimizations first (build configuration, lazy loading, layout shift prevention) while maintaining code quality and developer experience. Continuous monitoring through Lighthouse CI and Core Web Vitals tracking will ensure performance gains are maintained over time.
