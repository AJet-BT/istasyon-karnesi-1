import { NextRequest, NextResponse } from "next/server";
import { setAdminUserRole } from "@/lib/server/admin";
import { adminActor, jsonError } from "../../../_helpers";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try { const body = await request.json() as { roleCode?: string }; return NextResponse.json(await setAdminUserRole(await adminActor(request, true), (await context.params).id, body.roleCode)); }
  catch (error) { return jsonError(error); }
}
