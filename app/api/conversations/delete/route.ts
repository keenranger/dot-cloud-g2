import { z } from "zod";
import { failure, json, jsonBody, ownerIdentity, runtime, requireSameOrigin } from "@/lib/relay/http";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = ownerIdentity(request);
    z.object({ all: z.literal(true) })
      .strict()
      .parse(await jsonBody(request));
    return json(await runtime().relay.deleteConversations(owner));
  } catch (error) {
    return failure(error);
  }
}
