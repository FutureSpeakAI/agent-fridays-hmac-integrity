import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { HmacConfig } from './types';

const KEY_LENGTH = 32;
const ALGORITHM = 'sha256';

let signingKey: Buffer | null = null;
let _initialized = false;
let _encryptionAvailable = false;

/**
 * Initialize the HMAC subsystem. Loads or generates a signing key.
 *
 * If `encryptKey` and `decryptKey` are provided in the config, the key
 * is encrypted at rest. Otherwise it is stored as plaintext with a
 * console warning (unless `warnOnNoEncryption` is set to `false`).
 */
export async function initializeHmac(config: HmacConfig): Promise<void> {
  if (_initialized) return;

  const keyFileName = config.keyFileName || '.integrity-key';
  const keyPath = path.join(config.keyStoragePath, keyFileName);
  const hasEncryption = !!(config.encryptKey && config.decryptKey);
  _encryptionAvailable = hasEncryption;

  if (!hasEncryption && config.warnOnNoEncryption !== false) {
    console.warn(
      '[HMAC] WARNING: No key encryption configured. HMAC keys stored unencrypted.'
    );
  }

  try {
    const encryptedKey = await fs.readFile(keyPath);
    if (hasEncryption) {
      const decrypted = config.decryptKey!(encryptedKey);
      signingKey = Buffer.from(decrypted, 'hex');
    } else {
      signingKey = encryptedKey;
    }
  } catch {
    signingKey = crypto.randomBytes(KEY_LENGTH);
    await fs.mkdir(config.keyStoragePath, { recursive: true });
    if (hasEncryption) {
      const encrypted = config.encryptKey!(signingKey.toString('hex'));
      await fs.writeFile(keyPath, encrypted);
    } else {
      await fs.writeFile(keyPath, signingKey);
    }
  }

  _initialized = true;
}

/**
 * Reset the HMAC subsystem (useful for testing).
 * Clears the in-memory signing key and marks the module as uninitialized.
 */
export function resetHmac(): void {
  signingKey = null;
  _initialized = false;
  _encryptionAvailable = false;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureInitialized(): void {
  if (!signingKey) {
    throw new Error(
      'HMAC not initialized. Call initializeHmac() before using signing functions.'
    );
  }
}

// ---------------------------------------------------------------------------
// Core signing / verification
// ---------------------------------------------------------------------------

/**
 * Sign a UTF-8 string. Returns the HMAC-SHA256 as a hex string.
 */
export function sign(data: string): string {
  ensureInitialized();
  return crypto.createHmac(ALGORITHM, signingKey!).update(data).digest('hex');
}

/**
 * Sign a Buffer. Returns the raw HMAC-SHA256 digest as a Buffer.
 */
export function signBytes(data: Buffer): Buffer {
  ensureInitialized();
  return crypto.createHmac(ALGORITHM, signingKey!).update(data).digest();
}

/**
 * Verify a string against a hex signature using timing-safe comparison.
 */
export function verify(data: string, expectedSignature: string): boolean {
  ensureInitialized();
  const actual = sign(data);
  const actualBuf = Buffer.from(actual, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Verify a Buffer against a raw signature Buffer using timing-safe comparison.
 */
export function verifyBytes(data: Buffer, expectedSignature: Buffer): boolean {
  ensureInitialized();
  const actual = signBytes(data);
  if (actual.length !== expectedSignature.length) return false;
  return crypto.timingSafeEqual(actual, expectedSignature);
}

// ---------------------------------------------------------------------------
// Object signing / verification
// ---------------------------------------------------------------------------

/**
 * Sign a JSON-serializable object.
 * The object is converted to a deterministic JSON string (sorted keys) and
 * signed. Returns the hex signature.
 */
export function signObject(obj: unknown): string {
  ensureInitialized();
  const canonical = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return sign(canonical);
}

/**
 * Verify a JSON-serializable object against a hex signature.
 */
export function verifyObject(obj: unknown, expectedSignature: string): boolean {
  ensureInitialized();
  const canonical = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return verify(canonical, expectedSignature);
}

// ---------------------------------------------------------------------------
// File signing / verification
// ---------------------------------------------------------------------------

/**
 * Sign a file by its full path. Returns the hex signature.
 */
export async function signFile(filePath: string): Promise<string> {
  ensureInitialized();
  const content = await fs.readFile(filePath);
  return signBytes(content).toString('hex');
}

/**
 * Verify a file against a hex signature.
 */
export async function verifyFile(
  filePath: string,
  expectedSignature: string
): Promise<boolean> {
  ensureInitialized();
  const content = await fs.readFile(filePath);
  const actual = signBytes(content).toString('hex');
  const actualBuf = Buffer.from(actual, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `initializeHmac()` has been called successfully.
 */
export function isInitialized(): boolean {
  return _initialized;
}

/**
 * Returns `true` if key encryption callbacks were provided during
 * initialization (i.e. the key is encrypted at rest).
 */
export function isEncryptionAvailable(): boolean {
  return _encryptionAvailable;
}
