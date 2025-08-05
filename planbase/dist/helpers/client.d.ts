import { Client, type Signer } from "@xmtp/node-sdk";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
interface User {
    key: `0x${string}`;
    account: ReturnType<typeof privateKeyToAccount>;
    wallet: ReturnType<typeof createWalletClient>;
}
export declare const createUser: (key: string) => User;
export declare const createSigner: (key: string) => Signer;
/**
 * Generate a random encryption key
 * @returns The encryption key
 */
export declare const generateEncryptionKeyHex: () => string;
/**
 * Get the encryption key from a hex string
 * @param hex - The hex string
 * @returns The encryption key
 */
export declare const getEncryptionKeyFromHex: (hex: string) => Uint8Array<ArrayBufferLike>;
export declare const getDbPath: (description?: string) => string;
export declare const logAgentDetails: (clients: Client | Client[]) => Promise<void>;
export declare function validateEnvironment(vars: string[]): Record<string, string>;
export {};
//# sourceMappingURL=client.d.ts.map