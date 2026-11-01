import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return new Response("Missing camera URL", { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response("Invalid camera URL", { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new Response("Only HTTP camera URLs are supported", { status: 400 });
  }

  try {
    const response = await fetch(target, { cache: "no-store" });
    if (!response.ok || !response.body) {
      return new Response(`Camera returned ${response.status}`, { status: 502 });
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": response.headers.get("content-type") ?? "multipart/x-mixed-replace",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach camera";
    return new Response(message, { status: 502 });
  }
}