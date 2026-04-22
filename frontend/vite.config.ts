import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    exclude: ['es-toolkit'],
  },
  build: {
    // Disable source maps in production for smaller output
    sourcemap: false,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Warn on chunks larger than 500KB
    chunkSizeWarningLimit: 500,
    // Minification with esbuild (fast, built-in)
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Optimized file naming with content hashes for long-term caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // Web3 / Solana — largest chunk, only loaded when wallet is used
          if (
            id.includes('@solana/') ||
            id.includes('@coral-xyz/') ||
            id.includes('wallet-adapter')
          ) {
            return 'web3'
          }
          // Framer Motion — deferred animation library
          if (id.includes('framer-motion')) {
            return 'motion'
          }
          // Recharts — only used in dashboard/analytics pages
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts'
          }
          // React core
          if (id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor'
          }
          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'icons'
          }
          // Data fetching
          if (id.includes('@tanstack/react-query') || id.includes('axios')) {
            return 'query'
          }
          // Radix UI components
          if (id.includes('@radix-ui/')) {
            return 'radix'
          }
        },
      },
    },
  },
  server: {
    host: true, // allow network access
    port: 5173,
    allowedHosts: ['www.renderonnodes.com', 'localhost'], // allow your domain and local
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})