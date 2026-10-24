import { deviceIdentity, failure, json, runtime, deviceCors, deviceOptions } from "@/lib/relay/http";
export async function GET(request: Request) {
  try {
    const { relay } = runtime();
    const device = await deviceIdentity(request, relay);
    return deviceCors(json(await relay.poll(device)));
  } catch (error) {
    return deviceCors(failure(error));
  }
}

export const OPTIONS = deviceOptions;
