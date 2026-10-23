import { z } from "zod";
import { Relay, RelayError } from "./core";
const empty = { type: "object", properties: {}, additionalProperties: false };
const textProperty = { type: "string", minLength: 1, maxLength: 8000 };
const uuid = { type: "string", format: "uuid" };
export const tools = [
  {
    name: "reply_to_g2",
    description:
      "Reply to an owner's pending Even G2 utterance using utterance_id. Receipt confirms durable storage, not physical display.",
    inputSchema: {
      type: "object",
      properties: { utterance_id: uuid, text: textProperty },
      required: ["utterance_id", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "send_message_to_g2",
    description:
      "Send a proactive message to the owner's G2 devices. Generate a UUID message_id; retry with identical ID and text. Receipt confirms durable storage, not physical display.",
    inputSchema: {
      type: "object",
      properties: { message_id: uuid, text: textProperty },
      required: ["message_id", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "get_pending_utterances",
    description:
      "Read up to 10 unanswered owner utterances, oldest first. Use after utterance.created even if its body is unavailable. Follow next_cursor with cursor to reach newer unanswered utterances.",
    inputSchema: {
      type: "object",
      properties: { cursor: { type: "string", maxLength: 512 } },
      additionalProperties: false,
    },
  },
  {
    name: "get_status",
    description:
      "Read owner connection status and event transport verification state, without conversation text. Speech is transcribed on the phone directly (transcriptionMode phone_direct_soniox); sttConfigured refers only to legacy server-side transcription, and phoneKeyConfigured is null because the relay cannot know whether the phone has a key. Do not infer phone speech readiness from either field.",
    inputSchema: empty,
  },
];
export const eventDefinition = {
  name: "utterance.created",
  description: "An utterance from an Even G2 paired by this signed-in owner.",
  delivery: ["webhook"],
  inputSchema: {
    type: "object",
    properties: { session_id: { type: "string", const: "g2" } },
    required: ["session_id"],
    additionalProperties: false,
  },
  payloadSchema: {
    type: "object",
    properties: { session_id: { type: "string", const: "g2" }, utterance_id: uuid, text: { type: "string" } },
    required: ["session_id", "utterance_id", "text"],
    additionalProperties: false,
  },
};
const serverInfo = { name: "even-g2-cloud-relay", version: "0.1.0" };
export async function dispatch(
  relay: Relay,
  owner: string,
  method: string,
  params: unknown,
  sttConfigured = false,
): Promise<unknown> {
  switch (method) {
    case "server/discover":
      return {
        supportedVersions: ["2026-07-28"],
        capabilities: { tools: {}, events: {} },
        serverInfo,
        _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
      };
    case "tools/list":
      return { tools };
    case "events/list":
      return { events: [eventDefinition] };
    case "events/subscribe":
      return relay.subscribe(owner, params);
    case "events/unsubscribe":
      return relay.unsubscribe(owner, params);
    case "tools/call": {
      const input = z.object({ name: z.string(), arguments: z.unknown().optional() }).parse(params);
      let result: unknown;
      try {
        switch (input.name) {
          case "reply_to_g2":
            result = await relay.reply(owner, input.arguments);
            break;
          case "send_message_to_g2":
            result = await relay.send(owner, input.arguments);
            break;
          case "get_pending_utterances": {
            const args = z
              .object({ cursor: z.string().max(512).optional() })
              .strict()
              .parse(input.arguments ?? {});
            result = await relay.pendingPage(owner, args.cursor);
            break;
          }
          case "get_status":
            z.object({})
              .strict()
              .parse(input.arguments ?? {});
            result = await relay.status(owner, sttConfigured);
            break;
          default:
            throw new RelayError(400, "Unknown tool");
        }
      } catch (error) {
        return {
          content: [
            { type: "text", text: error instanceof RelayError ? error.message : "Tool request could not be completed" },
          ],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
    default:
      throw new RelayError(404, "Unknown MCP method");
  }
}
