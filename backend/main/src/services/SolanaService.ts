import * as anchor from "@coral-xyz/anchor";
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  Commitment,
  AccountMeta 
} from "@solana/web3.js";
import { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { env } from "../config/env";

// We'll define a minimal IDL interface for the instructions we need
const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID || "DWtobtz9kRZkCwh6s4FcN7yk6177rCY1T7xQHVdybmCz");
const MINT_ADDRESS = new PublicKey(process.env.SOLANA_MINT_ADDRESS || "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

export interface BatchItem {
  jobId: anchor.BN;
  payouts: { provider: PublicKey; amount: anchor.BN }[];
}

export class SolanaService {
  private static instance: SolanaService;
  private connection: Connection;
  private wallet: Keypair;
  private program: anchor.Program;

  private constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    this.connection = new Connection(rpcUrl, "confirmed" as Commitment);
    
    // Load Admin Wallet from Base58 or Byte Array
    const secretKeyStr = process.env.SOLANA_ADMIN_SECRET_KEY;
    if (!secretKeyStr) {
      throw new Error("SOLANA_ADMIN_SECRET_KEY is not defined in environment");
    }

    let secretKey: Uint8Array;
    
    try {
      if (secretKeyStr.startsWith('[')) {
        secretKey = new Uint8Array(JSON.parse(secretKeyStr));
      } else {
        secretKey = bs58.decode(secretKeyStr);
      }
      this.wallet = Keypair.fromSecretKey(secretKey);
    } catch (e: any) {
      throw new Error(`Failed to decode SOLANA_ADMIN_SECRET_KEY: ${e.message}`);
    }
    
    // Setup Anchor Provider & Program
    const provider = new anchor.AnchorProvider(
      this.connection,
      new (anchor as any).Wallet(this.wallet),
      { commitment: "confirmed" }
    );
    
    // Minimal IDL for the logical escrow + batch release
    const idl: any = {
      version: "0.1.0",
      name: "render_network",
      instructions: [
        {
          name: "adminLockPayment",
          accounts: [
            { name: "config", isMut: false, isSigner: false },
            { name: "admin", isMut: true, isSigner: true },
            { name: "userAccount", isMut: true, isSigner: false },
          ],
          args: [
            { name: "jobId", type: "u64" },
            { name: "amount", type: "u64" },
          ],
        },
        {
          name: "adminCancelPayment",
          accounts: [
            { name: "config", isMut: false, isSigner: false },
            { name: "admin", isMut: true, isSigner: true },
            { name: "userAccount", isMut: true, isSigner: false },
          ],
          args: [
            { name: "jobId", type: "u64" },
            { name: "amount", type: "u64" },
          ],
        },
        {
          name: "batchRelease",
          accounts: [
            { name: "config", isMut: false, isSigner: false },
            { name: "admin", isMut: true, isSigner: true },
            { name: "userAccount", isMut: true, isSigner: false },
            { name: "mint", isMut: false, isSigner: false },
            { name: "userDepositTokenAccount", isMut: true, isSigner: false },
            { name: "feeCollectorTokenAccount", isMut: true, isSigner: false },
            { name: "tokenProgram", isMut: false, isSigner: false },
          ],
          args: [
            {
              name: "batch",
              type: {
                vec: {
                  defined: "BatchItem",
                },
              },
            },
          ],
        },
      ],
      accounts: [
        {
          name: "globalConfig",
          type: {
            kind: "struct",
            fields: [
              { name: "admin", type: "publicKey" },
              { name: "feeCollector", type: "publicKey" },
              { name: "platformFeeBps", type: "u64" },
              { name: "version", type: "u8" },
            ],
          },
        },
        {
          name: "userAccount",
          type: {
            kind: "struct",
            fields: [
              { name: "owner", type: "publicKey" },
              { name: "userId", type: "publicKey" },
              { name: "mint", type: "publicKey" },
              { name: "creditedAmount", type: "u64" },
              { name: "lockedAmount", type: "u64" },
              { name: "lastJobNonce", type: "u64" },
              { name: "bump", type: "u8" },
              { name: "version", type: "u8" },
            ],
          },
        },
      ],
      types: [
        {
          name: "BatchItem",
          type: {
            kind: "struct",
            fields: [
              { name: "jobId", type: "u64" },
              {
                name: "payouts",
                type: {
                  vec: {
                    defined: "Payout",
                  },
                },
              },
            ],
          },
        },
        {
          name: "Payout",
          type: {
            kind: "struct",
            fields: [
              { name: "provider", type: "publicKey" },
              { name: "amount", type: "u64" },
            ],
          },
        },
      ],
    };

    this.program = new anchor.Program(idl, PROGRAM_ID, provider);
  }

  public static getInstance(): SolanaService {
    if (!SolanaService.instance) {
      SolanaService.instance = new SolanaService();
    }
    return SolanaService.instance;
  }

  /**
   * Helper to safely parse a seed string (hex or base58) into a PublicKey.
   * This handles backward compatibility for hex-encoded solanaSeeds.
   */
  private parseUserSeed(seed: string): PublicKey {
    try {
      // 1. Check if it's a 64-char hex string (32 bytes)
      if (seed.length === 64 && /^[0-9a-fA-F]+$/.test(seed)) {
        return new PublicKey(Buffer.from(seed, 'hex'));
      }
      // 2. Otherwise assume Base58 (default for PublicKey)
      return new PublicKey(seed);
    } catch (e) {
      console.error(`[SolanaService] Failed to parse user seed: ${seed}`, e);
      throw e;
    }
  }

  /**
   * Logical Lock: Reserves funds in the user's account PDA without tokens moving.
   * This is what enables the Zero-Prompt UX.
   */
  public async lockPayment(userId: string, jobId: number, amount: number): Promise<string> {
    try {
      // 1. Derive User Account PDA (using the website identity seed)
      // Note: userId here is the solanaSeed string (hex or base58)
      const userSeed = this.parseUserSeed(userId);
      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_account_v2"), userSeed.toBuffer()],
        this.program.programId
      );

      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config_v3")],
        this.program.programId
      );

      console.log(`[SolanaService] Locking ${amount} for User ${userId}, Job ${jobId}`);

      // 2. Execute adminLockPayment
      const rawAmount = new anchor.BN(amount * 1_000_000);
      const tx = await (this.program.methods as any)
        .adminLockPayment(new anchor.BN(jobId), rawAmount)
        .accounts({
          config: configPda,
          admin: this.wallet.publicKey,
          userAccount: userAccountPda,
        })
        .rpc();

      return tx;
    } catch (error: any) {
      console.error("[SolanaService] Lock Payment Failed:", error);
      throw new Error(`Solana Transaction Failed: ${error.message}`);
    }
  }

  public async cancelPayment(userId: string, jobId: number, amount: number): Promise<string> {
    try {
      const userSeed = this.parseUserSeed(userId);
      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_account_v2"), userSeed.toBuffer()],
        this.program.programId
      );

      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config_v3")],
        this.program.programId
      );

      console.log(`[SolanaService] Unlocking ${amount} for User ${userId}, Job ${jobId}`);

      const rawAmount = new anchor.BN(amount * 1_000_000);
      const tx = await (this.program.methods as any)
        .adminCancelPayment(new anchor.BN(jobId), rawAmount)
        .accounts({
          config: configPda,
          admin: this.wallet.publicKey,
          userAccount: userAccountPda,
        })
        .rpc();

      return tx;
    } catch (error: any) {
      console.error("[SolanaService] Cancel Payment Failed:", error);
      throw new Error(`Solana Transaction Failed: ${error.message}`);
    }
  }

  /**
   * Batch Release: Transfers locked tokens from User PDA → Provider ATAs + Fee Collector.
   * @param userSolanaSeed - The Solana pubkey used as seed for the user's PDA
   * @param batchItems - Array of { jobId, payouts: [{ provider, amount }] }
   * @param providerTokenAccounts - Pre-resolved ATAs for each provider, in the same order as payouts
   * @returns Transaction signature
   */
  public async batchRelease(
    userSolanaSeed: string,
    batchItems: any[],
    providerTokenAccounts: PublicKey[]
  ): Promise<string> {
    try {
      const userSeed = this.parseUserSeed(userSolanaSeed);

      // Derive PDAs
      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_account_v2"), userSeed.toBuffer()],
        this.program.programId
      );
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config_v3")],
        this.program.programId
      );

      // Derive token accounts
      const userDepositTokenAccount = await getAssociatedTokenAddress(
        MINT_ADDRESS,
        userAccountPda,
        true // allowOwnerOffCurve (PDA)
      );

      // Fee collector: read from on-chain config
      const configAccount = await (this.program.account as any).globalConfig.fetch(configPda);
      const feeCollector = configAccount.feeCollector as PublicKey;
      
      // ── ATA AUTO-CREATION: Ensure fee collector's token account exists ──
      const feeCollectorTokenAccountObj = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet as any, // Admin is the payer
        MINT_ADDRESS,
        feeCollector
      );
      const feeCollectorTokenAccount = feeCollectorTokenAccountObj.address;

      // Build remaining accounts (provider ATAs in exact order matching payouts)
      const remainingAccounts: AccountMeta[] = providerTokenAccounts.map((ata) => ({
        pubkey: ata,
        isSigner: false,
        isWritable: true,
      }));

      const totalPayouts = batchItems.reduce((sum, item) => sum + item.payouts.length, 0);
      console.log(`[SolanaService] BatchRelease: User=${userSolanaSeed.substring(0, 8)}..., Jobs=${batchItems.length}, Payouts=${totalPayouts}`);

      const tx = await (this.program.methods as any)
        .batchRelease(batchItems)
        .accounts({
          config: configPda,
          admin: this.wallet.publicKey,
          userAccount: userAccountPda,
          mint: MINT_ADDRESS,
          userDepositTokenAccount: userDepositTokenAccount,
          feeCollectorTokenAccount: feeCollectorTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();

      console.log(`[SolanaService] BatchRelease TX confirmed: ${tx}`);
      return tx;
    } catch (error: any) {
      console.error("[SolanaService] Batch Release Failed:", error);
      throw new Error(`Batch Release TX Failed: ${error.message}`);
    }
  }

  /**
   * Fetch the on-chain UserAccount state for verification after settlement.
   */
  public async getUserAccountState(userSolanaSeed: string): Promise<{ creditedAmount: number; lockedAmount: number }> {
    try {
      const userSeed = this.parseUserSeed(userSolanaSeed);
      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_account_v2"), userSeed.toBuffer()],
        this.program.programId
      );
      const account = await (this.program.account as any).userAccount.fetch(userAccountPda);
      return {
        creditedAmount: (account.creditedAmount as anchor.BN).toNumber(),
        lockedAmount: (account.lockedAmount as anchor.BN).toNumber(),
      };
    } catch (error: any) {
      console.error("[SolanaService] getUserAccountState Failed:", error);
      throw error;
    }
  }
  
  /**
   * Fetch current platform fee statistics from on-chain.
   */
  public async getPlatformFeeStats(): Promise<{ 
    collectorWallet: string; 
    feeTokenAccount: string; 
    balance: number;
    platformFeeBps: number;
  }> {
    try {
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config_v3")],
        this.program.programId
      );

      // 1. Fetch GlobalConfig
      const configAccount = await (this.program.account as any).globalConfig.fetch(configPda);
      const feeCollector = configAccount.feeCollector as PublicKey;
      const platformFeeBps = (configAccount.platformFeeBps as anchor.BN).toNumber();

      // 2. Derive ATA for fee collector
      const feeTokenAccount = await getAssociatedTokenAddress(
        MINT_ADDRESS,
        feeCollector,
        false // Owner is a wallet (User), not a PDA
      );

      // 3. Fetch current balance
      let balance = 0;
      try {
        const balanceResponse = await this.connection.getTokenAccountBalance(feeTokenAccount);
        balance = balanceResponse.value.uiAmount || 0;
      } catch (err) {
        // If account doesn't exist yet, balance is 0
        console.warn(`[SolanaService] Fee token account ${feeTokenAccount.toBase58()} not initialized yet or empty.`);
      }

      return {
        collectorWallet: feeCollector.toBase58(),
        feeTokenAccount: feeTokenAccount.toBase58(),
        balance,
        platformFeeBps
      };
    } catch (error: any) {
      console.error("[SolanaService] getPlatformFeeStats Failed:", error);
      throw error;
    }
  }

  public getAdminPublicKey(): string {
    return this.wallet.publicKey.toBase58();
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public getMintAddress(): PublicKey {
    return MINT_ADDRESS;
  }
}

export const solanaService = SolanaService.getInstance();

