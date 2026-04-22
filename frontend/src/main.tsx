import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { SolanaWalletProvider } from './providers/SolanaWalletProvider'
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
