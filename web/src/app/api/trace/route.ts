import { forwardToBackend } from "@/lib/backend";

export async function POST(request: Request) {
  return forwardToBackend("/api/trace", request);
}
