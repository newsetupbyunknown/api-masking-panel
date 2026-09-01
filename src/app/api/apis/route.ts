import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAllApis, createApi } from "@/lib/db";
import { RateLimitType } from "@/lib/types";

export async function GET() {
  const isAdmin = await getSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apis = await getAllApis();
  // Never send realApiKey to the browser
  const safe = apis.map(({ realApiKey, ...rest }) => rest);
  return NextResponse.json(safe);
}

export async function POST(request: NextRequest) {
  const isAdmin = await getSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      realUrl,
      realApiKey,
      realApiKeyHeader,
      validityType,
      validityDays,
      rateLimitType,
      rateLimitValue,
    } = body;

    if (!name || !realUrl) {
      return NextResponse.json(
        { error: "name and realUrl are required" },
        { status: 400 }
      );
    }

    const api = await createApi({
      name,
      realUrl,
      realApiKey: realApiKey || undefined,
      realApiKeyHeader: realApiKeyHeader || "Authorization",
      validityType: validityType === "days" ? "days" : "permanent",
      validityDays: validityType === "days" ? Number(validityDays) || 30 : undefined,
      rateLimitType: (rateLimitType as RateLimitType) || "unlimited",
      rateLimitValue:
        rateLimitType === "unlimited" ? null : Number(rateLimitValue) || 1000,
      isActive: true,
    });

    // Return without real key
    const { realApiKey: _, ...safe } = api;
    return NextResponse.json(safe, { status: 201 });
  } catch (error: any) {
    console.error("Create API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
