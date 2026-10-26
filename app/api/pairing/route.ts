import { failure, json, ownerIdentity, runtime, requireSameOrigin } from "@/lib/relay/http";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = ownerIdentity(request);
    return json(await runtime().relay.pairing(owner));
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  try {
    const owner = ownerIdentity(request);
    return json({ active: await runtime().relay.activePairing(owner) });
  } catch (error) {
    return failure(error);
  }
}
