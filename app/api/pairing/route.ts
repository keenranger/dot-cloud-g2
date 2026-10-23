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
