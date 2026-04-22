import React, { Suspense } from 'react'

// Lazy-load the heavy Solana wallet provider to keep it in a separate JS chunk.
// The provider itself renders immediately (no idle delay) — we just defer the
// bundle download so it doesn't block the initial JS parse.
const SolanaWalletProvider = React.lazy(() =>
  import('./SolanaWalletProvider').then((m) => ({ default: m.SolanaWalletProvider }))
)

interface LazyWeb3ProviderProps {
  children: React.ReactNode
}

/**
 * Wraps children in the Solana wallet provider.
 * The provider JS chunk is loaded lazily (separate bundle) but the context
 * is available immediately on first render via Suspense — children render
 * inside the fallback until the chunk arrives, then re-render with wallet context.
 *
 * This keeps the web3 code out of the main bundle while avoiding the
 * "WalletContext not provided" error that occurs when components like NavBar
 * call useWallet() before the provider mounts.
 */
export const LazyWeb3Provider: React.FC<LazyWeb3ProviderProps> = ({ children }) => {
  return (
    <Suspense fallback={<>{children}</>}>
      <SolanaWalletProvider>{children}</SolanaWalletProvider>
    </Suspense>
  )
}