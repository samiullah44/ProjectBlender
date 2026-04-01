import * as anchor from "@coral-xyz/anchor";
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  Commitment 
} from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "../config/env";

// We'll define a minimal IDL interface for the instructions we need
const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID || "DWtobtz9kRZkCwh6s4FcN7yk6177rCY1T7xQHVdybmCz");

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
    
    // Minimal IDL for the logical escrow
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
        }
      ]
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
   * Logical Lock: Reserves funds in the user's account PDA without tokens moving.
   * This is what enables the Zero-Prompt UX.
   */
  public async lockPayment(userId: string, jobId: number, amount: number): Promise<string> {
    try {
      // 1. Derive User Account PDA (using the website identity seed)
      // Note: userId here should be the public key used as the seed on-chain
      const userSeed = new PublicKey(userId);
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
      const userSeed = new PublicKey(userId);
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

  public getAdminPublicKey(): string {
    return this.wallet.publicKey.toBase58();
  }
}

export const solanaService = SolanaService.getInstance();
