import { deviceIdentity, failure, json, jsonBody, runtime, deviceCors, deviceOptions } from "@/lib/relay/http";
export async function POST(request: Request) {
  try {
    const { relay } = runtime();
    const device = await deviceIdentity(request, relay);
    return deviceCors(json(await relay.submit(device, await jsonBody(request))));
  } catch (error) {
    return deviceCors(failure(error));
  }
}

export const OPTIONS = deviceOptions;
