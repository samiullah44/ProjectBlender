import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { SolanaWalletProvider } from './providers/SolanaWalletProvider'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import './index.css'
import App from './App.tsx'
import { HelmetProvider } from 'react-helmet-async'
import { initWebVitals } from './utils/webVitals'

// Polyfill Buffer for Solana web3 compatibility in Vite
window.Buffer = window.Buffer || Buffer

// Start Core Web Vitals tracking
initWebVitals()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <SolanaWalletProvider>
        <App />
      </SolanaWalletProvider>
    </HelmetProvider>
  </StrictMode>,
)
