import { failure, identityConfiguration, json } from "@/lib/relay/http";
export async function GET(request: Request) {
  try {
    return json(identityConfiguration(request));
  } catch (error) {
    return failure(error);
  }
}
