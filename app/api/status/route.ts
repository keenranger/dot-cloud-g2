import { failure, json, ownerIdentity, runtime } from "@/lib/relay/http";
export async function GET(request: Request) {
  try {
    const owner = ownerIdentity(request);
    const { relay, apiKey } = runtime();
    return json(await relay.status(owner, !!apiKey));
  } catch (error) {
    return failure(error);
  }
}
