import { NextRequest, NextResponse } from "next/server";
import {
  getApiBySlug,
  checkRateLimit,
  recordUsage,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needed for fs

type Params = { params: Promise<{ slug: string }> };

async function handleProxy(request: NextRequest, { params }: Params) {
  const start = Date.now();
  const { slug } = await params;

  try {
    const api = await getApiBySlug(slug);
    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    // Optional: require client key from header
    // For now we support both: path-only OR with X-API-Key header
    const clientKeyHeader = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    let clientKey = api.clientKeys.find((k) => k.key === clientKeyHeader);

    // If the API has client keys defined, we can optionally enforce one
    // For simplicity (user said "Enough" for path), we allow without key
    // but if a key is provided we use it for rate limiting

    const rateCheck = await checkRateLimit(api, clientKey);
    if (!rateCheck.allowed) {
      await recordUsage(api.id, clientKey?.id, {
        method: request.method,
        path: request.nextUrl.pathname,
        statusCode: 429,
        responseTimeMs: Date.now() - start,
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        error: rateCheck.reason,
      });
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    // Build the real request
    const url = new URL(api.realUrl);

    // Forward query params
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    // Prepare headers – remove hop-by-hop and host
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        ["host", "connection", "content-length", "transfer-encoding", "x-api-key"].includes(lower)
      ) {
        return;
      }
      headers.set(key, value);
    });

    // Inject real API key if configured
    if (api.realApiKey) {
      const headerName = api.realApiKeyHeader || "Authorization";
      if (headerName.toLowerCase() === "authorization") {
        headers.set("Authorization", `Bearer ${api.realApiKey}`);
      } else {
        headers.set(headerName, api.realApiKey);
      }
    }

    // Body
    let body: BodyInit | null = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer();
    }

    // Call the real API
    const realResponse = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
      // @ts-ignore
      duplex: "half",
    });

    const responseTimeMs = Date.now() - start;

    // Record usage
    await recordUsage(api.id, clientKey?.id, {
      method: request.method,
      path: request.nextUrl.pathname,
      statusCode: realResponse.status,
      responseTimeMs,
      ip: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Build response – stream the body
    // Note: Node fetch auto-decompresses gzip/brotli, so we must strip content-encoding
    // and content-length to avoid client-side decompression errors.
    const responseHeaders = new Headers();
    realResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        ["transfer-encoding", "connection", "content-encoding", "content-length"].includes(lower)
      ) {
        return;
      }
      responseHeaders.set(key, value);
    });

    // Add some masking headers
    responseHeaders.set("X-Masked-By", "API-Masking-Panel");
    responseHeaders.set("X-Response-Time", `${responseTimeMs}ms`);

    return new NextResponse(realResponse.body, {
      status: realResponse.status,
      statusText: realResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Proxy error", message: error.message },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
