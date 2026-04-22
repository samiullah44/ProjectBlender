import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Setting up a Devnet Mock Token...');

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // 1. Create a dummy payer keypair specifically for this script
  const payer = Keypair.generate();
  console.log(`\n🔑 Payer Setup:\n- Wallet Address: ${payer.publicKey.toBase58()}\n- Requesting Devnet SOL Airdrop...`);
  
  try {
    const airdropSig = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSig,
    });
    console.log('✅ Airdrop Successful! Received 2 SOL.');
  } catch (e) {
    console.error('❌ Airdrop failed. Devnet faucet might be rate-limiting.', e);
    process.exit(1);
  }

  // 2. Create the Mock Mint Token
  console.log('\n🪙 Creating Mock Mint (mRNDR)...');
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6 // 6 decimals is standard for RENDER and USDC
  );
  
  console.log(`✅ Success! Mock Mint Address: ${mint.toBase58()}`);

  // 3. Write to .env
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Inject variables
  const envVars = {
    VITE_PROGRAM_ID: "DWtobtz9kRZkCwh6s4FcN7yk6177rCY1T7xQHVdybmCz",
    VITE_MINT_ADDRESS: mint.toBase58(),
    VITE_RPC_URL: "https://api.devnet.solana.com"
  };

  for (const [key, value] of Object.entries(envVars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  // Also output a private key array array so the user knows they can load it if needed
  envContent += `\n# MINT_AUTHORITY_KEYPAIR=[${payer.secretKey.toString()}]\n`;

  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('\n📝 Updated frontend/.env with devnet variables!');

  console.log('\n=======================================');
  console.log('🎉 SETUP COMPLETE! You now have a Mock Token on Devnet.');
  console.log('To get UI tokens to your Phantom wallet:');
  console.log('We will add a "Faucet" button directly into your app for testing!');
  console.log('=======================================');
}

main().catch(console.error);
