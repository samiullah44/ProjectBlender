import { useMemo, useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

import { idl, RENDER_NETWORK_PROGRAM_ID, SEED_USER_ACCOUNT } from '../idl/render_network';
import { useAuthStore } from '../stores/authStore';
import { axiosInstance } from '../lib/axios';
import { toast } from 'react-hot-toast';


// Ensure the IDL is correctly typed for Anchor
const programId = new PublicKey(RENDER_NETWORK_PROGRAM_ID);
// In Vite, environment variables are accessed via import.meta.env
const envMint = import.meta.env && import.meta.env.VITE_MINT_ADDRESS;
const mintProgramId = envMint 
  ? new PublicKey(envMint) 
  : new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"); // User's USDC-Dev Mint on Devnet

export function useRenderNetwork() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);
  const [lockedAmount, setLockedAmount] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // Start false to allow DB fallback while loading
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { user } = useAuthStore();
  
  // Initialize Anchor Provider and Program with read-only fallback
  const program = useMemo(() => {
    const activeWallet = wallet || {
      publicKey: PublicKey.default,
      signTransaction: async () => { throw new Error('Wallet not connected for signing'); },
      signAllTransactions: async () => { throw new Error('Wallet not connected for signing'); }
    };
    
    const provider = new AnchorProvider(connection, activeWallet as any, AnchorProvider.defaultOptions());
    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  const pdaAddress = useMemo(() => {
    if (!user?.solanaSeed) return null;
    
    // --- PDA DERIVATION FIX ---
    let userIdPubkey: PublicKey;
    try {
        if (user.solanaSeed.length === 64 && /^[0-9a-fA-F]+$/.test(user.solanaSeed)) {
            userIdPubkey = new PublicKey(Buffer.from(user.solanaSeed, 'hex'));
        } else {
            userIdPubkey = new PublicKey(user.solanaSeed);
        }
    } catch (e) {
        console.warn("PDA deriving failed, user might need to sync identity.");
        setCreditedAmount(0);
        setLockedAmount(0);
        setIsInitialized(false);
        return null;
    }

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
      programId
    );
    return pda;
  }, [user?.solanaSeed]);


  // Fetch the current user's "Credit Account" PDA balance.
  // Returns the numeric creditedAmount (tokens) so callers can do accurate pre-checks.
  const fetchCreditBalance = async (): Promise<number> => {
    if (!program) {
      return 0;
    }

    try {
      setIsRefreshing(true);

      if (!user?.solanaSeed) {
        console.log("No solanaSeed found for current user. Waiting for auth load.");
        // We do not set to 0 here because auth might just be loading on refresh
        return 0;
      }
      
      // --- PDA DERIVATION FIX ---
      let userIdPubkey: PublicKey;
      try {
          if (user.solanaSeed.length === 64 && /^[0-9a-fA-F]+$/.test(user.solanaSeed)) {
              userIdPubkey = new PublicKey(Buffer.from(user.solanaSeed, 'hex'));
          } else {
              userIdPubkey = new PublicKey(user.solanaSeed);
          }
      } catch (e) {
          console.warn("PDA deriving failed in fetchCreditBalance, user might need to sync identity.");
          setCreditedAmount(0);
          setLockedAmount(0);
          setIsInitialized(false);
          return 0;
      }

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
        programId
      );

      console.log(`[useRenderNetwork] Fetching balance for v2 PDA: ${userAccountPda.toBase58()} (Seed: ${SEED_USER_ACCOUNT})`);

      // Fetch the account data (read-only operations do not require wallet signature)
      const accountData: any = await (program.account as any).userAccount.fetch(userAccountPda);
      
      console.log("[useRenderNetwork] Successfully fetched account data:", accountData);
      
      const credited = Number(accountData.creditedAmount.toString());
      const locked   = Number(accountData.lockedAmount.toString());
      
      // [Zero-Prompt] Available balance is what's not already reserved
      const formattedAmount = (credited - locked) / 1e6;
      const formattedLocked = locked / 1e6;
      
      setCreditedAmount(formattedAmount);
      setLockedAmount(formattedLocked);
      setIsInitialized(true);
      return formattedAmount;
      } catch (err: any) {
      console.log(`[useRenderNetwork] Error in fetchCreditBalance: ${err.message || err}`);
      // If the account doesn't exist yet, it simply means they haven't deposited anything.
      if (err.message && (err.message.includes('Account does not exist') || err.message.includes('404'))) {
        setCreditedAmount(0);
        setLockedAmount(0);
        setIsInitialized(false);
        return 0;
      } else if (err instanceof RangeError || err.message?.includes('buffer length')) {
        // RangeError happens when the on-chain account data is smaller than the current IDL expects.
        // This is common if the struct was updated but the user's PDA was created with an old version.
        console.warn("Credit account structure mismatch (RangeError). Treating as uninitialized.");
        setCreditedAmount(0);
        setLockedAmount(0);
        setIsInitialized(false);
        return 0;
      } else {
        console.error("Error fetching credit balance:", err);
        setCreditedAmount(0);
        setLockedAmount(0);
        setIsInitialized(false);
        return 0;
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Run automatically when the wallet connects or when a refresh event is fired
  useEffect(() => {
    fetchCreditBalance();

    const handleGlobalRefresh = () => fetchCreditBalance();
    window.addEventListener('refresh_credit_balance', handleGlobalRefresh);

    return () => {
      window.removeEventListener('refresh_credit_balance', handleGlobalRefresh);
    };
  }, [program, user?.solanaSeed]);

  // Sync the user's solanaSeed with their current wallet address
  // This is the "Professional" solution to update your identity to a new address
  const syncSolanaSeed = async () => {
    if (!wallet?.publicKey) {
      toast.error('Connect your wallet first');
      return;
    }

    try {
      setIsRefreshing(true);
      const newSeed = wallet.publicKey.toBase58();
      
      const response = await axiosInstance.post('/auth/solana-seed', {
        solanaSeed: newSeed
      });

      if (response.data.success) {
        toast.success('Identity synced with your current wallet!');
        window.dispatchEvent(new Event('refresh_credit_balance')); // Sync all hooks
        // Refresh local user state by reloading (simplest for now)
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err: any) {
      console.error('Failed to sync identity seed:', err);
      toast.error('Identity sync failed. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Execute Deposit Transaction (User pays rent for first init)
  const depositToAccount = async (amountInTokens: number) => {
    if (!program || !wallet) throw new Error("Wallet not connected");

    // Convert tokens to raw units (6 decimals)
    const rawAmount = new BN(amountInTokens * 1e6);

    if (!user?.solanaSeed) {
        throw new Error("Your account is not fully initialized. Please try logging out and back in to generate your Solana Identity Seed.");
    }

    // --- PDA DERIVATION FIX ---
    // Handle both original Hex Seeds and modern Base58 Identity Addresses
    let userIdPubkey: PublicKey;
    try {
        if (user.solanaSeed.length === 64 && /^[0-9a-fA-F]+$/.test(user.solanaSeed)) {
            // Original 32-byte Hex Seed
            userIdPubkey = new PublicKey(Buffer.from(user.solanaSeed, 'hex'));
        } else {
            // Modern Base58 Address
            userIdPubkey = new PublicKey(user.solanaSeed);
        }
    } catch (e) {
        console.error("Invalid Solana Identity Seed format:", user.solanaSeed);
        throw new Error("Your Solana Identity Seed is invalid. Please try 'Sync Identity' in your profile menu.");
    }

    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
      programId
    );


    // 2. Determine necessary ATAs
    // Source: User's Wallet ATA
    const userWalletAta = getAssociatedTokenAddressSync(mintProgramId, wallet.publicKey);
    
    // Destination: User's Credit PDA ATA
    const pdaDepositAta = getAssociatedTokenAddressSync(mintProgramId, userAccountPda, true);

    console.log("Preparing deposit transaction...");
    console.log("Mint Account:", mintProgramId.toBase58());
    console.log("User Wallet ATA:", userWalletAta.toBase58());
    console.log("Credit PDA:", userAccountPda.toBase58());
    console.log("Credit PDA ATA:", pdaDepositAta.toBase58());

    try {
      // 3. Build the Anchor RPC method (Pass user_id as argument)
      const tx = await program.methods
        .depositToAccount(userIdPubkey, rawAmount)
        .accounts({
          userAccount: userAccountPda,
          user: wallet.publicKey,
          mint: mintProgramId,
          userTokenAccount: userWalletAta,
          userDepositTokenAccount: pdaDepositAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();


      console.log("Deposit Transaction successful! Signature:", tx);
      
      // Refresh balance immediately
      await fetchCreditBalance();
      window.dispatchEvent(new Event('refresh_credit_balance'));
      
      return { tx, pdaDepositAta: pdaDepositAta.toBase58() };
    } catch (err: any) {
      if (err?.message?.includes('AccountNotInitialized') || err?.message?.includes('3012')) {
        throw new Error("You do not have any Devnet Mock Tokens! Please use a standard Solana Spl-Token Devnet faucet to get some USDC first so your token account initializes.");
      }
      throw err;
    }
  };

  // [Zero-Prompt] Handled by Backend
  // This hook now simply returns a success signature to allow the frontend flow to continue
  // without triggering a manual wallet prompt.
  const lockPayment = async (jobId: string, amountInTokens: number) => {
    console.log(`[Zero-Prompt] Lock Payment for ${jobId} initiated (Backend will handle on-chain tx)`);
    
    // Small delay to simulate blockchain feel if desired, or return immediately
    return { 
      tx: "BACKEND_MANAGED_RESERVATION", 
      escrowAddress: "Logical_Escrow_v3", 
      escrowJobId: jobId 
    };
  };

  // [Zero-Prompt] Handled by Backend
  const cancelJobOnchain = async (jobId: string) => {
    console.log(`[Zero-Prompt] Cancel Payment for ${jobId} initiated (Backend will handle unlocking)`);
    return { tx: "BACKEND_MANAGED_UNLOCK" };
  };

  return {
    program,
    mintAddress: mintProgramId.toBase58(),
    pdaAddress,
    creditedAmount,
    lockedAmount,
    isInitialized,
    isRefreshing,
    fetchCreditBalance,
    syncSolanaSeed,
    depositToAccount,
    lockPayment,
    cancelJobOnchain
  };
}
