import { z } from "zod";
import { RelayError } from "@/lib/relay/core";
import { dispatch } from "@/lib/relay/mcp";
import { failure, json, jsonBody, ownerIdentity, runtime } from "@/lib/relay/http";
export async function POST(request: Request) {
  let id: string | number | null = null;
  try {
    if (request.headers.has("origin")) throw new RelayError(403, "Browser requests are not accepted on MCP");
    const owner = ownerIdentity(request);
    const input = z
      .object({
        jsonrpc: z.literal("2.0"),
        id: z.union([z.string().max(256), z.number().finite(), z.null()]).optional(),
        method: z.string().max(128),
        params: z.unknown().optional(),
      })
      .strict()
      .parse(await jsonBody(request));
    id = input.id ?? null;
    const { relay, apiKey } = runtime();
    if (input.method.startsWith("notifications/")) return new Response(null, { status: 202 });
    return json({ jsonrpc: "2.0", id, result: await dispatch(relay, owner, input.method, input.params, !!apiKey) });
  } catch (error) {
    if (error instanceof RelayError && error.status === 401) return failure(error);
    const code =
      error instanceof RelayError && error.status === 404
        ? -32601
        : error instanceof z.ZodError || (error instanceof RelayError && error.status === 400)
          ? -32602
          : -32603;
    return json({
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message:
          error instanceof RelayError
            ? error.message
            : code === -32602
              ? "Invalid request parameters"
              : "Request could not be completed",
      },
    });
  }
}
