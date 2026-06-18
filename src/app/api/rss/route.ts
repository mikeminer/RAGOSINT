import { parseChannel } from "@/lib/osint";
import { rssResponse } from "@/lib/http";

export const revalidate = 1800;

export async function GET(request: Request) {
  const channel = parseChannel(new URL(request.url).searchParams.get("channel"));
  return rssResponse(channel);
}
