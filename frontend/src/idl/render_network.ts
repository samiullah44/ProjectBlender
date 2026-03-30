// Replace with your generated Program ID and generic DEVNET Mock Token Mint
export const RENDER_NETWORK_PROGRAM_ID = import.meta.env.VITE_SOLANA_PROGRAM_ID || "DWtobtz9kRZkCwh6s4FcN7yk6177rCY1T7xQHVdybmCz";


// We will export the IDL imported from the JSON
import idlJson from './render_network.json';

// Make sure the JSON is cast correctly for anchor 
export const idl = idlJson;

// We can define the PDA Seed derivations here for easy importing
export const SEED_USER_ACCOUNT = "user_account";
