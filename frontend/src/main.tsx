import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { SolanaWalletProvider } from './providers/SolanaWalletProvider'
import './index.css'
import App from './App.tsx'

// Polyfill Buffer for Solana web3 compatibility in Vite
window.Buffer = window.Buffer || Buffer

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaWalletProvider>
      <App />
    </SolanaWalletProvider>
  </StrictMode>,
)
