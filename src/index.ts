export {
  initializeHmac,
  resetHmac,
  sign,
  signBytes,
  verify,
  verifyBytes,
  signObject,
  verifyObject,
  signFile,
  verifyFile,
  isInitialized,
  isEncryptionAvailable,
} from './hmac';

export type { HmacConfig } from './types';
