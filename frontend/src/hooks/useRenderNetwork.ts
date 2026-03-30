import { useMemo, useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

import { idl, RENDER_NETWORK_PROGRAM_ID, SEED_USER_ACCOUNT } from '../idl/render_network';
import { useAuthStore } from '../stores/authStore';


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
  const [creditedAmount, setCreditedAmount] = useState<number>(0);
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
    
    // User Identity Seed (from Database) - convert hex string to Buffer for PublicKey
    const userIdPubkey = new PublicKey(Buffer.from(user.solanaSeed, 'hex'));

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
      programId
    );
    return pda;
  }, [wallet?.publicKey, user?.solanaSeed]);


  // Fetch the current user's "Credit Account" PDA balance
  const fetchCreditBalance = async () => {
    if (!program || !wallet) {
      setCreditedAmount(0);
      return;
    }

    try {
      setIsRefreshing(true);

      if (!user?.solanaSeed) {
        console.log("No solanaSeed found for current user. Skipping balance fetch.");
        setCreditedAmount(0);
        return;
      }
      
      const userIdPubkey = new PublicKey(Buffer.from(user.solanaSeed, 'hex'));


      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEED_USER_ACCOUNT), userIdPubkey.toBuffer()],
        programId
      );


      // Fetch the account data (this will throw if it doesn't exist yet - which is normal for new users)
      const accountData: any = await (program.account as any).userAccount.fetch(userAccountPda);
      
      // Assume 6 decimals for the Token Mint - Use string conversion to avoid 53-bit precision crash
      const formattedAmount = Number(accountData.creditedAmount.toString()) / 1e6;
      setCreditedAmount(formattedAmount);
    } catch (err: any) {
      // If the account doesn't exist yet, it simply means they haven't deposited anything.
      if (err.message && err.message.includes('Account does not exist')) {
        setCreditedAmount(0);
      } else {
        console.error("Error fetching credit balance:", err);
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
  }, [program, wallet?.publicKey.toString()]);

  // Execute Deposit Transaction (User pays rent for first init)
  const depositToAccount = async (amountInTokens: number) => {
    if (!program || !wallet) throw new Error("Wallet not connected");

    // Convert tokens to raw units (6 decimals)
    const rawAmount = new BN(amountInTokens * 1e6);

    if (!user?.solanaSeed) {
        throw new Error("Your account is not fully initialized. Please try logging out and back in to generate your Solana Identity Seed.");
    }

    // 1. Derive User's Credit PDA (Using identity seed) - convert hex string to Buffer for PublicKey
    const userIdPubkey = new PublicKey(Buffer.from(user.solanaSeed, 'hex'));


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
      return { tx, pdaDepositAta: pdaDepositAta.toBase58() };
    } catch (err: any) {
      if (err?.message?.includes('AccountNotInitialized') || err?.message?.includes('3012')) {
        throw new Error("You do not have any Devnet Mock Tokens! Please use a standard Solana Spl-Token Devnet faucet to get some USDC first so your token account initializes.");
      }
      throw err;
    }
  };

  return {
    program,
    mintAddress: mintProgramId.toBase58(),
    pdaAddress,
    creditedAmount,
    isRefreshing,
    fetchCreditBalance,
    depositToAccount
  };
}
