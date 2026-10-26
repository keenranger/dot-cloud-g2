import { failure, json, ownerIdentity, runtime, requireSameOrigin } from "@/lib/relay/http";
// Returns the signed-in owner's connection key on an explicit request; json() marks every response no-store.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = ownerIdentity(request);
    return json(await runtime().relay.revealPairing(owner));
  } catch (error) {
    return failure(error);
  }
}
