import { rssResponse } from "@/lib/http";

export const revalidate = 1800;

export async function GET() {
  return rssResponse("all");
}
