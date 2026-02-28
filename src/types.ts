export interface HmacConfig {
  /** Directory path where the key file will be stored */
  keyStoragePath: string;
  /** Key file name (default: '.integrity-key') */
  keyFileName?: string;
  /** Optional function to encrypt the key before writing to disk */
  encryptKey?: (keyHex: string) => Buffer;
  /** Optional function to decrypt the key after reading from disk */
  decryptKey?: (encrypted: Buffer) => string;
  /** Whether to warn when no encryption is available (default: true) */
  warnOnNoEncryption?: boolean;
}
