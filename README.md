> **This project now lives on in [Agent-Friday](https://github.com/FutureSpeakAI/Agent-Friday), archived 2026-10-11.**

# hmac-integrity

HMAC-SHA256 signing and verification for file integrity, object signing, and tamper detection — with pluggable key encryption.

## Overview

`hmac-integrity` provides a straightforward API for signing and verifying strings, byte buffers, JSON objects, and files using HMAC-SHA256. It manages a 256-bit signing key that is persisted to disk and can optionally be encrypted at rest using a pluggable encryption layer.

Originally extracted from [Agent Friday](https://github.com/FutureSpeakAI/agent-friday), an Electron-based AI agent desktop application built by FutureSpeak AI. The original implementation used Electron's `safeStorage` API for key encryption and `dialog` for user prompts. This standalone version replaces those Electron-specific dependencies with a pluggable configuration interface, making it usable in any Node.js project.

## Installation

```bash
npm install hmac-integrity
```

## Quick Start

### Basic usage (no key encryption)

```typescript
import { initializeHmac, sign, verify } from 'hmac-integrity';

await initializeHmac({
  keyStoragePath: '/path/to/secure/dir',
});

const signature = sign('hello world');
const isValid = verify('hello world', signature); // true
```

> **Note:** Without encryption callbacks the key is stored as plaintext. A
> console warning is emitted unless you set `warnOnNoEncryption: false`.

### With pluggable key encryption

```typescript
import { initializeHmac, sign, verify } from 'hmac-integrity';

await initializeHmac({
  keyStoragePath: '/path/to/secure/dir',
  encryptKey: (keyHex) => myEncrypt(keyHex),   // returns Buffer
  decryptKey: (buf) => myDecrypt(buf),          // returns hex string
});

const sig = sign('sensitive payload');
console.log(verify('sensitive payload', sig)); // true
```

### With Electron safeStorage

```typescript
import { safeStorage } from 'electron';
import { app } from 'electron';
import { initializeHmac } from 'hmac-integrity';

await initializeHmac({
  keyStoragePath: app.getPath('userData'),
  encryptKey: (keyHex) => safeStorage.encryptString(keyHex),
  decryptKey: (buf) => safeStorage.decryptString(buf),
});
```

### With keytar (system keychain)

```typescript
import keytar from 'keytar';
import crypto from 'crypto';
import { initializeHmac } from 'hmac-integrity';

// keytar stores credentials in the OS keychain — we use a derived
// encryption key to wrap the HMAC key on disk.
const secret = await keytar.getPassword('my-app', 'hmac-wrapper')
  ?? crypto.randomBytes(32).toString('hex');
await keytar.setPassword('my-app', 'hmac-wrapper', secret);

const wrapperKey = crypto.createHash('sha256').update(secret).digest();

await initializeHmac({
  keyStoragePath: '/path/to/secure/dir',
  encryptKey: (keyHex) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', wrapperKey, iv);
    return Buffer.concat([iv, cipher.update(keyHex, 'utf8'), cipher.final()]);
  },
  decryptKey: (buf) => {
    const iv = buf.subarray(0, 16);
    const data = buf.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', wrapperKey, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  },
});
```

## API Reference

### `initializeHmac(config: HmacConfig): Promise<void>`

Initialize the HMAC subsystem. Must be called before any signing or verification function. If the key file already exists it is loaded; otherwise a new 256-bit key is generated and persisted.

**`HmacConfig` fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `keyStoragePath` | `string` | Yes | Directory where the key file is stored |
| `keyFileName` | `string` | No | Key file name (default: `'.integrity-key'`) |
| `encryptKey` | `(keyHex: string) => Buffer` | No | Encrypt the key before writing to disk |
| `decryptKey` | `(encrypted: Buffer) => string` | No | Decrypt the key after reading from disk |
| `warnOnNoEncryption` | `boolean` | No | Warn when no encryption callbacks are provided (default: `true`) |

### `resetHmac(): void`

Clear the in-memory signing key and mark the subsystem as uninitialized. Useful for testing.

### `sign(data: string): string`

Sign a UTF-8 string. Returns the HMAC-SHA256 as a hex string.

### `signBytes(data: Buffer): Buffer`

Sign a Buffer. Returns the raw HMAC-SHA256 digest as a Buffer.

### `verify(data: string, expectedSignature: string): boolean`

Verify a string against a hex signature using **timing-safe comparison**.

### `verifyBytes(data: Buffer, expectedSignature: Buffer): boolean`

Verify a Buffer against a raw signature Buffer using **timing-safe comparison**.

### `signObject(obj: unknown): string`

Sign a JSON-serializable object. The object is serialized with sorted keys for deterministic output. Returns a hex signature.

### `verifyObject(obj: unknown, expectedSignature: string): boolean`

Verify a JSON-serializable object against a hex signature.

### `signFile(filePath: string): Promise<string>`

Read a file and return its HMAC-SHA256 hex signature.

### `verifyFile(filePath: string, expectedSignature: string): Promise<boolean>`

Verify a file against a hex signature using **timing-safe comparison**.

### `isInitialized(): boolean`

Returns `true` if `initializeHmac()` has completed successfully.

### `isEncryptionAvailable(): boolean`

Returns `true` if key encryption callbacks were provided during initialization.

## Security Model

- **256-bit keys** — Generated with `crypto.randomBytes(32)`.
- **HMAC-SHA256** — Industry-standard message authentication code.
- **Timing-safe comparison** — All verification functions use `crypto.timingSafeEqual` to prevent timing side-channel attacks.
- **Key file separation** — The signing key is stored in a separate file, not alongside the data it protects.
- **Pluggable encryption** — Bring your own key-encryption layer (Electron `safeStorage`, OS keychain via `keytar`, HSM, KMS, etc.).
- **Plaintext fallback** — When no encryption callbacks are provided, the key is stored as plaintext with a console warning. Suitable for development but not recommended for production.

## Use Cases

- **File integrity** — Sign configuration files, database snapshots, or build artifacts and verify them before use.
- **Config tamper detection** — Sign application settings at write time; reject tampered settings at load time.
- **Object signing** — Attach HMAC signatures to JSON payloads for transport or storage.
- **API request signing** — Sign outbound requests and verify inbound webhooks.
- **Cache validation** — Ensure cached data has not been modified.

## Origin

This package was extracted from **Agent Friday**, an Electron-based AI agent desktop application built by FutureSpeak AI. The original implementation used Electron's `safeStorage` API for key encryption and `dialog` for user prompts. This standalone version replaces those Electron-specific dependencies with a pluggable configuration interface, making it usable in any Node.js project.

## License

MIT — Copyright (c) 2025 FutureSpeak AI
