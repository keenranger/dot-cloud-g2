import { z } from "zod";
import { failure, json, jsonBody, runtime, deviceCors, deviceOptions } from "@/lib/relay/http";
export async function POST(request: Request) {
  try {
    const { code } = z
      .object({ code: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await jsonBody(request));
    const { relay } = runtime();
    return deviceCors(json(await relay.pair(code)));
  } catch (error) {
    return deviceCors(failure(error));
  }
}

export const OPTIONS = deviceOptions;
