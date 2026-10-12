import { NextRequest, NextResponse } from "next/server";
import { setAdminUserStatus } from "@/lib/server/admin";
import { adminActor, jsonError } from "../../../_helpers";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try { const body = await request.json() as { status?: string }; return NextResponse.json(await setAdminUserStatus(await adminActor(request, true), (await context.params).id, body.status)); }
  catch (error) { return jsonError(error); }
}
