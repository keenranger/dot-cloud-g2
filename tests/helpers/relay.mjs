import { Relay, importPairingSecret } from "../../lib/relay/core.ts";

// Synthetic, test-only sealing secret (32 bytes of 0x2a); never a deployed value.
export const testPairingSecret = Buffer.alloc(32, 0x2a).toString("base64");
// A relay configured like a deployment that has its connection-key secret.
export class TestRelay extends Relay {
  constructor(store, transport, now, secret = importPairingSecret(testPairingSecret)) {
    super(store, transport, now, secret);
  }
}
