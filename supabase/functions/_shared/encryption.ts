/**
 * AES-256-GCM Encryption Helper
 * 
 * Provides secure encryption for API keys and secrets using Web Crypto API.
 * Uses AES-256-GCM which provides both confidentiality and authenticity.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // 128 bits authentication tag

/**
 * Derives a cryptographic key from the ENCRYPTION_KEY secret
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get("ENCRYPTION_KEY");
  
  if (!keyString || keyString.length < 8) {
    throw new Error("ENCRYPTION_KEY not configured or too short (min 8 chars)");
  }
  
  // Hash the key string to get consistent 256-bit key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns base64-encoded string: iv + ciphertext + tag
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty value");
  }
  
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    data
  );
  
  // Combine IV + ciphertext (includes auth tag) into single array
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Encode as base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64-encoded ciphertext encrypted with encrypt()
 * Supports fallback to legacy base64 encoding for backward compatibility
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    throw new Error("Cannot decrypt empty value");
  }
  
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    // Check if this is legacy base64-only encoding (no IV prefix)
    // AES-GCM ciphertext is always at least IV_LENGTH + 16 (min tag) + 1 (min data)
    // Legacy base64 encoding would decode to just the API key (typically 20-50 chars)
    if (combined.length < IV_LENGTH + 17) {
      // This is likely legacy base64 encoding, just decode it
      console.log("[Encryption] Detected legacy base64 encoding, returning decoded value");
      return atob(ciphertext);
    }
    
    const key = await getEncryptionKey();
    
    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH,
      },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    // If decryption fails, try legacy base64 decode as fallback
    console.warn("[Encryption] AES decryption failed, trying legacy base64:", error);
    try {
      const legacyDecoded = atob(ciphertext);
      // Validate it's a reasonable string (API keys are typically ASCII)
      if (/^[\x20-\x7E]+$/.test(legacyDecoded)) {
        console.log("[Encryption] Successfully decoded as legacy base64");
        return legacyDecoded;
      }
    } catch {
      // Ignore fallback error
    }
    throw error;
  }
}

/**
 * Checks if a ciphertext is using modern AES encryption or legacy base64
 */
export function isModernEncryption(ciphertext: string): boolean {
  try {
    const decoded = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    // Modern encryption has IV prefix making it at least IV_LENGTH + 17 bytes
    return decoded.length >= IV_LENGTH + 17;
  } catch {
    return false;
  }
}

/**
 * Re-encrypts a value from legacy base64 to modern AES-256-GCM
 * Returns null if already using modern encryption
 */
export async function upgradeEncryption(ciphertext: string): Promise<string | null> {
  if (isModernEncryption(ciphertext)) {
    return null; // Already using modern encryption
  }
  
  try {
    // Decode legacy base64
    const plaintext = atob(ciphertext);
    
    // Re-encrypt with AES-256-GCM
    return await encrypt(plaintext);
  } catch (error) {
    console.error("[Encryption] Failed to upgrade encryption:", error);
    throw error;
  }
}
