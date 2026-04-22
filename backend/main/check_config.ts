
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

async function checkConfig() {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const programId = new PublicKey(process.env.SOLANA_PROGRAM_ID!);
    
    const secretKeyStr = process.env.SOLANA_ADMIN_SECRET_KEY!;
    const secretKey = new Uint8Array(JSON.parse(secretKeyStr));
    const adminWallet = Keypair.fromSecretKey(secretKey);
    
    console.log("Admin Wallet:", adminWallet.publicKey.toBase58());
    
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config_v3")],
        programId
    );
    
    // Minimal IDL for globalConfig
    const idl: any = {
        version: "0.1.0",
        name: "render_network",
        instructions: [],
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
        ],
    };
    
    const provider = new anchor.AnchorProvider(connection, new (anchor as any).Wallet(adminWallet), { commitment: "confirmed" });
    const program = new anchor.Program(idl, programId, provider);
    
    try {
        const config: any = await program.account.globalConfig.fetch(configPda);
        console.log("Config Admin:", config.admin.toBase58());
        console.log("Config Fee Collector:", config.feeCollector.toBase58());
        console.log("Platform Fee Bps:", config.platformFeeBps.toString());
        
        if (config.feeCollector.toBase58() === adminWallet.publicKey.toBase58()) {
            console.log("✅ Admin IS the Fee Collector. Withdrawal can be done via standard SPL transfer.");
        } else {
            console.log("⚠️ Admin is NOT the Fee Collector.");
            const isOnCurve = PublicKey.isOnCurve(config.feeCollector);
            console.log(`Fee Collector is ${isOnCurve ? "on-curve (Wallet)" : "off-curve (PDA)"}`);
            if (isOnCurve) {
                console.log("Standard SPL transfer requires the Fee Collector's secret key.");
            } else {
                console.log("Withdrawal from a PDA requires a program-specific instruction (none found in IDL).");
            }
        }
    } catch (err) {
        console.error("Failed to fetch config:", err);
    }
}

checkConfig();
