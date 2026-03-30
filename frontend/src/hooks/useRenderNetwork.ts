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
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // Start false to allow DB fallback while loading
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { user } = useAuthStore();
  
  // Initialize Anchor Provider and Program
  const program = useMemo(() => {

    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  const pdaAddress = useMemo(() => {
    if (!wallet || !user?.solanaSeed) return null;
    
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
        setIsInitialized(false);
        return null;
    }

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
      programId
    );
    return pda;
  }, [wallet?.publicKey, user?.solanaSeed]);


  // Fetch the current user's "Credit Account" PDA balance.
  // Returns the numeric creditedAmount (tokens) so callers can do accurate pre-checks.
  const fetchCreditBalance = async (): Promise<number> => {
    if (!program || !wallet) {
      setCreditedAmount(0);
      return 0;
    }

    try {
      setIsRefreshing(true);

      if (!user?.solanaSeed) {
        console.log("No solanaSeed found for current user. Skipping balance fetch.");
        setCreditedAmount(0);
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
          setIsInitialized(false);
          return 0;
      }

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
        programId
      );


      // Fetch the account data (this will throw if it doesn't exist yet - which is normal for new users)
      const accountData: any = await (program.account as any).userAccount.fetch(userAccountPda);
      
      const formattedAmount = Number(accountData.creditedAmount.toString()) / 1e6;
      setCreditedAmount(formattedAmount);
      setIsInitialized(true);
      return formattedAmount;
    } catch (err: any) {
      // If the account doesn't exist yet, it simply means they haven't deposited anything.
      if (err.message && (err.message.includes('Account does not exist') || err.message.includes('404'))) {
        setCreditedAmount(0);
        setIsInitialized(false);
        return 0;
      } else {
        console.error("Error fetching credit balance:", err);
        // Prevent stale creditedAmount from keeping the UI showing old DB fallback values.
        setCreditedAmount(0);
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
  }, [program, wallet?.publicKey.toString(), user?.solanaSeed]);

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

  // USER: Lock on-chain payment for a specific job (moves credits -> escrow)
  const lockPayment = async (jobId: string, amountInTokens: number) => {
    if (!program || !wallet) throw new Error('Wallet not connected');
    if (!user?.solanaSeed) {
      throw new Error(
        'Your account is not fully initialized. Please try logging out and back in to generate your Solana Identity Seed.'
      );
    }
    if (!jobId) throw new Error('Missing jobId');
    if (amountInTokens <= 0) throw new Error('amountInTokens must be > 0');

    // Convert tokens to raw units (6 decimals)
    const amountInteger = Math.ceil(amountInTokens);
    const rawAmount = new BN(amountInteger.toString()).mul(new BN(1_000_000));

    // --- PDA DERIVATION FIX ---
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
    // Contract expects a numeric u64 job_id, but backend uses strings like:
    // "job-<unix_ms>-<suffix>". Extract unix_ms portion.
    const match = /^job-(\d+)-/.exec(jobId);
    const onchainJobIdStr = match?.[1] ?? (jobId.match(/^\d+$/) ? jobId : null);
    if (!onchainJobIdStr) {
      throw new Error(`Invalid jobId format for on-chain job_id: ${jobId}`);
    }

    const jobIdBn = new BN(onchainJobIdStr);

    // Credit PDA (source of funds)
    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
      programId
    );

    // Escrow PDA (destination)
    const jobIdLeBytes = Buffer.from(jobIdBn.toArrayLike(Buffer, 'le', 8));
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), userIdPubkey.toBuffer(), jobIdLeBytes],
      programId
    );

    // Determine necessary ATAs
    const userDepositAta = getAssociatedTokenAddressSync(mintProgramId, userAccountPda, true);
    const escrowAta = getAssociatedTokenAddressSync(mintProgramId, escrowPda, true);

    // RPC can intermittently fail with "Blockhash not found" (e.g. stale recentBlockhash or RPC node hiccup).
    // Since we rebuild a fresh tx each attempt, retrying is the safest approach.
    let lastErr: unknown = null;
    const attempts = 3;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const tx = await program.methods
          .lockPayment(userIdPubkey, jobIdBn, rawAmount)
          .accounts({
            escrow: escrowPda,
            user: wallet.publicKey,
            userDepositAccount: userAccountPda,
            mint: mintProgramId,
            userDepositTokenAccount: userDepositAta,
            escrowTokenAccount: escrowAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId
          })
          .rpc();

        await fetchCreditBalance();
        window.dispatchEvent(new Event('refresh_credit_balance'));

        return { tx, escrowAddress: escrowPda.toBase58(), escrowJobId: jobIdBn.toString() };
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || '').toLowerCase();
        const isBlockhashNotFound = msg.includes('blockhash not found') || msg.includes('blockhash');
        if (isBlockhashNotFound && attempt < attempts - 1) {
          // Small backoff to get a newer blockhash.
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    throw lastErr ?? new Error('Failed to lock payment on-chain');
  };

  // USER: Cancel an on-chain escrow (refund remaining tokens back to Credits)
  const cancelJobOnchain = async (jobId: string) => {
    if (!program || !wallet) throw new Error('Wallet not connected');
    if (!user?.solanaSeed) {
      throw new Error(
        'Your account is not fully initialized. Please try logging out and back in to generate your Solana Identity Seed.'
      );
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
        console.error("Invalid Solana Identity Seed format:", user.solanaSeed);
        throw new Error("Your Solana Identity Seed is invalid. Please try 'Sync Identity' in your profile menu.");
    }

    // Contract expects numeric u64 job_id.
    const match = /^job-(\d+)-/.exec(jobId);
    const onchainJobIdStr = match?.[1] ?? (jobId.match(/^\d+$/) ? jobId : null);
    if (!onchainJobIdStr) {
      throw new Error(`Invalid jobId format for on-chain job_id: ${jobId}`);
    }
    const jobIdBn = new BN(onchainJobIdStr);

    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
      programId
    );

    const jobIdLeBytes = Buffer.from(jobIdBn.toArrayLike(Buffer, 'le', 8));
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), userIdPubkey.toBuffer(), jobIdLeBytes],
      programId
    );

    const userDepositAta = getAssociatedTokenAddressSync(mintProgramId, userAccountPda, true);
    const escrowAta = getAssociatedTokenAddressSync(mintProgramId, escrowPda, true);

    const tx = await program.methods
      .cancelJob()
      .accounts({
        escrow: escrowPda,
        user: wallet.publicKey,
        userDepositAccount: userAccountPda,
        mint: mintProgramId,
        userDepositTokenAccount: userDepositAta,
        escrowTokenAccount: escrowAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    await fetchCreditBalance();
    window.dispatchEvent(new Event('refresh_credit_balance'));

    return { tx, escrowAddress: escrowPda.toBase58() };
  };

  return {
    program,
    mintAddress: mintProgramId.toBase58(),
    pdaAddress,
    creditedAmount: creditedAmount ?? 0,
    isInitialized,
    isRefreshing,
    fetchCreditBalance,
    syncSolanaSeed,
    depositToAccount,
    lockPayment,
    cancelJobOnchain
  };
}
