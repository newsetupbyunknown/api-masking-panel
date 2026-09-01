import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getApiById, updateApi, deleteApi } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const isAdmin = await getSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const api = await getApiById(id);
  if (!api) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { realApiKey, ...safe } = api;
  return NextResponse.json(safe);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const isAdmin = await getSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Only allow safe fields
  const allowed: any = {};
  if (typeof body.isActive === "boolean") allowed.isActive = body.isActive;
  if (body.name) allowed.name = body.name;
  if (body.realUrl) allowed.realUrl = body.realUrl;
  if (body.rateLimitType) allowed.rateLimitType = body.rateLimitType;
  if (body.rateLimitValue !== undefined) allowed.rateLimitValue = body.rateLimitValue;

  const updated = await updateApi(id, allowed);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { realApiKey, ...safe } = updated;
  return NextResponse.json(safe);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const isAdmin = await getSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteApi(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
