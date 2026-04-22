import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { SolanaWalletProvider } from './providers/SolanaWalletProvider'
import './index.css'
import App from './App.tsx'
import { HelmetProvider } from 'react-helmet-async'

// Polyfill Buffer for Solana web3 compatibility in Vite
window.Buffer = window.Buffer || Buffer

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <SolanaWalletProvider>
        <App />
      </SolanaWalletProvider>
    </HelmetProvider>
  </StrictMode>,
)
