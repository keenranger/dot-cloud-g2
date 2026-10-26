declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    // Sites runtime secret: standard base64 of 32 random bytes sealing owners' connection keys.
    PAIRING_KEY_ENCRYPTION_KEY?: string;
  }
}
